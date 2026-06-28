import { useBudgetStore } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { Donut, type DonutSegment } from '../charts/Donut'
import { GoalCard } from '../goals/GoalCard'
import { DisposableHero } from '../transactions/DisposableHero'
import { formatCents } from '../../lib/format'
import { currentMonthId } from '../../lib/seed'
import { sumForMonth } from '../../lib/forecast'
import { monthlyCategoryStats } from '../../lib/summary'

const PALETTE = [
  'var(--gold)',
  '#c98b5e',
  'var(--bar)',
  'var(--positive)',
  '#b58df0',
  '#e0a0a0',
  '#8fb0d8',
]

export function Dashboard() {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const goals = useBudgetStore((s) => s.profile.goals)
  const key = currentMonthId()

  const summary = sumForMonth(transactions, key)
  const stats = monthlyCategoryStats(transactions, categories, key)
  const spendStats = stats.filter((s) => s.spent > 0)
  const budgetStats = stats.filter((s) => s.budget !== null && s.budget > 0)

  const segments: DonutSegment[] = spendStats.map((s, i) => ({
    label: s.label,
    value: s.spent,
    color: PALETTE[i % PALETTE.length],
  }))

  const goalsCard = goals.length > 0 && (
    <Card>
      <SectionTitle title="Deine Ziele" />
      <div className="goals-list">
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} />
        ))}
      </div>
    </Card>
  )

  if (transactions.length === 0) {
    return (
      <div className="view-stack">
        <DisposableHero />
        <Card>
          <div className="empty">
            <h2 className="empty__title">Noch keine Auswertung</h2>
            <p className="empty__text">
              Importiere unter „Konto" deinen ersten Bankauszug — danach erscheinen
              hier deine Ausgaben-Aufteilung und der Budget-Vergleich automatisch.
            </p>
          </div>
        </Card>
        {goalsCard}
      </div>
    )
  }

  return (
    <div className="view-stack">
      <DisposableHero />

      <Card>
        <SectionTitle title="Diesen Monat" />
        <div className="result-list">
          <div className="result-row">
            <span>Einnahmen</span>
            <span className="tnum text-positive">{formatCents(summary.income)}</span>
          </div>
          <div className="result-row">
            <span>Ausgaben</span>
            <span className="tnum text-negative">{formatCents(summary.expenses)}</span>
          </div>
          <div className="result-row result-row--total">
            <span>Saldo</span>
            <span className={`tnum ${summary.net < 0 ? 'text-negative' : 'text-positive'}`}>
              {formatCents(summary.net)}
            </span>
          </div>
        </div>
      </Card>

      {segments.length > 0 && (
        <Card>
          <SectionTitle title="Wohin geht dein Geld?" hint="Ausgaben nach Kategorie" />
          <div className="allocation">
            <Donut
              segments={segments}
              center={
                <div className="donut__label">
                  <span className="donut__label-sub">Ausgaben</span>
                  <span className="donut__label-value tnum">{formatCents(summary.expenses)}</span>
                </div>
              }
            />
            <ul className="allocation__legend" aria-label="Ausgaben nach Kategorie">
              {segments.map((s) => (
                <li key={s.label}>
                  <span className="allocation__dot" style={{ background: s.color }} aria-hidden="true" />
                  <span className="allocation__name">{s.label}</span>
                  <span className="allocation__value tnum">{formatCents(s.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {budgetStats.length > 0 && (
        <Card>
          <SectionTitle title="Budgets" hint="Geplant vs. ausgegeben" />
          <div className="budget-list">
            {budgetStats.map((s) => {
              const budget = s.budget ?? 0
              const ratio = budget > 0 ? Math.min(1, s.spent / budget) : 0
              const over = s.spent > budget
              return (
                <div key={s.categoryId ?? 'un'} className="budget-row">
                  <div className="budget-row__head">
                    <span className="budget-row__label">{s.label}</span>
                    <span className={`budget-row__nums tnum ${over ? 'text-negative' : 'text-muted'}`}>
                      {formatCents(s.spent)} / {formatCents(budget)}
                    </span>
                  </div>
                  <div className="budget-row__track">
                    <div
                      className={`budget-row__fill ${over ? 'budget-row__fill--over' : ''}`}
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {goalsCard}
    </div>
  )
}
