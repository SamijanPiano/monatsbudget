/**
 * Sicherheits-Hilfsfunktionen für den Bank-Sync-Worker.
 *
 * Bewusst frei von Worker-spezifischen APIs (kein crypto.subtle, kein
 * KVNamespace-Typ), damit alles hier unter reinem Node mit Vitest testbar ist.
 */

// Maximale Länge, mit der ein Freitextfeld aus einer Banktransaktion in einen
// LLM-Prompt einfließen darf. Echte SEPA-Verwendungszwecke sind auf 140 Zeichen
// begrenzt; alles darüber ist entweder Bank-Padding oder ein Injektionsversuch.
const PROMPT_FIELD_MAX_LENGTH = 140;

/**
 * Zeitkonstanter String-Vergleich.
 *
 * `===` bricht beim ersten abweichenden Byte ab und verrät darüber, wie viele
 * Zeichen eines Tokens bereits stimmen. Diese Variante läuft immer über die
 * volle Länge und verodert alle Unterschiede.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  // Längenunterschied fließt in dasselbe Akkumulator-Bit ein, damit auch hier
  // kein früher Ausstieg nötig ist.
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Prüft, ob ein Redirect-Ziel auf dem konfigurierten Frontend-Origin liegt.
 *
 * Ohne diese Prüfung könnte ein Aufrufer den Worker dazu bringen, den Browser
 * direkt nach dem Bank-Login auf eine beliebige fremde Seite umzuleiten.
 */
export function isAllowedRedirect(candidate: string, allowedOrigin: string): boolean {
  try {
    return new URL(candidate).origin === new URL(allowedOrigin).origin;
  } catch {
    // Relative oder kaputte URLs sind kein gültiges Ziel.
    return false;
  }
}

/**
 * Entschärft ein Freitextfeld, bevor es in einen LLM-Prompt eingesetzt wird.
 *
 * Verwendungszweck und Empfängername stammen aus der SEPA-Nachricht und sind
 * damit von jedem Fremden frei wählbar, der Geld überweist. Entfernt werden
 * Zeichen, mit denen sich die Prompt-Struktur nachbauen ließe: Zeilenumbrüche,
 * die Spaltentrenner der Transaktionsliste und spitze Klammern (unsere
 * Datenmarkierung). Der Rest bleibt lesbar, damit die Kategorisierung noch
 * funktioniert.
 */
export function sanitizePromptField(
  value: unknown,
  maxLength: number = PROMPT_FIELD_MAX_LENGTH
): string {
  if (typeof value !== 'string') return '';

  const flattened = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>|]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return flattened.length > maxLength ? `${flattened.slice(0, maxLength)}…` : flattened;
}

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

/** Minimaler KV-Ausschnitt, den der Limiter braucht (erleichtert das Testen). */
export interface RateLimitStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Fixed-Window-Zähler über KV.
 *
 * ACHTUNG: KV ist eventually consistent — bei gleichzeitigen Requests aus
 * verschiedenen Regionen kann der Zähler leicht nachlaufen. Das hier ist eine
 * Kostenbremse gegen automatisierten Missbrauch, kein exaktes Limit. Für harte
 * Garantien bräuchte es ein Durable Object.
 */
export async function checkRateLimit(
  store: RateLimitStore,
  bucket: string,
  limit: number,
  windowSeconds: number,
  nowMs: number = Date.now()
): Promise<RateLimitResult> {
  const windowIndex = Math.floor(nowMs / 1000 / windowSeconds);
  const key = `ratelimit:${bucket}:${windowIndex}`;

  const raw = await store.get(key);
  const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
  const used = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  if (used >= limit) {
    return { allowed: false, remaining: 0 };
  }

  // Doppelte Fensterlänge als TTL, damit der Eintrag das Fenster sicher
  // überlebt und danach von selbst verschwindet.
  await store.put(key, String(used + 1), { expirationTtl: windowSeconds * 2 });
  return { allowed: true, remaining: limit - used - 1 };
}
