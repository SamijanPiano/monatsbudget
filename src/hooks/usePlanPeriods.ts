import { useMemo } from 'react'
import { useBudgetStore } from '../store/budgetStore'
import { usePlanStore } from '../store/planStore'
import { assignToPlan, salaryDates, type MatchInput } from '../lib/planMatch'
import { listPeriods } from '../lib/period'
import { todayIso } from '../lib/euro'

/**
 * Verbindet Buchungen (budgetStore) mit dem Monatsplan (planStore): Zuordnung
 * jeder Buchung zu einem Posten und die Liste der Gehalts-Perioden.
 */
export function usePlanPeriods() {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const recurring = useBudgetStore((s) => s.recurringRules)
  const plan = usePlanStore((s) => s.plan)
  const overrides = usePlanStore((s) => s.overrides)

  const input: MatchInput = useMemo(
    () => ({ transactions, categories, recurring, plan, overrides }),
    [transactions, categories, recurring, plan, overrides],
  )
  const assignments = useMemo(() => assignToPlan(input), [input])

  const periods = useMemo(() => {
    const earliest = transactions.reduce<string | null>(
      (min, t) => (min === null || t.date < min ? t.date : min),
      null,
    )
    return listPeriods(salaryDates(input, assignments), todayIso(), earliest)
  }, [input, assignments, transactions])

  return { input, assignments, periods }
}
