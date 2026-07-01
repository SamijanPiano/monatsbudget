// Auswertung des Lern-Logs für den „Lernen"-Status und die Gating-Logik des
// optionalen LLM-Fallbacks. Reine Funktionen.

import type { LearningSignal, SuggestionSurface } from './signals'

export interface SurfaceStats {
  accepted: number
  total: number
  /** Trefferquote accepted/total (0..1). */
  rate: number
}

export interface LearningStats {
  /** Anzahl aller gespeicherten Signale. */
  total: number
  /** Trefferquote je Fläche (nur Flächen mit Feedback erscheinen). */
  surfaces: Partial<Record<SuggestionSurface, SurfaceStats>>
}

/** Aggregiert Gesamtzahl + Trefferquote je Fläche aus den Feedback-Signalen. */
export function learningStats(signals: readonly LearningSignal[]): LearningStats {
  const acc = new Map<SuggestionSurface, { accepted: number; total: number }>()

  for (const s of signals) {
    if (s.type !== 'suggestion-feedback') continue
    const entry = acc.get(s.surface) ?? { accepted: 0, total: 0 }
    entry.total += 1
    if (s.accepted) entry.accepted += 1
    acc.set(s.surface, entry)
  }

  const surfaces: Partial<Record<SuggestionSurface, SurfaceStats>> = {}
  for (const [surface, { accepted, total }] of acc) {
    surfaces[surface] = { accepted, total, rate: total === 0 ? 0 : accepted / total }
  }

  return { total: signals.length, surfaces }
}

interface AiFallbackSettings {
  aiSuggestions?: boolean
  suggestThreshold?: number
}

/**
 * Entscheidet, ob der LLM-Fallback greifen darf: nur bei aktiviertem Opt-in,
 * bestehender Verbindung UND wenn die beste lokale Konfidenz den Schwellwert
 * nicht erreicht. So bleibt der teure/entfernte Pfad die Ausnahme.
 */
export function shouldUseAiFallback(
  topLocalConfidence: number,
  settings: AiFallbackSettings,
  online: boolean,
): boolean {
  if (!settings.aiSuggestions) return false
  if (!online) return false
  const threshold = settings.suggestThreshold ?? 0.4
  return topLocalConfidence < threshold
}
