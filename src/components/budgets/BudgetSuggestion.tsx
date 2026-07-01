import { useMemo } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import { useSuggestion } from '../../hooks/useSuggestion'
import { budgetPredictor, type BudgetContext } from '../../lib/learning/budgetPredictor'
import { SuggestionBadge } from '../learning/SuggestionBadge'
import { formatCents } from '../../lib/format'

interface BudgetSuggestionProps {
  categoryId: string
  onApply: (cents: number) => void
}

/**
 * Schlägt für eine Kategorie ohne Budget ein Monatslimit aus dem bisherigen
 * Ausgabeverhalten vor (rollender Median). Isoliert den Hook je Zeile.
 */
export function BudgetSuggestion({ categoryId, onApply }: BudgetSuggestionProps) {
  const transactions = useBudgetStore((s) => s.transactions)
  // Stabile ctx-Identität, damit useSuggestion nur bei echten Änderungen neu rechnet.
  const ctx: BudgetContext = useMemo(
    () => ({ categoryId, transactions }),
    [categoryId, transactions],
  )
  const { top, mode, accept, dismiss } = useSuggestion({
    predictor: budgetPredictor,
    ctx,
    surface: 'budget',
  })

  if (mode === 'none' || top === null) return null

  const apply = (): void => {
    onApply(top.value)
    accept(top.value)
  }

  return (
    <SuggestionBadge
      label={formatCents(top.value)}
      confidence={top.confidence}
      mode={mode === 'autofill' ? 'autofill' : 'suggest'}
      onConfirm={apply}
      onDismiss={dismiss}
    />
  )
}
