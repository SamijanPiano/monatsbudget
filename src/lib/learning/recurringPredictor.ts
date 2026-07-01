// Sagt für einen Empfänger die nächste wiederkehrende Zahlung voraus: typischer
// Tag im Monat, typischer Betrag und das nächste Fälligkeitsdatum. Datenpunkte
// kommen aus Buchungen UND aus bestätigten Wiederkehr-Signalen. Reine Funktion.

import type { Transaction } from '../../types/budget'
import type { LearningSignal, RecurringConfirmedSignal } from './signals'
import { normalizeKey } from './signals'
import { dispersionConfidence, median } from './stats'
import type { Suggestion } from './predict'

export interface RecurringContext {
  counterpartyKey: string
  transactions: readonly Transaction[]
  /** Bezugszeitpunkt für die nächste Fälligkeit (Default: jetzt). */
  now?: string
}

export interface RecurringPrediction {
  dayOfMonth: number
  amountCent: number
  /** Nächstes erwartetes Datum im Format YYYY-MM-DD. */
  nextDue: string
}

const MIN_OCCURRENCES = 2

function dayOf(date: string): number {
  return Number(date.slice(8, 10))
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Nächstes Vorkommen von `day` ab `now` (rollt in den Folgemonat, wenn vorbei). */
function nextDueFrom(now: string, day: number): string {
  const isoDay = now.slice(0, 10)
  let year = Number(isoDay.slice(0, 4))
  let month = Number(isoDay.slice(5, 7)) // 1..12
  const today = Number(isoDay.slice(8, 10))

  if (day <= today) {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  const clamped = Math.min(day, daysInMonth(year, month))
  return `${year}-${pad(month)}-${pad(clamped)}`
}

export function recurringPredictor(
  ctx: RecurringContext,
  signals: readonly LearningSignal[],
): Suggestion<RecurringPrediction>[] {
  const key = normalizeKey(ctx.counterpartyKey)

  const days: number[] = []
  const amounts: number[] = []

  for (const t of ctx.transactions) {
    if (normalizeKey(t.counterparty) !== key) continue
    days.push(dayOf(t.date))
    amounts.push(t.amount)
  }
  for (const s of signals) {
    if (s.type !== 'recurring-confirmed') continue
    const confirmed = s as RecurringConfirmedSignal
    if (confirmed.counterpartyKey !== key) continue
    days.push(confirmed.dayOfMonth)
    amounts.push(confirmed.amountCent)
  }

  if (days.length < MIN_OCCURRENCES) return []

  const now = ctx.now ?? new Date().toISOString()
  const dayOfMonth = median(days)
  const amountCent = median(amounts)
  const confidence = Math.min(dispersionConfidence(days), dispersionConfidence(amounts))

  return [
    {
      value: { dayOfMonth, amountCent, nextDue: nextDueFrom(now, dayOfMonth) },
      confidence,
      reason: `${days.length} Vorkommen`,
    },
  ]
}
