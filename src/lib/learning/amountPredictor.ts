// Sagt den typischen Betrag eines neuen Postens voraus (Median früherer Posten
// mit gleichem Label in derselben Sektion). Konfidenz aus der Streuung. Reine
// Funktion. Beträge in Cent (signed).

import type { ItemCreatedSignal, LearningSignal } from './signals'
import { normalizeKey } from './signals'
import { dispersionConfidence, median } from './stats'
import type { Suggestion } from './predict'

export interface AmountContext {
  labelKey: string
  section: ItemCreatedSignal['section']
  /** Aktuell ungenutzt; reserviert für künftige Recency-Gewichtung. */
  now?: string
}

export function amountPredictor(
  ctx: AmountContext,
  signals: readonly LearningSignal[],
): Suggestion<number>[] {
  const key = normalizeKey(ctx.labelKey)
  const amounts = signals
    .filter(
      (s): s is ItemCreatedSignal =>
        s.type === 'item-created' && s.section === ctx.section && s.labelKey === key,
    )
    .map((s) => s.amountCent)

  if (amounts.length === 0) return []

  return [
    {
      value: median(amounts),
      confidence: dispersionConfidence(amounts),
      reason: amounts.length === 1 ? 'Ein früherer Posten' : `${amounts.length} frühere Posten`,
    },
  ]
}
