// Erkennung wiederkehrender Posten (Abos, Miete, Strom …) aus dem
// Buchungsstrom. Rein funktional, deterministisch, ohne Seiteneffekte: Beträge
// in CENT (ganze Zahlen, signed; negativ = Ausgabe). Spiegelt die Logik einer
// FinanzGuru-artigen Vertragserkennung in einfacher, testbarer Form.

import { createId } from './id'
import type { RecurringRule, Transaction } from '../types/budget'

// ─── Schwellen & Toleranzen ──────────────────────────────────────────────────
// Ein Dauerposten ist „immer derselbe Betrag am immer gleichen Tag":
// - mindestens MIN_OCCURRENCES Treffer in aufeinanderfolgenden Monaten,
//   je Monat genau einer,
// - Betrag weicht höchstens 50 Cent bzw. 3 % vom typischen Betrag ab,
// - jeder Treffer liegt im Plan (siehe isOnSchedule).
const MIN_OCCURRENCES = 2
const AMOUNT_TOLERANCE_RATIO = 0.03
const AMOUNT_TOLERANCE_CENT = 50
/** Abbuchung darf so viele Tage vom üblichen Tag abweichen. */
const SCHEDULE_TOLERANCE_DAYS = 2
/**
 * Kam ein Posten so viele Tage nicht mehr, gilt er als beendet (z. B. altes
 * Gehalt nach einer Erhöhung, gekündigtes Abo): längster Monat + Toleranz +
 * Wochenend-Verschiebung.
 */
const MAX_SILENCE_DAYS = 31 + SCHEDULE_TOLERANCE_DAYS + 2
const DAY_MS = 86_400_000

