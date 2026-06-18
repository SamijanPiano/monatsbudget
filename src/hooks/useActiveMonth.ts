import { useMemo } from 'react'
import { useBudgetStore } from '../store/budgetStore'
import { calcMonth, calcSituation } from '../lib/calc'

/** Liefert den aktiven Monat samt abgeleiteten Werten und „Reicht es?"-Ergebnis. */
export function useActiveMonth() {
  const activeMonthId = useBudgetStore((s) => s.activeMonthId)
  const month = useBudgetStore((s) => s.months[s.activeMonthId])

  const calc = useMemo(() => calcMonth(month), [month])
  const situation = useMemo(() => calcSituation(month, calc), [month, calc])

  return { activeMonthId, month, calc, situation }
}
