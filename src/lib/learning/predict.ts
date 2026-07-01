// Gemeinsame Schnittstelle der Lern-Schicht: ein Predictor ist eine reine
// Funktion (Kontext + Signal-Historie -> Vorschläge mit Konfidenz), absteigend
// nach Konfidenz sortiert. Keine Seiteneffekte, kein State.

import type { LearningSignal } from './signals'

export interface Suggestion<T> {
  value: T
  /** Konfidenz im Bereich 0..1. */
  confidence: number
  /** Menschenlesbare Begründung, z. B. „4× zuletzt dieser Kategorie". */
  reason: string
}

export type Predictor<Ctx, T> = (
  ctx: Ctx,
  signals: readonly LearningSignal[],
) => Suggestion<T>[]

/** Laplace-Glättung: verhindert 0-Wahrscheinlichkeiten bei dünnen Daten. */
export const LAPLACE_ALPHA = 1

export type SuggestionMode = 'autofill' | 'suggest' | 'none'

/**
 * Entscheidet aus der Konfidenz und den zwei Schwellwerten, wie ein Vorschlag
 * angeboten wird: automatisch vorausfüllen, als Chip vorschlagen oder gar nicht.
 */
export function suggestionMode(
  confidence: number,
  autofillThreshold: number,
  suggestThreshold: number,
): SuggestionMode {
  if (confidence >= autofillThreshold) return 'autofill'
  if (confidence >= suggestThreshold) return 'suggest'
  return 'none'
}
