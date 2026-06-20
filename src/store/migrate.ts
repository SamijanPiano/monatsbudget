// Migration des persistierten Budget-States. Als reine Funktion testbar.
import type { BudgetState, Goal, Month, UserProfile } from '../types/budget'
import { createId } from '../lib/id'

function monthHasValues(month: Month): boolean {
  const lines = [...month.income, ...month.fixed, ...month.variable]
  if (lines.some((i) => i.konto !== 0 || i.bar !== 0)) return true
  return (
    month.savingsKonto !== 0 || month.savingsBar !== 0 ||
    month.currentKonto !== 0 || month.currentBar !== 0
  )
}

function monthHasBar(month: Month): boolean {
  const lines = [...month.income, ...month.fixed, ...month.variable]
  return lines.some((i) => i.bar !== 0) || month.savingsBar !== 0 || month.currentBar !== 0
}

/** Hebt persistierten State auf Version 2 (fügt `profile` hinzu). Idempotent. */
export function migrateBudgetState(persisted: unknown, version: number): BudgetState {
  const state = persisted as BudgetState & { settings?: { savingsGoal?: number } }
  if (version >= 2 && state.profile) return state

  const months = state.months ?? {}
  const monthList = Object.values(months)
  const onboarded = monthList.some(monthHasValues)
  const cashEnabled = monthList.some(monthHasBar)

  const goals: Goal[] = []
  const legacyGoal = state.settings?.savingsGoal ?? 0
  if (legacyGoal > 0) {
    goals.push({
      id: createId(),
      type: 'buffer',
      label: 'Sparziel',
      targetAmount: legacyGoal,
      currentAmount: 0,
      createdAt: new Date().toISOString(),
    })
  }

  const profile: UserProfile = { onboarded, cashEnabled, goals }
  return { ...state, profile }
}
