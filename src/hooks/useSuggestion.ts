// React-Anbindung der Lern-Schicht: nimmt einen reinen Predictor + Kontext,
// liest die Signal-Historie und die Schwellwerte aus den Stores und liefert den
// Top-Vorschlag samt Modus (autofill/suggest/none). accept/dismiss schreiben ein
// suggestion-feedback-Signal zurück (Feedback-Loop). Das fachliche Domänensignal
// (z. B. category-assigned) setzt die jeweilige Store-Action der Fläche.

import { useMemo } from 'react'
import { useLearningStore } from '../store/learningStore'
import { useBudgetStore } from '../store/budgetStore'
import { LEARNING_SETTINGS_DEFAULTS } from '../lib/seed'
import type { SuggestionSurface } from '../lib/learning/signals'
import {
  suggestionMode,
  type Predictor,
  type Suggestion,
  type SuggestionMode,
} from '../lib/learning/predict'

interface UseSuggestionOptions<Ctx, T> {
  predictor: Predictor<Ctx, T>
  ctx: Ctx
  surface: SuggestionSurface
  /** Serialisiert einen Wert für das Feedback-Log (Default: String). */
  serialize?: (value: T) => string
}

interface UseSuggestionResult<T> {
  top: Suggestion<T> | null
  alternatives: Suggestion<T>[]
  mode: SuggestionMode
  /** Nutzer übernimmt einen Wert (geklickt oder bestätigt). */
  accept: (chosen: T) => void
  /** Nutzer verwirft den Vorschlag, ohne ihn zu nutzen. */
  dismiss: () => void
}

export function useSuggestion<Ctx, T>(
  opts: UseSuggestionOptions<Ctx, T>,
): UseSuggestionResult<T> {
  const { predictor, ctx, surface, serialize = (v: T) => String(v) } = opts
  const signals = useLearningStore((s) => s.signals)
  const record = useLearningStore((s) => s.record)
  const settings = useBudgetStore((s) => s.settings)

  const autofill = settings.autofillThreshold ?? LEARNING_SETTINGS_DEFAULTS.autofillThreshold
  const suggest = settings.suggestThreshold ?? LEARNING_SETTINGS_DEFAULTS.suggestThreshold

  // ctx MUSS vom Aufrufer memoized sein (useMemo auf die Primitive), sonst greift
  // dieser Cache nie. Dass `signals` als ganzes Array abonniert wird, ist bewusst:
  // record() feuert nur bei seltenen Nutzeraktionen (Blur/Klick), und nach einem
  // neuen Signal SOLLEN alle sichtbaren Vorschläge neu rechnen — das ist der Lern-Effekt.
  const suggestions = useMemo(
    () => predictor(ctx, signals),
    [predictor, ctx, signals],
  )

  const top = suggestions[0] ?? null
  const alternatives = suggestions.slice(1)
  const mode = top ? suggestionMode(top.confidence, autofill, suggest) : 'none'

  const accept = (chosen: T): void => {
    if (!top) return
    record({
      type: 'suggestion-feedback',
      surface,
      predicted: serialize(top.value),
      chosen: serialize(chosen),
      accepted: serialize(chosen) === serialize(top.value),
    })
  }

  const dismiss = (): void => {
    if (!top) return
    record({
      type: 'suggestion-feedback',
      surface,
      predicted: serialize(top.value),
      chosen: '',
      accepted: false,
    })
  }

  return { top, alternatives, mode, accept, dismiss }
}
