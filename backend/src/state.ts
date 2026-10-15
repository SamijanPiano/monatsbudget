/**
 * Gemeinsamer App-Stand für alle Geräte (wie beim ERP: eine Quelle). Der Worker
 * speichert das Dokument mit einer fortlaufenden Revision. Ein Gerät darf nur
 * schreiben, wenn es auf dem aktuellen Stand aufsetzt (optimistisches Sperren);
 * sonst bekommt es 409 mit dem aktuellen Stand und führt selbst zusammen.
 * Reine Funktionen, testbar ohne Worker-Laufzeit.
 */

/** Gespeichert wird in Stücken im Durable Object; 20 MB reichen für viele Jahre an Buchungen. */
export const MAX_STATE_BYTES = 20_000_000;

export interface StoredState {
  revision: number;
  updatedAt: string;
  /** Kennung des Geräts, das zuletzt geschrieben hat. */
  deviceId: string;
  doc: Record<string, unknown>;
}

export type StatePut =
  | { ok: true; baseRevision: number; deviceId: string; doc: Record<string, unknown> }
  | { ok: false; error: string };

/** Prüft den Body eines Schreibversuchs. */
export function parseStatePut(raw: string): StatePut {
  if (raw.length > MAX_STATE_BYTES) return { ok: false, error: 'State too large' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
  const body = (parsed ?? {}) as Record<string, unknown>;
  if (!Number.isInteger(body.baseRevision) || (body.baseRevision as number) < 0) {
    return { ok: false, error: 'Missing baseRevision' };
  }
  if (typeof body.deviceId !== 'string' || body.deviceId.length === 0 || body.deviceId.length > 64) {
    return { ok: false, error: 'Missing deviceId' };
  }
  const doc = body.doc;
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, error: 'Missing doc' };
  return { ok: true, baseRevision: body.baseRevision as number, deviceId: body.deviceId, doc: doc as Record<string, unknown> };
}

/** Liest den gespeicherten Stand; kaputte oder fehlende Werte gelten als „noch nichts da". */
export function readStoredState(raw: string | null): StoredState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as StoredState;
    return Number.isInteger(s.revision) && s.doc && typeof s.doc === 'object' ? s : null;
  } catch {
    return null;
  }
}

export type PutDecision =
  | { kind: 'conflict'; current: StoredState }
  | { kind: 'write'; next: StoredState };

/** Entscheidet über einen Schreibversuch gegen den aktuellen Stand. */
export function decidePut(
  current: StoredState | null,
  put: { baseRevision: number; deviceId: string; doc: Record<string, unknown> },
  now: string,
): PutDecision {
  const revision = current?.revision ?? 0;
  // Nur wer auf genau dem aktuellen Stand aufsetzt, darf schreiben (auch ohne Stand: nur Basis 0).
  if (put.baseRevision !== revision) {
    return { kind: 'conflict', current: current ?? { revision: 0, updatedAt: '', deviceId: '', doc: {} } };
  }
  return { kind: 'write', next: { revision: revision + 1, updatedAt: now, deviceId: put.deviceId, doc: put.doc } };
}

// ---------------------------------------------------------------------------
// Ablage in Stücken: ein Durable-Object-Wert darf höchstens 2 MB groß sein.
// ---------------------------------------------------------------------------

export const CHUNK_CHARS = 500_000;

export interface StateHeader {
  revision: number;
  updatedAt: string;
  deviceId: string;
  chunks: number;
}

/** Teilt das Dokument (als JSON-Text) in Stücke. */
export function splitIntoChunks(json: string, size = CHUNK_CHARS): string[] {
  const parts: string[] = [];
  for (let i = 0; i < json.length; i += size) parts.push(json.slice(i, i + size));
  return parts.length > 0 ? parts : [''];
}

export const chunkKey = (i: number) => `chunk:${i}`;

// ---------------------------------------------------------------------------
// Einmal-Codes zum Koppeln eines weiteren Geräts
// ---------------------------------------------------------------------------

export const PAIR_TTL_MS = 10 * 60 * 1000;

export interface PairCode {
  expiresAt: number;
}

/** Ist ein gespeicherter Code noch einlösbar? */
export function isPairCodeValid(entry: PairCode | undefined, now: number): boolean {
  return !!entry && typeof entry.expiresAt === 'number' && entry.expiresAt > now;
}
