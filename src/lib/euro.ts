// Geld in CENT formatieren/parsen + Datums-Helfer (deutsch).
// Bewusst getrennt von format.ts (das mit Euro-Beträgen für das Budget arbeitet).

/** Cent -> "1,49 €" */
export function euroCents(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

/** Cent -> "1,49" (ohne Währungssymbol, für Eingabefelder) */
export function euroPlain(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Freitext ("1,49", "1.49", "1,5", "2", "1.000,49") -> Cent (ganzzahlig).
 * Gibt null zurück, wenn nichts Sinnvolles erkennbar ist.
 */
export function parseEuroCents(text: string | null | undefined): number | null {
  if (text == null) return null
  let s = String(text)
    .trim()
    .replace(/[^0-9.,-]/g, '')
  if (s === '' || s === '-') return null
  const negative = s.startsWith('-')
  s = s.replace(/-/g, '')

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    s = s.replace(',', '.')
  } else if (hasDot) {
    const groups = s.split('.')
    const lastLen = groups[groups.length - 1].length
    if (groups.length > 2 || lastLen === 3) s = s.replace(/\./g, '')
  }

  const num = Number.parseFloat(s)
  if (Number.isNaN(num)) return null
  const cents = Math.round(num * 100)
  if (cents === 0) return 0 // vermeidet -0
  return negative ? -cents : cents
}

function isoToDate(iso: string): Date {
  // Mittag, damit Zeitzonen-Verschiebungen nicht aufs Vortagsdatum kippen.
  return new Date(`${iso}T12:00:00`)
}

/** Heutiges Datum als YYYY-MM-DD (lokale Zeitzone). */
export function todayIso(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

/** ISO-Datum -> "Fr, 13. Juni" */
export function dateLabel(iso: string): string {
  return isoToDate(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}

/** ISO-Datum -> "13.06.2026" */
export function dateShort(iso: string): string {
  return isoToDate(iso).toLocaleDateString('de-DE')
}
