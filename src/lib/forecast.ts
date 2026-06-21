// Vorschau & „Was kann ich noch ausgeben?" — die FinanzGuru-artige Hero-Zahl.
// Rein funktional, deterministisch, ohne Seiteneffekte: Beträge in CENT (ganze
// Zahlen, signed; negativ = Ausgabe, positiv = Einnahme). Ausgaben werden nach
// außen als positiver Betrag (Magnitude) gemeldet.

import type { RecurringRule, Transaction } from '../types/budget'

/** Monatsschlüssel 'YYYY-MM' aus einem 'YYYY-MM-DD'-Datum. */
export function monthKey(date: string): string {
  return date.slice(0, 7)
}

/** Empfänger für Vergleiche normalisieren (trimmen, Whitespace, Groß/Klein). */
function normalizeCounterparty(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Tag des Monats (1–31) aus einem 'YYYY-MM-DD'-Datum. */
function dayOf(date: string): number {
  return Number(date.slice(8, 10))
}

/** Aggregat über einen Monat. expenses ist positiv (Magnitude). */
export interface MonthSummary {
  income: number
  expenses: number
  net: number
}

/**
 * Einnahmen, Ausgaben (als positive Magnitude) und Netto für einen Monat.
 * Buchungen anderer Monate werden ignoriert.
 */
export function sumForMonth(txs: readonly Transaction[], key: string): MonthSummary {
  let income = 0
  let expenses = 0
  for (const tx of txs) {
    if (monthKey(tx.date) !== key) {
      continue
    }
    if (tx.amount >= 0) {
      income += tx.amount
    } else {
      expenses += -tx.amount
    }
  }
  return { income, expenses, net: income - expenses }
}

/**
 * Erwartete Rest-Ausgaben im Monat `key`: Summe der wiederkehrenden AUSFLÜSSE
 * (negativer amountApprox), deren typischer Tag NACH `today` liegt und die in
 * diesem Monat noch nicht gebucht wurden (Match per normalisiertem Empfänger).
 * Rückgabe als positive Magnitude.
 */
export function expectedRemaining(
  recurring: readonly RecurringRule[],
  txs: readonly Transaction[],
  key: string,
  today: Date = new Date(),
): number {
  const todayDay = today.getUTCDate()

  // Bereits in diesem Monat gesehene Empfänger (normalisiert).
  const seen = new Set(
    txs
      .filter((t) => monthKey(t.date) === key)
      .map((t) => normalizeCounterparty(t.counterparty)),
  )

  let remaining = 0
  for (const rule of recurring) {
    // Nur Ausflüsse berücksichtigen.
    if (rule.amountApprox >= 0) {
      continue
    }
    // Tag bereits durch -> diesen Monat nicht mehr erwartet.
    if (dayOf(rule.nextExpected) <= todayDay) {
      continue
    }
    // Bereits gebucht -> nicht doppelt zählen.
    if (seen.has(normalizeCounterparty(rule.counterparty))) {
      continue
    }
    remaining += -rule.amountApprox
  }
  return remaining
}

/** Eingaben für die monatsbezogenen Vorschau-Berechnungen. */
export interface ForecastInput {
  /** Aktueller Kontostand in Cent. */
  balance: number
  recurring: readonly RecurringRule[]
  txs: readonly Transaction[]
  /** Geplanter Sparbetrag in Cent (optional). */
  plannedSavings?: number
  monthKey: string
  today?: Date
}

/**
 * Hero-Zahl „Was kann ich noch ausgeben?":
 * balance − erwartete Rest-Ausgaben − geplantes Sparen. In Cent (signed).
 */
export function disposableThisMonth(input: ForecastInput): number {
  const remaining = expectedRemaining(input.recurring, input.txs, input.monthKey, input.today)
  const planned = input.plannedSavings ?? 0
  return input.balance - remaining - planned
}

/** Ergebnis des „Reicht es?"-Checks: ok + signierter Differenzbetrag (Cent). */
export interface ReichtEsResult {
  ok: boolean
  diff: number
}

/**
 * „Reicht es diesen Monat?" — prüft, ob der Kontostand die noch ausstehenden
 * wiederkehrenden Ausgaben deckt, OHNE geplantes Sparen abzuziehen.
 * diff = balance − erwartete Rest-Ausgaben (positiv = Puffer, negativ = Defizit).
 * ok = diff ≥ 0.
 */
export function reichtEs(input: ForecastInput): ReichtEsResult {
  const remaining = expectedRemaining(input.recurring, input.txs, input.monthKey, input.today)
  const diff = input.balance - remaining
  return { ok: diff >= 0, diff }
}
