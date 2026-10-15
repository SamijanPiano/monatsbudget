/**
 * Durable Object für den gemeinsamen App-Stand. Anders als KV ist es stark
 * konsistent und verarbeitet Anfragen nacheinander: Lesen-Vergleichen-Schreiben
 * ist damit atomar, zwei Geräte können sich nicht unbemerkt überschreiben.
 * Hält außerdem die Einmal-Codes zum Koppeln (einlösbar genau einmal).
 */

import {
  PAIR_TTL_MS,
  chunkKey,
  decidePut,
  isPairCodeValid,
  splitIntoChunks,
  type PairCode,
  type StateHeader,
  type StoredState,
} from './state.js';

const HEADER_KEY = 'header';
const pairKey = (code: string) => `pair:${code}`;

function reply(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export class StateStore implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  private async load(): Promise<StoredState | null> {
    const header = await this.state.storage.get<StateHeader>(HEADER_KEY);
    if (!header) return null;
    const keys = Array.from({ length: header.chunks }, (_, i) => chunkKey(i));
    const parts = await this.state.storage.get<string>(keys);
    const json = keys.map((k) => parts.get(k) ?? '').join('');
    try {
      return { revision: header.revision, updatedAt: header.updatedAt, deviceId: header.deviceId, doc: JSON.parse(json) };
    } catch {
      return null;
    }
  }

  private async save(next: StoredState, previousChunks: number): Promise<void> {
    const chunks = splitIntoChunks(JSON.stringify(next.doc));
    const entries: Record<string, unknown> = {
      [HEADER_KEY]: { revision: next.revision, updatedAt: next.updatedAt, deviceId: next.deviceId, chunks: chunks.length },
    };
    chunks.forEach((c, i) => (entries[chunkKey(i)] = c));
    // Ein put mit mehreren Einträgen ist atomar.
    await this.state.storage.put(entries);
    const stale = [];
    for (let i = chunks.length; i < previousChunks; i++) stale.push(chunkKey(i));
    if (stale.length > 0) await this.state.storage.delete(stale);
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/get') {
      const current = await this.load();
      return reply(
        current
          ? { revision: current.revision, updatedAt: current.updatedAt, deviceId: current.deviceId, doc: current.doc }
          : { revision: 0, updatedAt: null, deviceId: null, doc: null },
      );
    }

    if (pathname === '/put') {
      const put = (await request.json()) as { baseRevision: number; deviceId: string; doc: Record<string, unknown> };
      const header = await this.state.storage.get<StateHeader>(HEADER_KEY);
      const current = await this.load();
      const decision = decidePut(current, put, new Date().toISOString());
      if (decision.kind === 'conflict') {
        const c = decision.current;
        return reply({ revision: c.revision, updatedAt: c.updatedAt || null, deviceId: c.deviceId || null, doc: current ? c.doc : null }, 409);
      }
      await this.save(decision.next, header?.chunks ?? 0);
      return reply({ revision: decision.next.revision, updatedAt: decision.next.updatedAt });
    }

    if (pathname === '/pair/create') {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const code = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      const entry: PairCode = { expiresAt: Date.now() + PAIR_TTL_MS };
      await this.state.storage.put(pairKey(code), entry);
      return reply({ code, expiresAt: entry.expiresAt });
    }

    if (pathname === '/pair/redeem') {
      const { code } = (await request.json()) as { code?: unknown };
      if (typeof code !== 'string' || !/^[0-9a-f]{32}$/.test(code)) return reply({ ok: false }, 400);
      const entry = await this.state.storage.get<PairCode>(pairKey(code));
      // Einlösen löscht den Code in jedem Fall: genau einmal nutzbar.
      await this.state.storage.delete(pairKey(code));
      return isPairCodeValid(entry, Date.now()) ? reply({ ok: true }) : reply({ ok: false }, 403);
    }

    return reply({ error: 'Not found' }, 404);
  }
}
