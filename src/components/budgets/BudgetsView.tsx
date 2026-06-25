import { useBudgetStore } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { BackBar } from '../ui/BackBar'
import { CentInput } from '../ui/CentInput'
import { currentMonthId } from '../../lib/seed'
import { monthlyCategoryStats } from '../../lib/summary'
import { budgetStatus, type BudgetHealth } from '../../lib/budgets'
import { isPlus, maxBudgets, MAX_FREE_BUDGETS } from '../../lib/entitlements'
import { formatCents } from '../../lib/format'
import type { Category } from '../../types/budget'

interface Props {
  onBack: () => void
}

const EXPENSE_KINDS = new Set<Category['kind']>(['fixed', 'variable'])

const FILL_CLASS: Record<BudgetHealth, string> = {
  ok: '',
  warn: 'budget-row__fill--warn',
  over: 'budget-row__fill--over',
}

const SPENT_CLASS: Record<BudgetHealth, string> = {
  ok: '',
  warn: 'budget-row__spent--warn',
  over: 'budget-row__spent--over',
}

export function BudgetsView({ onBack }: Props) {
  const categories = useBudgetStore((s) => s.categories)
  const transactions = useBudgetStore((s) => s.transactions)
  const settings = useBudgetStore((s) => s.settings)
  const updateCategory = useBudgetStore((s) => s.updateCategory)
  const key = currentMonthId()

  const stats = monthlyCategoryStats(transactions, categories, key)
  const spentById = new Map(stats.map((s) => [s.categoryId, s.spent]))

  const budgetCats = categories.filter((c) => EXPENSE_KINDS.has(c.kind))
  const budgetedCount = budgetCats.filter((c) => c.budget != null && c.budget > 0).length
  const limit = maxBudgets(settings)
  const atLimit = budgetedCount >= limit

  return (
    <div className="view-stack">
      <BackBar onBack={onBack} />

      <Card>
        <SectionTitle title="Budgets" hint="Monatliche Limits je Kategorie" />
        {!isPlus(settings) && (
          <p className="notice" style={{ marginTop: 'var(--space-2)' }}>
            Gratis sind {MAX_FREE_BUDGETS} Budgets aktiv ({budgetedCount}/{MAX_FREE_BUDGETS}).
            Unbegrenzte Budgets gibt es mit <span className="plus-badge">Plus</span>.
          </p>
        )}
      </Card>

      {budgetCats.length === 0 ? (
        <Card>
          <div className="empty">
            <h2 className="empty__title">Noch keine Kategorien</h2>
            <p className="empty__text">
              Importiere unter „Buchungen" einen Bankauszug — danach kannst du hier für jede
              Ausgaben-Kategorie ein Limit setzen und wirst rechtzeitig gewarnt.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="budget-list">
            {budgetCats.map((c) => {
              const spent = spentById.get(c.id) ?? 0
              const hasBudget = c.budget != null && c.budget > 0
              const status = budgetStatus(spent, c.budget ?? 0)
              const ratio = status.budget > 0 ? Math.min(1, status.ratio) : 0
              const locked = atLimit && !hasBudget

              return (
                <div key={c.id} className="budget-row">
                  <div className="budget-row__head-edit">
                    <span className="budget-row__label">{c.label}</span>
                    <CentInput
                      value={c.budget}
                      disabled={locked}
                      ariaLabel={`Monatsbudget ${c.label}`}
                      onCommit={(cents) =>
                        updateCategory(c.id, { budget: cents && cents > 0 ? cents : null })
                      }
                    />
                  </div>
                  {hasBudget && (
                    <>
                      <div className="budget-row__track">
                        <div
                          className={`budget-row__fill ${FILL_CLASS[status.health]}`}
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </div>
                      <p className={`budget-row__spent ${SPENT_CLASS[status.health]}`}>
                        {formatCents(spent)} von {formatCents(status.budget)}
                        {status.health === 'over' && ' — überschritten'}
                        {status.health === 'warn' && ' — fast erreicht'}
                      </p>
                    </>
                  )}
                  {locked && (
                    <p className="budget-row__spent">Mit Plus kannst du weitere Budgets setzen.</p>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
