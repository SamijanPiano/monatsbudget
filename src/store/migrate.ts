// Migration des persistierten Budget-States. Als reine Funktion testbar.
// Kette: v1 -> v2 (fügt `profile` hinzu) -> v3 (fügt die Transaktions-Schicht
// hinzu: transactions/categories/accounts/recurringRules). Jeder Schritt ist
// idempotent und verlustfrei — Bestandsdaten (Monate, Profil, Ziele) bleiben.

import type {
  Account,
  BudgetState,
  Category,
  CategoryKind,
  Goal,
  Month,
  UserProfile,
} from '../types/budget'
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

/** v1 -> v2: leitet `profile` aus den Bestandsdaten ab. */
function addProfile(state: BudgetState & { settings?: { savingsGoal?: number } }): BudgetState {
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

const SECTION_KIND: Record<'income' | 'fixed' | 'variable', CategoryKind> = {
  income: 'income',
  fixed: 'fixed',
  variable: 'variable',
}

/** Euro-Betrag (altes Modell) -> Cent (neues Modell), ohne Float-Drift. */
function toCents(euros: number): number {
  return Math.round((euros + Number.EPSILON) * 100)
}

/**
 * Leitet Kategorien aus den Bestands-Posten ab. Pro (Art, Label) eine Kategorie;
 * das Budget bestimmt der jeweils neueste Monat, der einen Betrag enthält.
 */
function seedCategories(months: Record<string, Month>): Category[] {
  const sortedIds = Object.keys(months).sort() // alt -> neu
  const byKey = new Map<string, Category>()
  for (const id of sortedIds) {
    const month = months[id]
    for (const section of ['income', 'fixed', 'variable'] as const) {
      for (const item of month[section]) {
        const label = item.label.trim()
        if (!label) continue
        const kind = SECTION_KIND[section]
        const key = `${kind}|${label.toLowerCase()}`
        const amount = toCents((item.konto ?? 0) + (item.bar ?? 0))
        const existing = byKey.get(key)
        if (existing) {
          // Neuerer Monat überschreibt das Budget (Iteration alt -> neu).
          if (amount > 0) existing.budget = amount
        } else {
          byKey.set(key, {
            id: createId(),
            label,
            kind,
            budget: amount > 0 ? amount : null,
            rules: [],
          })
        }
      }
    }
  }
  return [...byKey.values()]
}

/** v2 -> v3: ergänzt die Transaktions-Schicht (verlustfrei). */
function addTransactionLayer(state: BudgetState): BudgetState {
  const accounts: Account[] = [
    { id: createId(), name: 'Konto', type: 'checking', balance: null },
  ]
  if (state.profile?.cashEnabled) {
    accounts.push({ id: createId(), name: 'Bargeld', type: 'cash', balance: null })
  }
  return {
    ...state,
    categories: seedCategories(state.months ?? {}),
    accounts,
    transactions: [],
    recurringRules: [],
  }
}

/** Hebt persistierten State auf die aktuelle Version (3). Idempotent. */
export function migrateBudgetState(persisted: unknown, version: number): BudgetState {
  let state = persisted as BudgetState & { settings?: { savingsGoal?: number } }
  if (version < 2 || !state.profile) state = addProfile(state)
  if (version < 3 || !state.categories) state = addTransactionLayer(state)
  return state
}
