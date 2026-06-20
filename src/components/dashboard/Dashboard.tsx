import { useActiveMonth } from '../../hooks/useActiveMonth'
import { useBudgetStore, useCashEnabled } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { Money } from '../ui/Money'
import { StatusBanner } from './StatusBanner'
import { KpiCard } from './KpiCard'
import { Donut, type DonutSegment } from '../charts/Donut'
import { GoalCard } from '../goals/GoalCard'
import { formatMoney } from '../../lib/format'

export function Dashboard() {
  const { month, calc, situation } = useActiveMonth()
  const cashEnabled = useCashEnabled()
  const goals = useBudgetStore((s) => s.profile.goals)

  const totalExpenses = calc.fixedTotal + calc.variableTotal
  const leftover = calc.incomeTotal - totalExpenses - calc.totalSavings

  const segments: DonutSegment[] = [
    { label: 'Feste Abzüge', value: calc.fixedTotal, color: 'var(--gold)' },
    { label: 'Variable Ausgaben', value: calc.variableTotal, color: '#c98b5e' },
    { label: 'Sparen', value: calc.totalSavings, color: 'var(--positive)' },
    { label: 'Frei übrig', value: Math.max(0, leftover), color: 'var(--bar)' },
  ]

  return (
    <div className="view-stack">
      <StatusBanner situation={situation} currentKonto={month.currentKonto} />

      {goals.length > 0 && (
        <Card>
          <SectionTitle title="Deine Ziele" />
          <div className="goals-list">
            {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>
        </Card>
      )}

      <div className="kpi-grid">
        <KpiCard
          label="Einnahmen"
          value={calc.incomeTotal}
          accent="gold"
          sub={cashEnabled ? `Konto ${formatMoney(calc.incomeKonto)} · Bar ${formatMoney(calc.incomeBar)}` : undefined}
        />
        <KpiCard
          label="Ausgaben"
          value={totalExpenses}
          accent="negative"
          sub={`Fix ${formatMoney(calc.fixedTotal)} · Variabel ${formatMoney(calc.variableTotal)}`}
        />
        <KpiCard label="Gespart" value={calc.totalSavings} accent="positive" />
        <KpiCard
          label="Frei verfügbar"
          value={leftover}
          signed
          accent="bar"
          sub="Einnahmen − Ausgaben − Sparen"
        />
      </div>

      <Card>
        <SectionTitle title="Wohin geht dein Geld?" hint="Aufteilung deiner Einnahmen" />
        <div className="allocation">
          <Donut
            segments={segments}
            center={
              <div className="donut__label">
                <span className="donut__label-sub">Einnahmen</span>
                <span className="donut__label-value tnum">
                  {formatMoney(calc.incomeTotal)}
                </span>
              </div>
            }
          />
          <ul className="allocation__legend" aria-label="Budgetaufteilung">
            {segments.map((s) => (
              <li key={s.label}>
                <span
                  className="allocation__dot"
                  style={{ background: s.color }}
                  aria-hidden="true"
                />
                <span className="allocation__name">{s.label}</span>
                <Money value={s.value} className="allocation__value" />
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="channel-grid">
        <Card>
          <SectionTitle title="Konto" />
          <div className="result-list">
            <div className="result-row">
              <span>Einnahmen</span>
              <Money value={cashEnabled ? calc.incomeKonto : calc.incomeTotal} tone="konto" />
            </div>
            <div className="result-row">
              <span>− Feste Abzüge</span>
              <Money value={calc.fixedTotal} />
            </div>
            <div className="result-row">
              <span>− Variable Ausgaben</span>
              <Money value={cashEnabled ? calc.variableKonto : calc.variableTotal} />
            </div>
            <div className="result-row result-row--total">
              <span>Nach Abzügen</span>
              <Money value={calc.kontoAfterDeductions} signed />
            </div>
          </div>
        </Card>

        {cashEnabled && (
          <Card>
            <SectionTitle title="Bar" />
            <div className="result-list">
              <div className="result-row">
                <span>Einnahmen</span>
                <Money value={calc.incomeBar} tone="bar" />
              </div>
              <div className="result-row">
                <span>− Variable Ausgaben</span>
                <Money value={calc.variableBar} />
              </div>
              <div className="result-row result-row--total">
                <span>Nach Ausgaben</span>
                <Money value={calc.barAfterExpenses} signed />
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
