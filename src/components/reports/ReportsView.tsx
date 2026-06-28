import { useState } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { BackBar } from '../ui/BackBar'
import { Donut, type DonutSegment } from '../charts/Donut'
import { TrendChart, type TrendPoint } from '../charts/TrendChart'
import { categoryTotals, monthlySeries } from '../../lib/reports'
import { averageMonthlyNet, projectSavings } from '../../lib/forecast'
import { maxHistoryMonths, isPlus } from '../../lib/entitlements'
import { currentMonthId } from '../../lib/seed'
import { formatCents, formatMonthShort, shiftMonthId } from '../../lib/format'

interface Props {
  onBack: () => void
}

const PERIODS = [3, 6, 12] as const

const PALETTE = [
  'var(--gold)',
  '#c98b5e',
  'var(--bar)',
  'var(--positive)',
  '#b58df0',
  '#e0a0a0',
  '#8fb0d8',
]

const TREND_SERIES = [
  { key: 'income', label: 'Einnahmen', color: 'var(--positive)' },
  { key: 'expenses', label: 'Ausgaben', color: 'var(--negative)' },
]

export function ReportsView({ onBack }: Props) {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const settings = useBudgetStore((s) => s.settings)
  const [months, setMonths] = useState(3)

  const allowedMonths = maxHistoryMonths(settings)
  const toKey = currentMonthId()
  const fromKey = shiftMonthId(toKey, -(months - 1))

  const totals = categoryTotals(transactions, categories, fromKey, toKey)
  const series = monthlySeries(transactions, fromKey, toKey)
  const totalSpent = totals.reduce((acc, t) => acc + t.total, 0)
  const avgNet = averageMonthlyNet(series)
  const projected = projectSavings(avgNet, months)

  // Top-6 Kategorien einzeln, der Rest gebündelt als „Sonstige".
  const top = totals.slice(0, 6)
  const rest = totals.slice(6).reduce((acc, t) => acc + t.total, 0)
  const segments: DonutSegment[] = top.map((t, i) => ({
    label: t.label,
    value: t.total,
    color: PALETTE[i % PALETTE.length],
  }))
  if (rest > 0) segments.push({ label: 'Sonstige', value: rest, color: 'var(--surface-hover)' })

  const trendData: TrendPoint[] = series.map((p) => ({
    label: formatMonthShort(p.key),
    values: { income: p.income, expenses: p.expenses },
  }))

  return (
    <div className="view-stack">
      <BackBar onBack={onBack} />

      <Card>
        <SectionTitle title="Berichte" hint="Wofür dein Geld über die Zeit geht" />
        <div className="segmented" role="group" aria-label="Zeitraum">
          {PERIODS.map((p) => {
            const locked = p > allowedMonths
            return (
              <button
                key={p}
                type="button"
                className={`segmented__btn ${months === p ? 'is-active' : ''}`}
                aria-pressed={months === p}
                disabled={locked}
                onClick={() => setMonths(p)}
              >
                {p} Monate{locked ? ' 🔒' : ''}
              </button>
            )
          })}
        </div>
        {!isPlus(settings) && (
          <p className="notice" style={{ marginTop: 'var(--space-3)' }}>
            Gratis siehst du bis zu 3 Monate. Längere Historie gibt es mit{' '}
            <span className="plus-badge">Plus</span>.
          </p>
        )}
      </Card>

      {transactions.length === 0 ? (
        <Card>
          <div className="empty">
            <h2 className="empty__title">Noch keine Auswertung</h2>
            <p className="empty__text">
              Sobald du unter „Konto" Umsätze importiert hast, erscheinen hier deine
              Ausgaben nach Kategorie und der Monatsverlauf.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {segments.length > 0 && (
            <Card>
              <SectionTitle title="Ausgaben nach Kategorie" hint={`${months} Monate`} />
              <div className="allocation">
                <Donut
                  segments={segments}
                  center={
                    <div className="donut__label">
                      <span className="donut__label-sub">Gesamt</span>
                      <span className="donut__label-value tnum">{formatCents(totalSpent)}</span>
                    </div>
                  }
                />
                <ul className="allocation__legend" aria-label="Ausgaben nach Kategorie">
                  {segments.map((s) => (
                    <li key={s.label}>
                      <span
                        className="allocation__dot"
                        style={{ background: s.color }}
                        aria-hidden="true"
                      />
                      <span className="allocation__name">{s.label}</span>
                      <span className="allocation__value tnum">{formatCents(s.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle title="Monatsverlauf" hint="Einnahmen vs. Ausgaben" />
            <TrendChart data={trendData} series={TREND_SERIES} />
          </Card>

          <Card>
            <SectionTitle title="Sparprognose" hint={`Hochrechnung auf ${months} Monate`} />
            {isPlus(settings) ? (
              <div className="result-list">
                <div className="result-row">
                  <span>Ø Netto pro Monat</span>
                  <span className={`tnum ${avgNet < 0 ? 'text-negative' : 'text-positive'}`}>
                    {formatCents(avgNet)}
                  </span>
                </div>
                <div className="result-row result-row--total">
                  <span>Voraussichtlich gespart</span>
                  <span className={`tnum ${projected < 0 ? 'text-negative' : 'text-positive'}`}>
                    {formatCents(projected)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="notice">
                Die Sparprognose zeigt, wie viel du voraussichtlich ansparst — eine{' '}
                <span className="plus-badge">Plus</span>-Funktion.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
