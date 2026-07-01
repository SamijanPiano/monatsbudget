// Migration des persistierten Budget-States. Als reine Funktion testbar.
// Kette: v1 -> v2 (fügt `profile` hinzu) -> v3 (fügt die Transaktions-Schicht
// hinzu: transactions/categories/accounts/recurringRules) -> v4 (fügt die
// Vertrags-Schicht hinzu + ergänzt Account-Felder defensiv) -> v5 (führt das
// regelbasierte Ausgaben-Kategorien-Set ein). Jeder Schritt ist idempotent und
// verlustfrei — Bestandsdaten (Monate, Profil, Ziele) bleiben.

import type {
  Account,
  AccountType,
  BudgetState,
  Category,
  CategoryKind,
  Goal,
  Month,
  UserProfile,
} from '../types/budget'
import { createId } from '../lib/id'
import { defaultCategories } from '../lib/categorizeSeed'
import { categorizeAll, fallbackCategoryId } from '../lib/categorize'
import { LEARNING_SETTINGS_DEFAULTS } from '../lib/seed'

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

/** Konten gelten als „Schuld", wenn es Kreditkarten/Kredite sind. */
function liabilityDefault(type: AccountType): boolean {
  return type === 'credit'
}

/** Konten ohne Bank-Sync (alle außer Giro) gelten als manuell gepflegt. */
function manualDefault(type: AccountType): boolean {
  return type !== 'checking'
}

/** v3 -> v4: Vertrags-Schicht ergänzen + fehlende Account-Felder ableiten. */
function addContractLayer(state: BudgetState): BudgetState {
  const accounts = (state.accounts ?? []).map((account) => ({
    ...account,
    manual: account.manual ?? manualDefault(account.type),
    isLiability: account.isLiability ?? liabilityDefault(account.type),
  }))
  return { ...state, accounts, contracts: state.contracts ?? [] }
}

/**
 * v4 -> v5: führt das regelbasierte Ausgaben-Kategorien-Set ein.
 *
 * Die v2->v3-Ableitung erzeugte aus den manuellen Monats-Posten regellose
 * Kategorien (z. B. „Netflix", „iCloud", „Gehalt (Überweisung)") — die konnten
 * nie automatisch befüllt werden. Hier ersetzen wir diesen Auto-Müll durch das
 * Standard-Set mit echten Regeln. Verlustfrei: vom Nutzer kuratierte (mit
 * Regeln), mit gesetztem Budget oder noch referenzierte Kategorien bleiben
 * erhalten; nur regellose, budgetlose und nirgends genutzte Kategorien werden
 * entfernt. Bereits unkategorisierte Buchungen bekommen per Regel eine
 * Kategorie (Fallback „Sonstiges"); manuelle Zuordnungen bleiben unangetastet.
 */
function addSpendingCategories(state: BudgetState): BudgetState {
  const referenced = new Set<string>()
  for (const t of state.transactions ?? []) if (t.categoryId) referenced.add(t.categoryId)
  for (const r of state.recurringRules ?? []) if (r.categoryId) referenced.add(r.categoryId)
  for (const c of state.contracts ?? []) if (c.categoryId) referenced.add(c.categoryId)

  const kept = (state.categories ?? []).filter(
    (c) => c.rules.length > 0 || c.budget !== null || referenced.has(c.id),
  )
  const keptLabels = new Set(kept.map((c) => c.label.toLowerCase()))
  const additions = defaultCategories().filter(
    (c) => !keptLabels.has(c.label.toLowerCase()),
  )
  const categories = [...kept, ...additions]

  const transactions = categorizeAll(
    state.transactions ?? [],
    categories,
    fallbackCategoryId(categories),
  )
  return { ...state, categories, transactions }
}

/** v5 -> v6: ergänzt die Lern-Schicht-Schwellwerte in den Settings (verlustfrei). */
function addLearningSettings(state: BudgetState): BudgetState {
  return {
    ...state,
    settings: { ...LEARNING_SETTINGS_DEFAULTS, ...state.settings },
  }
}

/** Hebt persistierten State auf die aktuelle Version (6). Idempotent. */
export function migrateBudgetState(persisted: unknown, version: number): BudgetState {
  let state = persisted as BudgetState & { settings?: { savingsGoal?: number } }
  if (version < 2 || !state.profile) state = addProfile(state)
  if (version < 3 || !state.categories) state = addTransactionLayer(state)
  if (version < 4 || !state.contracts) state = addContractLayer(state)
  if (version < 5) state = addSpendingCategories(state)
  if (version < 6) state = addLearningSettings(state)
  return state
}
