// Schlägt ein Monatsbudget für eine Kategorie vor: rollender Median der
// Monatsausgaben im jüngsten Zeitfenster. Vorschlag als positive Magnitude in
// Cent. Konfidenz aus Streuung, gedämpft bei wenigen Monaten. Reine Funktion.

import type { Transaction } from '../../types/budget'
import { monthKey } from '../forecast'
import { clamp, dispersionConfidence, median } from './stats'
import type { Suggestion } from './predict'

export interface BudgetContext {
  categoryId: string
  transactions: readonly Transaction[]
  /** Wie viele der jüngsten Monate einfließen (Default 6). */
  monthsBack?: number
}

const DEFAULT_MONTHS_BACK = 6

// Erfüllt die Predictor-Signatur; die Signal-Historie wird hier (noch) nicht
// benötigt — die Datenbasis sind die echten Monatsausgaben aus den Buchungen.
export function budgetPredictor(ctx: BudgetContext): Suggestion<number>[] {
  const monthsBack = ctx.monthsBack ?? DEFAULT_MONTHS_BACK

  // Monatssummen der Kategorie bilden.
  const byMonth = new Map<string, number>()
  for (const t of ctx.transactions) {
    if (t.categoryId !== ctx.categoryId) continue
    const key = monthKey(t.date)
    byMonth.set(key, (byMonth.get(key) ?? 0) + t.amount)
  }
  if (byMonth.size === 0) return []

  // Jüngstes Zeitfenster, als positive Magnitude.
  const totals = [...byMonth.keys()]
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, monthsBack)
    .map((key) => Math.abs(byMonth.get(key) ?? 0))

  const penalty = totals.length < 3 ? 0.6 : 1
  const confidence = clamp(dispersionConfidence(totals) * penalty, 0.1, 0.99)

  return [
    {
      value: median(totals),
      confidence,
      reason: `${totals.length} Monat${totals.length === 1 ? '' : 'e'} Verlauf`,
    },
  ]
}