/** Empfänger normalisieren: trimmen, Mehrfach-Whitespace + Groß/Klein angleichen. */
function normalizeCounterparty(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Schlüssel, unter dem ein Empfänger als „kein Dauerposten" gemerkt wird. */
export function recurringKey(counterparty: string): string {
  return normalizeCounterparty(counterparty)
}

/** Kam die jüngste Buchung zu lange vor `today`? */
function isStale(dates: readonly string[], today: Date): boolean {
  const last = [...dates].sort()[dates.length - 1]
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return (todayUtc - Date.parse(`${last}T00:00:00Z`)) / DAY_MS > MAX_SILENCE_DAYS
}

/** Fortlaufender Monatsindex (Jahr*12 + Monat), um Lücken zu erkennen. */
function monthIndex(date: string): number {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
}

/** Tag des Monats (1–31) aus einem 'YYYY-MM-DD'-Datum. */
function dayOf(date: string): number {
  return Number(date.slice(8, 10))
}

/** Anzahl Tage im Monat des Datums. */
export function daysInMonthOf(date: string): number {
  return new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate()
}

/**
 * Abstand zweier Monatstage über die Monatsgrenze hinweg: der 31. und der 1.
 * liegen einen Tag auseinander, nicht 30.
 */
export function cyclicDayDistance(day: number, typicalDay: number, monthLength: number): number {
  const direct = Math.abs(day - typicalDay)
  return Math.min(direct, monthLength - direct)
}

/** Wochentag eines 'YYYY-MM-DD'-Datums: 0 = Sonntag … 6 = Samstag. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
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

/** Liegt `amount` innerhalb der Betragstoleranz um `typical`? (beides Cent, Betrag) */
function withinAmountTolerance(amount: number, typical: number): boolean {
  const diff = Math.abs(Math.abs(amount) - Math.abs(typical))
  return diff <= AMOUNT_TOLERANCE_CENT || diff <= Math.abs(typical) * AMOUNT_TOLERANCE_RATIO
}

/**
 * Liegt eine Buchung „im Plan", also nah genug am typischen Abbuchungstag?
 * `date` ist das Buchungsdatum (YYYY-MM-DD), `typicalDay` der übliche Tag (1–31).
 */
export function isOnSchedule(date: string, typicalDay: number): boolean {
  const day = dayOf(date)
  const monthLength = daysInMonthOf(date)
  // Ein „31." im 30-Tage-Monat wird am letzten Tag fällig.
  const target = Math.min(typicalDay, monthLength)
  if (cyclicDayDistance(day, target, monthLength) <= SCHEDULE_TOLERANCE_DAYS) return true

  // Fällt der Solltag aufs Wochenende, bucht die Bank erst am nächsten Werktag,
  // danach gilt wieder dieselbe Toleranz.
  const weekday = weekdayOf(`${date.slice(0, 8)}${String(target).padStart(2, '0')}`)
  const weekendShift = weekday === 6 ? 2 : weekday === 0 ? 1 : 0
  const late = day - target
  return weekendShift > 0 && late >= 0 && late <= weekendShift + SCHEDULE_TOLERANCE_DAYS
}

/**
 * Heuristik: Sind diese Beträge/Daten ein monatlicher Dauerposten?
 * Bedingungen: ≥ MIN_OCCURRENCES Treffer in aufeinanderfolgenden Monaten
 * (je Monat genau einer), stabiler Betrag, jeder Treffer im Plan.
 */
export function isLikelyRecurring(amounts: readonly number[], dates: readonly string[]): boolean {
  if (amounts.length < MIN_OCCURRENCES || dates.length !== amounts.length) {
    return false
  }

  const typical = median(amounts)
  if (!amounts.every((a) => withinAmountTolerance(a, typical))) return false

  // Maßgeblich ist die jüngste lückenlose Folge: eine alte Lücke oder ein
  // Doppel-Monat in der Vergangenheit soll einen laufenden Dauerposten nicht
  // dauerhaft verstecken.
  const run = latestMonthlyRun(dates)
  if (run.length < MIN_OCCURRENCES) return false
  const typicalDay = median(run.map(dayOf))
  return run.every((d) => isOnSchedule(d, typicalDay))
}

/** Jüngste Folge von Daten in aufeinanderfolgenden Monaten, je Monat genau eines. */
function latestMonthlyRun(dates: readonly string[]): string[] {
  const sorted = [...dates].sort()
  const run: string[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const date = sorted[i]
    const next = run[0]
    if (next === undefined) {
      run.unshift(date)
      continue
    }
    const gap = monthIndex(next) - monthIndex(date)
    if (gap === 0) return run.length > 1 ? run.slice(1) : [] // zwei im selben Monat: Folge endet hier
    if (gap !== 1) break
    run.unshift(date)
  }
  return run
}

/**
 * Teilt die Buchungen eines Empfängers in Betrags-Cluster, damit z. B. zwei
 * verschiedene Abos über PayPal getrennt erkannt werden. Gleiches Vorzeichen,
 * Betrag innerhalb der Toleranz um den ersten (kleinsten) Betrag des Clusters.
 */
function clusterByAmount(txs: readonly Transaction[]): Transaction[][] {
  const sorted = [...txs].sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))
  const clusters: Transaction[][] = []
  for (const tx of sorted) {
    const target = clusters.find(
      (c) => Math.sign(c[0].amount) === Math.sign(tx.amount) && withinAmountTolerance(tx.amount, c[0].amount),
    )
    if (target) target.push(tx)
    else clusters.push([tx])
  }
  return clusters
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
 * `excluded`: Schlüssel (recurringKey) von Empfängern, die der Nutzer als
 * „kein Dauerposten" markiert hat.
 */
export function detectRecurring(
  txs: readonly Transaction[],
  today: Date = new Date(),
  excluded: readonly string[] = [],
): RecurringRule[] {
  const rules: RecurringRule[] = []
  const skip = new Set(excluded)

  for (const group of groupByCounterparty(txs)) {
    if (skip.has(recurringKey(group.counterparty))) continue
    for (const cluster of clusterByAmount(group.txs)) {
      const amounts = cluster.map((t) => t.amount)
      const dates = cluster.map((t) => t.date)
      if (!isLikelyRecurring(amounts, dates) || isStale(dates, today)) continue

      const typicalDay = median(dates.map(dayOf))
      const categoryId =
        mostCommon(cluster.map((t) => t.categoryId).filter((c): c is string => c !== null)) ?? null

      rules.push({
        id: createId(),
        counterparty: group.counterparty,
        amountApprox: median(amounts),
        cadence: 'monthly',
        categoryId,
        nextExpected: nextExpectedDate(typicalDay, today),
      })
    }
  }

  return rules
}
