// Mehrmonats-Berichte: Kategorie-Summen und Monats-Verlauf über einen Zeitraum.
// Rein funktional, Beträge in CENT. Ausgaben werden als positive Magnitude
// gemeldet. Monats-Schlüssel im Format YYYY-MM (lexikografisch vergleichbar).

import type { Category, Transaction } from '../types/budget'
import { monthKey, sumForMonth } from './forecast'
import { shiftMonthId } from './format'

/** Inklusive Liste der Monats-IDs von `fromKey` bis `toKey`, chronologisch. */
export function monthRange(fromKey: string, toKey: string): string[] {
  if (fromKey > toKey) return []
  const result: string[] = []
  let cur = fromKey
  // Obergrenze gegen Endlosschleifen bei kaputten Eingaben (~50 Jahre).
  for (let guard = 0; guard < 600 && cur <= toKey; guard++) {
    result.push(cur)
    cur = shiftMonthId(cur, 1)
  }
  return result
}

export interface MonthSeriesPoint {
  /** YYYY-MM */
  key: string
  income: number
  expenses: number
  net: number
}

/** Einnahmen/Ausgaben/Netto je Monat über den Zeitraum (für Verlaufs-Charts). */
export function monthlySeries(
  txs: readonly Transaction[],
  fromKey: string,
  toKey: string,
): MonthSeriesPoint[] {
  const list = [...txs]
  return monthRange(fromKey, toKey).map((key) => {
    const s = sumForMonth(list, key)
    return { key, income: s.income, expenses: s.expenses, net: s.net }
  })
}

export interface CategoryTotal {
  categoryId: string | null
  label: string
  /** Summe der Ausgaben im Zeitraum als positive Magnitude (Cent). */
  total: number
}

/**
 * Ausgaben je Kategorie über den Zeitraum [fromKey, toKey], absteigend sortiert.
 * Nur Ausgaben (amount < 0). Unkategorisierte Buchungen landen unter
 * categoryId = null („Unkategorisiert").
 */
export function categoryTotals(
  txs: readonly Transaction[],
  categories: readonly Category[],
  fromKey: string,
  toKey: string,
): CategoryTotal[] {
  const byCat = new Map<string | null, number>()
  for (const t of txs) {
    if (t.amount >= 0) continue
    const key = monthKey(t.date)
    if (key < fromKey || key > toKey) continue
    byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + Math.abs(t.amount))
  }

  const labelOf = new Map(categories.map((c) => [c.id, c.label]))
  const result: CategoryTotal[] = []
  for (const [categoryId, total] of byCat) {
    result.push({
      categoryId,
      label: categoryId ? (labelOf.get(categoryId) ?? 'Unbekannt') : 'Unkategorisiert',
      total,
    })
  }
  return result.sort((a, b) => b.total - a.total)
}
