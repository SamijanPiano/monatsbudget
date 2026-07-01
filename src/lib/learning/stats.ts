// Kleine, reine Statistik-Helfer für die Predictoren (Median, IQR, clamp).
// Bewusst ohne Abhängigkeiten — exakt und deterministisch.

/** Begrenzt x auf [lo, hi]. */
export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/** Median einer Zahlenliste (ganzzahlig gerundet). Leere Liste -> 0. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

/** Interquartilsabstand (Streuungsmaß). Weniger als 2 Werte -> 0. */
export function iqr(values: readonly number[]): number {
  if (values.length < 2) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const lower = sorted.slice(0, mid)
  const upper = sorted.length % 2 === 1 ? sorted.slice(mid + 1) : sorted.slice(mid)
  return Math.abs(median(upper) - median(lower))
}

/**
 * Konfidenz aus Streuung relativ zum Median: enge Werte -> hohe Konfidenz.
 * Ein einzelner Wert ergibt moderate Konfidenz (0.5). Ergebnis in [0.3, 0.99].
 */
export function dispersionConfidence(values: readonly number[]): number {
  if (values.length === 0) return 0
  if (values.length === 1) return 0.5
  const center = Math.abs(median(values)) || 1
  const dispersion = iqr(values) / center
  return clamp(1 - dispersion, 0.3, 0.99)
}
