// Eingabe-Parsing für Geldbeträge (deutsche Schreibweise).

/**
 * Wandelt eine freie Eingabe in eine Zahl.
 * - Komma = Dezimaltrenner ("7,2" -> 7.2)
 * - Bei vorhandenem Komma gilt der Punkt als Tausendertrenner ("1.234,56" -> 1234.56)
 * - Ohne Komma gilt der Punkt als Dezimaltrenner ("7.2" -> 7.2)
 */
export function parseAmount(raw: string): number {
  let s = raw.replace(/[^\d.,-]/g, '')
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** Zahl -> editierbarer String (Komma als Dezimaltrenner, 0 -> ""). */
export function toEditString(value: number): string {
  if (value === 0 || !Number.isFinite(value)) return ''
  return String(value).replace('.', ',')
}
