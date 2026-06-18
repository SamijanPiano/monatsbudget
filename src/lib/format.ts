// Formatierung von Geldbeträgen und Monaten (deutsch).

const MONTHS_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

export function formatMoney(value: number, locale = 'de-DE'): string {
  const safe = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)
}

/** Kompakte Anzeige ohne Währungssymbol, z. B. für Achsenbeschriftungen. */
export function formatNumber(value: number, locale = 'de-DE'): string {
  const safe = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe)
}

const MONTH_ID_RE = /^\d{4}-\d{2}$/

/** "2026-06" -> "Juni 2026" */
export function formatMonthId(id: string): string {
  if (!MONTH_ID_RE.test(id)) return id
  const [year, month] = id.split('-')
  const index = Number(month) - 1
  const name = MONTHS_DE[index] ?? month
  return `${name} ${year}`
}

/** "2026-06" -> "Jun 26" (kurz, für Verlaufs-Charts) */
export function formatMonthShort(id: string): string {
  if (!MONTH_ID_RE.test(id)) return id
  const [year, month] = id.split('-')
  const index = Number(month) - 1
  const name = (MONTHS_DE[index] ?? month).slice(0, 3)
  return `${name} ${year.slice(2)}`
}

/** Verschiebt eine YYYY-MM-ID um delta Monate. */
export function shiftMonthId(id: string, delta: number): string {
  if (!MONTH_ID_RE.test(id)) return id
  const [year, month] = id.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}
