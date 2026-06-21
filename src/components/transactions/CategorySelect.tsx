import { useBudgetStore } from '../../store/budgetStore'
import type { Transaction } from '../../types/budget'

interface CategorySelectProps {
  tx: Transaction
}

/**
 * Inline-Kategorieauswahl einer Buchung. Beim Setzen lernt der Store eine Regel
 * für diesen Empfänger, sodass künftige Buchungen automatisch zugeordnet werden.
 */
export function CategorySelect({ tx }: CategorySelectProps) {
  const categories = useBudgetStore((s) => s.categories)
  const setTransactionCategory = useBudgetStore((s) => s.setTransactionCategory)

  return (
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
  )
}
