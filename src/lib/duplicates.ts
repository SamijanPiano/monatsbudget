// Findet mögliche doppelte Buchungen im Bestand (Altlast aus Syncs, die
// vorgemerkte Umsätze übernommen haben, oder Banken, die Buchungstexte
// nachträglich ändern). Nur Vorschläge: gelöscht wird erst nach Bestätigung,
// weil zwei gleiche Einkäufe am selben Tag echt sein können. Rein funktional.

import type { Transaction } from '../types/budget'

/** Maximaler Abstand zwischen Vormerkung und Buchung in Tagen. */
const MAX_DAY_GAP = 5
const DAY_MS = 86_400_000

export interface DuplicatePair {
  /** Stabiler Schlüssel des Paars (für „kein Duplikat"). */
  key: string
  /** Die zuletzt importierte, aktuelle Fassung. */
  keep: Transaction
  /** Die ältere Fassung, die gelöscht werden soll. */
  remove: Transaction
}

/** Reihenfolge-unabhängiger Schlüssel für ein Paar. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function dayGap(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS
}

function isDuplicate(a: Transaction, b: Transaction): boolean {
  if (a.bankRef && b.bankRef) return a.bankRef === b.bankRef
  return (
    a.amount === b.amount &&
    normalize(a.counterparty) === normalize(b.counterparty) &&
    dayGap(a.date, b.date) <= MAX_DAY_GAP
  )
}

/**
 * Liefert Paare möglicher Duplikate. Die Reihenfolge im Array ist die
 * Import-Reihenfolge; die früher importierte Fassung wird zum Löschen
 * vorgeschlagen, weil die spätere den endgültigen Buchungsstand trägt.
 */
export function findDuplicateCandidates(
  transactions: readonly Transaction[],
  dismissed: readonly string[] = [],
): DuplicatePair[] {
  const skip = new Set(dismissed)
  const used = new Set<string>()
  const pairs: DuplicatePair[] = []
  const candidates = transactions.filter((t) => t.source !== 'manual')

  for (let i = 0; i < candidates.length; i++) {
    const older = candidates[i]
    if (used.has(older.id)) continue
    for (let j = i + 1; j < candidates.length; j++) {
      const newer = candidates[j]
      if (used.has(newer.id) || !isDuplicate(older, newer)) continue
      const key = pairKey(older.id, newer.id)
      if (skip.has(key)) continue
      used.add(older.id)
      used.add(newer.id)
      pairs.push({ key, keep: newer, remove: older })
      break
    }
  }
  return pairs
}
