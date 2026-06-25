// Erkennung wiederkehrender Posten (Abos, Miete, Strom …) aus dem
// Buchungsstrom. Rein funktional, deterministisch, ohne Seiteneffekte: Beträge
// in CENT (ganze Zahlen, signed; negativ = Ausgabe). Spiegelt die Logik einer
// FinanzGuru-artigen Vertragserkennung in einfacher, testbarer Form.

import { createId } from './id'
import type { RecurringRule, Transaction } from '../types/budget'

// ─── Schwellen & Toleranzen ──────────────────────────────────────────────────
// Eine Gruppe gilt als wiederkehrend, wenn sie in mindestens MIN_OCCURRENCES
// DISTINKTEN Monaten auftaucht. Zwei Treffer reichen, damit Abos direkt nach
// dem zweiten Monat erkannt werden.
const MIN_OCCURRENCES = 2
// Betrag gilt als „ungefähr stabil", wenn die Spanne (max−min) entweder
// ≤ 10 % des typischen Betrags ODER ≤ 2 € (200 Cent) ist. Das fängt sowohl
// kleine Abos (feste Cent) als auch schwankende Rechnungen (Strom) ab.
const AMOUNT_TOLERANCE_RATIO = 0.1
const AMOUNT_TOLERANCE_CENT = 200

/** Empfänger normalisieren: trimmen, Mehrfach-Whitespace + Groß/Klein angleichen. */
function normalizeCounterparty(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Monatsschlüssel 'YYYY-MM' aus einem 'YYYY-MM-DD'-Datum. */
function monthOf(date: string): string {
  return date.slice(0, 7)
}

/** Tag des Monats (1–31) aus einem 'YYYY-MM-DD'-Datum. */
function dayOf(date: string): number {
  return Number(date.slice(8, 10))
}

/** Median einer Cent-Liste (ganzzahlig; bei gerader Länge unterer Mittelwert). */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[mid]
  }
  // Gerade Länge: Mittelwert der beiden mittleren Werte, ganzzahlig gerundet.
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

/** Häufigster Wert (Modus) einer Liste; bei Gleichstand der zuerst gesehene. */
function mostCommon<T>(values: readonly T[]): T | undefined {
  const counts = new Map<T, number>()
  let best: T | undefined
  let bestCount = 0
  for (const value of values) {
    const next = (counts.get(value) ?? 0) + 1
    counts.set(value, next)
    if (next > bestCount) {
      best = value
      bestCount = next
    }
  }
  return best
}

/**
 * Heuristik: Sind diese Beträge/Daten ein monatlich wiederkehrender Posten?
 * Bedingungen: ≥ MIN_OCCURRENCES distinkte Monate UND ungefähr stabiler Betrag.
 */
export function isLikelyRecurring(amounts: readonly number[], dates: readonly string[]): boolean {
  if (amounts.length < MIN_OCCURRENCES || dates.length < MIN_OCCURRENCES) {
    return false
  }

  const distinctMonths = new Set(dates.map(monthOf))
  if (distinctMonths.size < MIN_OCCURRENCES) {
    return false
  }

  return isAmountStable(amounts)
}

/** Betrag „ungefähr stabil": Spanne ≤ 10 % des typischen Betrags ODER ≤ 2 €. */
function isAmountStable(amounts: readonly number[]): boolean {
  const magnitudes = amounts.map((a) => Math.abs(a))
  const min = Math.min(...magnitudes)
  const max = Math.max(...magnitudes)
  const spread = max - min
  const typical = median(magnitudes)
  const ratioTolerance = typical * AMOUNT_TOLERANCE_RATIO
  return spread <= ratioTolerance || spread <= AMOUNT_TOLERANCE_CENT
}

/** Eine nach Empfänger gruppierte Sammlung von Buchungen. */
interface Group {
  counterparty: string
  txs: Transaction[]
}

/** Buchungen nach normalisiertem Empfänger gruppieren (Originalname behalten). */
function groupByCounterparty(txs: readonly Transaction[]): Group[] {
  const groups = new Map<string, Group>()
  for (const tx of txs) {
    const key = normalizeCounterparty(tx.counterparty)
    const existing = groups.get(key)
    if (existing) {
      existing.txs.push(tx)
    } else {
      // Erster Treffer prägt den angezeigten Empfängernamen.
      groups.set(key, { counterparty: tx.counterparty, txs: [tx] })
    }
  }
  return [...groups.values()]
}

/**
 * Nächsten erwarteten Termin nach `today` bestimmen: typischer Tag im
 * Monatszyklus, frühestens im laufenden Monat von `today`, sonst Folgemonat.
 */
function nextExpectedDate(typicalDay: number, today: Date): string {
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth() // 0-basiert
  const todayDay = today.getUTCDate()

  // Kandidat im laufenden Monat; liegt er nicht nach heute -> nächster Monat.
  let targetYear = year
  let targetMonth = month
  if (typicalDay <= todayDay) {
    targetMonth += 1
    if (targetMonth > 11) {
      targetMonth = 0
      targetYear += 1
    }
  }

  // Tag auf die tatsächliche Monatslänge begrenzen (z. B. Tag 31 im Februar).
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const day = Math.min(typicalDay, lastDay)

  const mm = String(targetMonth + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${targetYear}-${mm}-${dd}`
}

/**
 * Wiederkehrende Posten aus dem Buchungsstrom erkennen.
 * Gruppiert nach Empfänger, prüft Kadenz + Betragsstabilität und leitet je
 * Gruppe eine RecurringRule ab. Deterministisch (fester `today` injizierbar).
 */
export function detectRecurring(txs: readonly Transaction[], today: Date = new Date()): RecurringRule[] {
  const rules: RecurringRule[] = []

  for (const group of groupByCounterparty(txs)) {
    const amounts = group.txs.map((t) => t.amount)
    const dates = group.txs.map((t) => t.date)

    if (!isLikelyRecurring(amounts, dates)) {
      continue
    }

    // Vorzeichen aus dem Median der Beträge, Betrag aus dem Median der Beträge.
    const amountApprox = median(amounts)
    const typicalDay = median(dates.map(dayOf))
    const categoryId = mostCommon(group.txs.map((t) => t.categoryId).filter((c): c is string => c !== null)) ?? null

    rules.push({
      id: createId(),
      counterparty: group.counterparty,
      amountApprox,
      cadence: 'monthly',
      categoryId,
      nextExpected: nextExpectedDate(typicalDay, today),
    })
  }

  return rules
}
