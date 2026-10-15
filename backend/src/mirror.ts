/**
 * Spiegel der App-Daten für Claude: die PWA schickt einen Schnappschuss ihres
 * Zustands plus neue Einträge des Aktionsprotokolls. Gespeichert wird beides im
 * KV des Workers, gelesen wird es auf Samuels Mac per `wrangler kv` (ohne
 * Token). Reine Funktionen, testbar ohne Worker-Laufzeit.
 */

/** Obergrenze für einen Upload (Schnappschuss + Protokoll). */
export const MAX_MIRROR_BYTES = 2_000_000;
/** So viele Protokolleinträge hält der Worker vor. */
export const MAX_EVENTS = 1000;
const MAX_TEXT = 500;
const MAX_KIND = 40;

export interface ActivityEvent {
  id: string;
  /** ISO-Zeitpunkt der Aktion. */
  at: string;
  /** Art der Aktion, z. B. "verschoben", "plan", "sync". */
  kind: string;
  text: string;
}

export type MirrorBody =
  | { ok: true; snapshot: Record<string, unknown>; events: ActivityEvent[] }
  | { ok: false; error: string };

/** Eine Zeile, ohne Steuerzeichen: Texte stammen teils von der Bank (Empfänger, Zweck). */
export function oneLine(text: string, max: number): string {
  return text
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function toEvent(value: unknown): ActivityEvent | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.at !== 'string' || typeof v.kind !== 'string') return null;
  if (Number.isNaN(Date.parse(v.at))) return null;
  const text = typeof v.text === 'string' ? v.text : '';
  return { id: v.id.slice(0, 64), at: v.at, kind: oneLine(v.kind, MAX_KIND), text: oneLine(text, MAX_TEXT) };
}

/** Prüft und zerlegt den Request-Body. */
export function parseMirrorBody(raw: string): MirrorBody {
  if (raw.length > MAX_MIRROR_BYTES) return { ok: false, error: 'Body too large' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
  const body = (parsed ?? {}) as { snapshot?: unknown; events?: unknown };
  const snapshot = body.snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { ok: false, error: 'Missing snapshot' };
  }
  const events = Array.isArray(body.events)
    ? body.events.map(toEvent).filter((e): e is ActivityEvent => e !== null)
    : [];
  return { ok: true, snapshot: snapshot as Record<string, unknown>, events };
}

/** Führt Protokolle zusammen: ohne Doppelte, zeitlich sortiert, die neuesten `cap`. */
export function mergeEvents(
  existing: readonly ActivityEvent[],
  incoming: readonly ActivityEvent[],
  cap = MAX_EVENTS,
): ActivityEvent[] {
  const byId = new Map<string, ActivityEvent>();
  for (const e of [...existing, ...incoming]) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-cap);
}
