import { usePlanStore } from '../../store/planStore'
import type { Plan } from '../../lib/plan'
import { EXCLUDED, OTHER_INCOME, SAVINGS, type PlanTarget } from '../../lib/planMatch'
import type { Transaction } from '../../types/budget'
import { formatCents } from '../../lib/format'

interface TransactionMoveListProps {
  transactions: Transaction[]
  /** Aktuelles Ziel aller Buchungen dieser Liste. */
  current: PlanTarget
}

/** „8.10." aus „2026-10-08" */
function dayMonth(iso: string): string {
  return `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`
}

function optionGroups(plan: Plan) {
  const named = (label: string, fallback: string) => label.trim() || fallback
  return [
    { label: 'Einnahmen', items: plan.income.map((i) => ({ value: i.id, label: named(i.label, 'Einnahme') })) },
    { label: 'Feste Abzüge', items: plan.fixed.map((i) => ({ value: i.id, label: named(i.label, 'Abzug') })) },
    { label: 'Variable Ausgaben', items: plan.variable.map((i) => ({ value: i.id, label: named(i.label, 'Ausgabe') })) },
    {
      label: 'Sonstiges',
      items: [
        { value: SAVINGS, label: 'Sparen' },
        { value: EXCLUDED, label: 'Nicht zählen (Umbuchung)' },
      ],
    },
  ].filter((g) => g.items.length > 0)
}

/**
 * Buchungen eines Postens. Jede lässt sich in einen anderen Posten schieben;
 * die App merkt sich den Empfänger für künftige Buchungen.
 */
export function TransactionMoveList({ transactions, current }: TransactionMoveListProps) {
  const plan = usePlanStore((s) => s.plan)
  const moveTransaction = usePlanStore((s) => s.moveTransaction)
  const groups = optionGroups(plan)

  if (transactions.length === 0) {
    return <p className="plan-tx-empty">Keine Buchungen in dieser Periode.</p>
  }

  return (
    <ul className="plan-tx-list">
      {transactions.map((tx) => (
        <li key={tx.id} className="plan-tx">
          <span className="plan-tx__date tnum">{dayMonth(tx.date)}</span>
          <span className="plan-tx__name" title={tx.purpose}>
            {tx.counterparty || tx.purpose || 'Ohne Empfänger'}
          </span>
          <span className={`plan-tx__amount tnum${tx.amount > 0 ? ' text-positive' : ''}`}>
            {formatCents(tx.amount)}
          </span>
          <select
            className="plan-tx__move"
            value={current}
            aria-label={`${tx.counterparty || 'Buchung'} verschieben`}
            onChange={(e) => moveTransaction(tx, e.target.value)}
          >
            {!groups.some((g) => g.items.some((i) => i.value === current)) && (
              <option value={current}>{current === OTHER_INCOME ? 'Sonstige Eingänge' : 'Nicht zugeordnet'}</option>
            )}
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </li>
      ))}
    </ul>
  )
}
