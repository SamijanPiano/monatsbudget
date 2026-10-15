import { useMemo } from 'react'
import { useBudgetStore } from '../store/budgetStore'
import { findDuplicateCandidates, type DuplicatePair } from '../lib/duplicates'

/** Offene Duplikat-Vorschläge (ohne die als „kein Duplikat" markierten). */
export function useDuplicatePairs(): DuplicatePair[] {
  const transactions = useBudgetStore((s) => s.transactions)
  const dismissed = useBudgetStore((s) => s.dismissedDuplicates)
  return useMemo(() => findDuplicateCandidates(transactions, dismissed), [transactions, dismissed])
}
