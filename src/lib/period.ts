// Budget-Perioden: Samuel bekommt am 15. Gehalt, also läuft eine Periode vom
// Gehaltseingang bis zum Tag vor dem nächsten. Kommt das Gehalt früher oder
// später (Wochenende, Feiertag), verschiebt sich der Start auf den echten
// Eingang, solange er im Fenster um den Stichtag liegt. Rein funktional.

/** Stichtag des Gehalts. */
export const ANCHOR_DAY = 15
/** Gehalt zählt als „pünktlich", wenn es zwischen dem 10. und 18. eingeht. */
const WINDOW_START_DAY = 10
const WINDOW_END_DAY = 18

export interface Period {
  /** Erster Tag, YYYY-MM-DD. */
  start: string
  /** Letzter Tag (inklusive), YYYY-MM-DD. */
  end: string
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Datum ± Tage, YYYY-MM-DD in UTC (keine Zeitzonen-Sprünge). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Monatsindex (Jahr*12 + Monat 0-basiert) eines Datums. */
function monthIndexOf(date: string): number {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
}

function monthPrefix(index: number): string {
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`
}

/** Start der Periode, die im Monat `index` beginnt: frühester Gehaltseingang im Fenster, sonst der 15. */
function startInMonth(index: number, salaryDates: readonly string[]): string {
  const prefix = monthPrefix(index)
  const inWindow = salaryDates
    .filter((d) => d.startsWith(prefix))
    .filter((d) => {
      const day = Number(d.slice(8, 10))
      return day >= WINDOW_START_DAY && day <= WINDOW_END_DAY
    })
    .sort()
  return inWindow[0] ?? `${prefix}-${pad(ANCHOR_DAY)}`
}

function periodFromMonth(index: number, salaryDates: readonly string[]): Period {
  return {
    start: startInMonth(index, salaryDates),
    end: addDays(startInMonth(index + 1, salaryDates), -1),
  }
}

/** Die Periode, in die `date` fällt. */
export function periodContaining(date: string, salaryDates: readonly string[]): Period {
  const index = monthIndexOf(date)
  const start = startInMonth(index, salaryDates)
  return periodFromMonth(date >= start ? index : index - 1, salaryDates)
}

/**
 * Alle Perioden von der ältesten Buchung (`earliest`) bis zur aktuellen,
 * neueste zuerst. Ohne Buchungen nur die aktuelle Periode.
 */
export function listPeriods(
  salaryDates: readonly string[],
  today: string,
  earliest: string | null,
  max = 24,
): Period[] {
  const current = periodContaining(today, salaryDates)
  const first = earliest ? periodContaining(earliest, salaryDates) : current
  const periods: Period[] = []
  let index = monthIndexOf(current.start)
  // Zukunftsdatierte Buchungen (falsche Geräteuhr) dürfen die aktuelle Periode nicht verdrängen.
  const stop = Math.min(monthIndexOf(first.start), index)
  while (index >= stop && periods.length < max) {
    periods.push(periodFromMonth(index, salaryDates))
    index -= 1
  }
  return periods
}

/** „15. Okt – 14. Nov" */
export function periodLabel(period: Period): string {
  const fmt = (d: string) => `${Number(d.slice(8, 10))}. ${MONTHS_SHORT[Number(d.slice(5, 7)) - 1]}`
  return `${fmt(period.start)} – ${fmt(period.end)}`
}
