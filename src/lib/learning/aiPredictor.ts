// Optionaler LLM-Fallback der Lern-Schicht: fragt das Backend (aiCategorize)
// nur dann, wenn die lokalen Predictoren keine ausreichende Konfidenz liefern —
// und nur mit Opt-in + Online-Verbindung (shouldUseAiFallback). Fehler werden
// nie geworfen: bei Problemen fällt die App still auf lokale Vorschläge zurück.

import type { Category, Settings, Transaction } from '../../types/budget'
import { aiCategorize } from '../bankApi'
import { getSyncConfig } from '../syncConfig'
import { shouldUseAiFallback } from './insights'
import type { Suggestion } from './predict'

/**
 * Konservative, feste Konfidenz für LLM-Vorschläge: unterhalb des üblichen
 * autofill-Schwellwerts, damit KI-Antworten IMMER als Chip erscheinen und nie
 * ohne Nutzerklick vorausgefüllt werden.
 */
export const AI_CONFIDENCE = 0.5

export interface AiCategoryContext {
  tx: Pick<Transaction, 'id' | 'counterparty' | 'purpose' | 'amount'>
  categories: Category[]
  settings: Pick<Settings, 'aiSuggestions' | 'suggestThreshold'>
  /** Beste lokale Konfidenz (0 = kein lokaler Vorschlag). */
  topLocalConfidence: number
  /** Online-Status (Default: navigator.onLine). */
  online?: boolean
}

/**
 * Async-Predictor: Kategorie-Vorschlag vom LLM-Backend. Liefert [] wenn das
 * Gating nicht erfüllt ist, das Backend nicht konfiguriert ist oder der Aufruf
 * fehlschlägt.
 */
export async function aiCategoryPredictor(
  ctx: AiCategoryContext,
): Promise<Suggestion<string>[]> {
  const online = ctx.online ?? (typeof navigator !== 'undefined' ? navigator.onLine : false)
  if (!shouldUseAiFallback(ctx.topLocalConfidence, ctx.settings, online)) return []

  const config = getSyncConfig()
  if (!config.url) return []

  try {
    const assignments = await aiCategorize(
      config,
      [
        {
          id: ctx.tx.id,
          counterparty: ctx.tx.counterparty,
          purpose: ctx.tx.purpose,
          amount: ctx.tx.amount,
        },
      ],
      ctx.categories.map((c) => ({ id: c.id, label: c.label })),
    )
    const match = assignments.find((a) => a.id === ctx.tx.id)
    if (!match || match.categoryId === null) return []
    // Nur bekannte Kategorien akzeptieren (LLM-Antworten nie blind übernehmen).
    if (!ctx.categories.some((c) => c.id === match.categoryId)) return []

    return [{ value: match.categoryId, confidence: AI_CONFIDENCE, reason: 'KI-Vorschlag' }]
  } catch {
    // Best-effort: offline/Fehler → lokale Vorschläge bleiben die Quelle.
    return []
  }
}
