// Sagt die Kategorie einer Buchung voraus. Reihenfolge: (1) harter Regel-Treffer
// = Konfidenz 1.0, sonst (2) recency-gewichtete Häufigkeit pro Empfänger, sonst
// (3) Fallback über Tokens des Verwendungszwecks. Reine Funktion.

import type { Category } from '../../types/budget'
import type { CategoryAssignedSignal, LearningSignal } from './signals'
import { normalizeKey, recencyWeight, tokenize } from './signals'
import { categorize } from '../categorize'
import { LAPLACE_ALPHA, type Suggestion } from './predict'

export interface CategoryContext {
  counterparty: string
  purpose: string
  categories: Category[]
  /** Bezugszeitpunkt für die Recency-Gewichtung (Default: jetzt). */
  now?: string
}

/** Wandelt gewichtete Kategorie-Scores in laplace-geglättete Vorschläge. */
function toSuggestions(
  weights: Map<string, number>,
  validIds: Set<string>,
  reason: string,
): Suggestion<string>[] {
  const entries = [...weights].filter(([id]) => validIds.has(id))
  if (entries.length === 0) return []

  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  const denom = total + LAPLACE_ALPHA * entries.length

  return entries
    .map(([value, w]) => ({
      value,
      confidence: (w + LAPLACE_ALPHA) / denom,
      reason,
    }))
    .sort((a, b) => b.confidence - a.confidence)
}

export function categoryPredictor(
  ctx: CategoryContext,
  signals: readonly LearningSignal[],
): Suggestion<string>[] {
  // (1) Harter Regel-Treffer schlägt alles.
  const ruleHit = categorize({ counterparty: ctx.counterparty, purpose: ctx.purpose }, ctx.categories)
  if (ruleHit !== null) {
    return [{ value: ruleHit, confidence: 1, reason: 'Regel-Treffer' }]
  }

  const now = ctx.now ?? new Date().toISOString()
  const validIds = new Set(ctx.categories.map((c) => c.id))
  const assigned = signals.filter(
    (s): s is CategoryAssignedSignal => s.type === 'category-assigned',
  )

  // (2) Häufigkeit pro Empfänger (recency-gewichtet).
  const cpKey = normalizeKey(ctx.counterparty)
  const byCounterparty = new Map<string, number>()
  for (const s of assigned) {
    if (s.counterpartyKey !== cpKey) continue
    byCounterparty.set(s.categoryId, (byCounterparty.get(s.categoryId) ?? 0) + recencyWeight(s.ts, now))
  }
  if (byCounterparty.size > 0) {
    const out = toSuggestions(byCounterparty, validIds, 'Empfänger')
    if (out.length > 0) return out
  }

  // (3) Fallback: Überschneidung der Verwendungszweck-Tokens.
  const tokens = new Set(tokenize(ctx.purpose))
  if (tokens.size === 0) return []
  const byToken = new Map<string, number>()
  for (const s of assigned) {
    const overlap = s.purposeTokens.reduce((n, t) => (tokens.has(t) ? n + 1 : n), 0)
    if (overlap === 0) continue
    byToken.set(s.categoryId, (byToken.get(s.categoryId) ?? 0) + overlap * recencyWeight(s.ts, now))
  }
  return toSuggestions(byToken, validIds, 'Verwendungszweck')
}
