import { useMemo } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import type { Transaction } from '../../types/budget'
import { useSuggestion } from '../../hooks/useSuggestion'
import { categoryPredictor, type CategoryContext } from '../../lib/learning/categoryPredictor'
import { SuggestionBadge } from '../learning/SuggestionBadge'

interface CategorySelectProps {
  tx: Transaction
}

/**
 * Inline-Kategorieauswahl einer Buchung. Beim Setzen lernt der Store eine Regel
 * für diesen Empfänger UND legt ein Lernsignal ab. Für noch unkategorisierte
 * Buchungen bietet der Kategorie-Predictor einen Vorschlag mit Wahrscheinlichkeit an.
 */
export function CategorySelect({ tx }: CategorySelectProps) {
  const categories = useBudgetStore((s) => s.categories)
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory)

  // Stabile ctx-Identität, damit useSuggestion nur bei echten Änderungen neu rechnet.
  const ctx: CategoryContext = useMemo(
    () => ({ counterparty: tx.counterparty, purpose: tx.purpose, categories }),
    [tx.counterparty, tx.purpose, categories],
  )
  const { top, mode, accept, dismiss } = useSuggestion({
    predictor: categoryPredictor,
    ctx,
    surface: 'category',
  })

  const suggestedLabel =
    top && categories.find((c) => c.id === top.value)?.label

  const showBadge = tx.categoryId === null && mode !== 'none' && top !== null && !!suggestedLabel

  const handleConfirm = (): void => {
    if (!top) return
    setTransactionCategory(tx.id, top.value)
    accept(top.value)
  }

  return (
    <span className="tx-cat-wrap">
      <select
        className={`tx-cat ${tx.categoryId ? '' : 'tx-cat--empty'}`}
        value={tx.categoryId ?? ''}
        onChange={(e) => setTransactionCategory(tx.id, e.target.value || null)}
        aria-label="Kategorie"
      >
        <option value="">— Kategorie —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      {showBadge && (
        <SuggestionBadge
          label={suggestedLabel as string}
          confidence={top.confidence}
          mode={mode === 'autofill' ? 'autofill' : 'suggest'}
          onConfirm={handleConfirm}
          onDismiss={dismiss}
        />
      )}
    </span>
  )
}
