import { useMemo } from 'react'
import { useBudgetStore, sortedMonthIds } from '../../store/budgetStore'
import { calcMonth } from '../../lib/calc'
import { Card, SectionTitle } from '../ui/Card'
import { Money } from '../ui/Money'
import { TrendChart, type TrendPoint, type TrendSeries } from '../charts/TrendChart'
import { formatMonthId, formatMonthShort } from '../../lib/format'

const SERIES: TrendSeries[] = [
  { key: 'income', label: 'Einnahmen', color: 'var(--gold)' },
  { key: 'expenses', label: 'Ausgaben', color: '#c98b5e' },
  { key: 'savings', label: 'Sparen', color: 'var(--positive)' },
]

export function HistoryView() {
  const months = useBudgetStore((s) => s.months)
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth)

  const rows = useMemo(() => {
    return sortedMonthIds(months).map((id) => {
      const calc = calcMonth(months[id])
      const expenses = calc.fixedTotal + calc.variableTotal
      return {
        id,
        income: calc.incomeTotal,
        expenses,
        savings: calc.totalSavings,
        buffer: calc.bufferKonto,
      }
    })
  }, [months])

  const data: TrendPoint[] = rows.map((r) => ({
    label: formatMonthShort(r.id),
    values: { income: r.income, expenses: r.expenses, savings: r.savings },
  }))

  return (
    <div className="view-stack">
      <Card>
        <SectionTitle
          title="Verlauf"
          hint={
            rows.length > 1
              ? 'Einnahmen, Ausgaben und Sparen über die Monate'
              : 'Sobald du mehr Monate anlegst, siehst du hier den Trend'
          }
        />
        <TrendChart data={data} series={SERIES} />
      </Card>

      <Card>
        <SectionTitle title="Monatsvergleich" />
        <table className="history-table" aria-label="Monatsvergleich">
          <thead>
            <tr>
              <th scope="col">Monat</th>
              <th scope="col">Einnahmen</th>
              <th scope="col">Ausgaben</th>
              <th scope="col">Gespart</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.id}>
                <th scope="row" className="history-table__month">
                  <button
                    type="button"
                    className="history-table__link"
                    onClick={() => setActiveMonth(r.id)}
                  >
                    {formatMonthId(r.id)}
                  </button>
                </th>
                <td>
                  <Money value={r.income} tone="konto" />
                </td>
                <td>
                  <Money value={r.expenses} />
                </td>
                <td>
                  <Money value={r.savings} tone="muted" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
