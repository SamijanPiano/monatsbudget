// Deduplizierung für den Import. Erzeugt einen stabilen Hash je Buchung und
// filtert bereits bekannte bzw. innerhalb des Batches doppelte Buchungen.

import type { ParsedTransaction } from './types'

/** Felder, aus denen der Dedup-Schlüssel gebildet wird. */
type HashInput = {
  date: string
  amount: number
  counterparty: string
  purpose: string
}

// Normalisiert ein Textfeld: trimmen, Mehrfach-Leerraum vereinheitlichen,
// Kleinschreibung — damit kosmetische Unterschiede nicht zu Pseudo-Duplikaten
// führen.
function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

// FNV-1a-32-Bit-Hash: klein, schnell, deterministisch und ohne Abhängigkeiten.
// Als Hex-String zurückgegeben, damit der Schlüssel kompakt und leerraumfrei ist.
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    // 32-Bit-Multiplikation mit dem FNV-Primfaktor (via Shifts ohne Overflow).
    hash = Math.imul(hash, 0x01000193)
  }
  // In vorzeichenlosen 32-Bit-Wert wandeln und als Hex ausgeben.
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Bildet einen stabilen, deterministischen Dedup-Schlüssel aus den
 * Kernfeldern einer Buchung. Gleiche Eingaben → gleicher Hash; unterschiedliche
 * Eingaben → (praktisch immer) unterschiedlicher Hash.
 */
export function transactionHash(t: HashInput): string {
  const key = [
    t.date,
    String(t.amount),
    normalizeText(t.counterparty),
    normalizeText(t.purpose),
  ].join('|')
  return fnv1a(key)
}

/**
 * Liefert aus `incoming` nur die Buchungen, deren Hash weder im Bestand
 * (`existingHashes`) noch bereits weiter vorn im Batch vorkam. Idempotent:
 * derselbe Batch zweimal importiert ergibt einmal die Neuen, danach keine.
 */
export function mergeNew(
  existingHashes: Set<string> | string[],
  incoming: ParsedTransaction[],
): ParsedTransaction[] {
  const known = new Set(existingHashes)
  const result: ParsedTransaction[] = []
  for (const t of incoming) {
    if (known.has(t.hash)) continue
    known.add(t.hash)
    result.push(t)
  }
  return result
}
