// Globaler State (Zustand) mit automatischer Persistenz in localStorage.
// Alle Mutationen erzeugen neue Objekte (immutable).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Account,
  BudgetState,
  Category,
  Contract,
  Goal,
  LineItem,
  Month,
  Settings,
} from '../types/budget'
import { createId } from '../lib/id'
import { DEFAULT_SETTINGS, copyMonth, createBlankMonth, currentMonthId } from '../lib/seed'
import { migrateBudgetState } from './migrate'
import type { OnboardingResult } from '../lib/onboarding'
import type { ParsedTransaction } from '../lib/import/types'
import { buildImportedTransactions } from '../lib/ingest'
import { detectRecurring } from '../lib/recurring'
import { contractsFromRecurring } from '../lib/contracts'
import { learnRule, categorizeAll } from '../lib/categorize'
import { defaultCategories } from '../lib/categorizeSeed'
import { aiCategorize as apiAiCategorize } from '../lib/bankApi'
import { getSyncConfig } from '../lib/syncConfig'

export type Section = 'income' | 'fixed' | 'variable'

const STORAGE_KEY = 'monatsbudget-v1'

const DEFAULT_LABELS: Record<Section, string> = {
  income: 'Einnahme',
  fixed: 'Abo / Abzug',
  variable: 'Ausgabe',
}

interface BudgetActions {
  setActiveMonth: (id: string) => void
  createMonth: (id: string, mode: 'blank' | 'copy', sourceId?: string) => void
  deleteMonth: (id: string) => void
  resetMonth: (id: string) => void
  addItem: (section: Section) => void
  updateItem: (section: Section, itemId: string, patch: Partial<LineItem>) => void
  removeItem: (section: Section, itemId: string) => void
  setSavings: (channel: 'konto' | 'bar', value: number) => void
  setCurrent: (channel: 'konto' | 'bar', value: number) => void
  updateSettings: (patch: Partial<Settings>) => void
  setCashEnabled: (value: boolean) => void
  completeOnboarding: (result: OnboardingResult) => void
  restartOnboarding: () => void
  addGoal: (goal: Goal) => void
  updateGoal: (id: string, patch: Partial<Goal>) => void
  removeGoal: (id: string) => void
  replaceState: (
    next: Pick<BudgetState, 'months' | 'activeMonthId' | 'settings'> &
      Partial<
        Pick<BudgetState, 'transactions' | 'categories' | 'accounts' | 'recurringRules' | 'contracts'>
      >,
  ) => void
  // Transaktions-Schicht (v3)
  importParsed: (parsed: ParsedTransaction[], accountId?: string) => number
  setTransactionCategory: (txId: string, categoryId: string | null) => void
  addCategory: (category: Category) => void
  updateCategory: (id: string, patch: Partial<Category>) => void
  removeCategory: (id: string) => void
  setAccountBalance: (accountId: string, balance: number | null) => void
  aiCategorize: () => Promise<void>
  // Konten (v4)
  addAccount: (account: Omit<Account, 'id'>) => void
  updateAccount: (id: string, patch: Partial<Account>) => void
  removeAccount: (id: string) => void
  // Verträge (v4)
  addContract: (contract: Omit<Contract, 'id'>) => void
  updateContract: (id: string, patch: Partial<Contract>) => void
  removeContract: (id: string) => void
  markContractCanceled: (id: string) => void
  syncContractsFromRecurring: () => void
}

export type BudgetStore = BudgetState & BudgetActions

function initialState(): BudgetState {
  const id = currentMonthId()
  return {
    months: { [id]: createBlankMonth(id) },
    activeMonthId: id,
    settings: { ...DEFAULT_SETTINGS },
    profile: { onboarded: false, cashEnabled: false, goals: [] },
    transactions: [],
    categories: defaultCategories(),
    accounts: [
      { id: createId(), name: 'Konto', type: 'checking', balance: null, manual: false, isLiability: false },
    ],
    recurringRules: [],
    contracts: [],
  }
}

/** Wendet eine Änderung auf den aktiven Monat an und gibt neue months zurück. */
function patchActiveMonth(
  state: BudgetState,
  update: (month: Month) => Month,
): Pick<BudgetState, 'months'> {
  const current = state.months[state.activeMonthId]
  if (!current) return { months: state.months }
  return {
    months: { ...state.months, [state.activeMonthId]: update(current) },
  }
}

/** Schreibt die Onboarding-Schnellstart-Werte in den aktiven Monat (immutable). */
function applyQuickStart(month: Month, result: OnboardingResult): Month {
  if (result.income <= 0 && result.expenses.length === 0) return month
  const income: LineItem[] =
    result.income > 0
      ? [{ id: createId(), label: 'Einkommen', konto: result.income, bar: 0 }]
      : month.income
  const variable: LineItem[] =
    result.expenses.length > 0
      ? result.expenses.map((e) => ({ id: createId(), label: e.label, konto: e.amount, bar: 0 }))
      : month.variable
  return { ...month, income, variable }
}

export const useBudgetStore = create<BudgetStore>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setActiveMonth: (id) =>
        set((state) => {
          if (state.months[id]) return { activeMonthId: id }
          // Monat existiert noch nicht -> leer anlegen
          return {
            activeMonthId: id,
            months: { ...state.months, [id]: createBlankMonth(id) },
          }
        }),

      createMonth: (id, mode, sourceId) =>
        set((state) => {
          if (state.months[id]) return { activeMonthId: id }
          const source = sourceId ? state.months[sourceId] : undefined
          const month =
            mode === 'copy' && source ? copyMonth(source, id) : createBlankMonth(id)
          return {
            months: { ...state.months, [id]: month },
            activeMonthId: id,
          }
        }),

      deleteMonth: (id) =>
        set((state) => {
          const months: Record<string, Month> = {}
          for (const key of Object.keys(state.months)) {
            if (key !== id) months[key] = state.months[key]
          }
          const remaining = Object.keys(months).sort()
          if (remaining.length === 0) {
            // Nie ganz leer: einen leeren Monat behalten
            return { months: { [id]: createBlankMonth(id) }, activeMonthId: id }
          }
          const nextActive =
            state.activeMonthId === id ? remaining[remaining.length - 1] : state.activeMonthId
          return { months, activeMonthId: nextActive }
        }),

      resetMonth: (id) =>
        set((state) => ({
          months: { ...state.months, [id]: createBlankMonth(id) },
        })),

      addItem: (section) =>
        set((state) =>
          patchActiveMonth(state, (month) => {
            const item: LineItem = {
              id: createId(),
              label: DEFAULT_LABELS[section],
              konto: 0,
              bar: 0,
            }
            return { ...month, [section]: [...month[section], item] }
          }),
        ),

      updateItem: (section, itemId, patch) =>
        set((state) =>
          patchActiveMonth(state, (month) => ({
            ...month,
            [section]: month[section].map((item) =>
              item.id === itemId ? { ...item, ...patch } : item,
            ),
          })),
        ),

      removeItem: (section, itemId) =>
        set((state) =>
          patchActiveMonth(state, (month) => ({
            ...month,
            [section]: month[section].filter((item) => item.id !== itemId),
          })),
        ),

      setSavings: (channel, value) =>
        set((state) =>
          patchActiveMonth(state, (month) => ({
            ...month,
            [channel === 'konto' ? 'savingsKonto' : 'savingsBar']: value,
          })),
        ),

      setCurrent: (channel, value) =>
        set((state) =>
          patchActiveMonth(state, (month) => ({
            ...month,
            [channel === 'konto' ? 'currentKonto' : 'currentBar']: value,
          })),
        ),

      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      setCashEnabled: (value) =>
        set((state) => {
          const hasCash = state.accounts.some((a) => a.type === 'cash')
          const accounts =
            value && !hasCash
              ? [...state.accounts, { id: createId(), name: 'Bargeld', type: 'cash' as const, balance: null }]
              : state.accounts
          return { accounts, profile: { ...state.profile, cashEnabled: value } }
        }),

      completeOnboarding: (result) =>
        set((state) => {
          const id = state.activeMonthId
          const current = state.months[id]
          const month = current ? applyQuickStart(current, result) : current
          return {
            profile: {
              ...state.profile,
              onboarded: true,
              cashEnabled: result.cashEnabled,
              goals: result.goals,
            },
            months: month ? { ...state.months, [id]: month } : state.months,
          }
        }),

      restartOnboarding: () =>
        set((state) => ({ profile: { ...state.profile, onboarded: false } })),

      addGoal: (goal) =>
        set((state) => ({ profile: { ...state.profile, goals: [...state.profile.goals, goal] } })),

      updateGoal: (id, patch) =>
        set((state) => ({
          profile: {
            ...state.profile,
            goals: state.profile.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
          },
        })),

      removeGoal: (id) =>
        set((state) => ({
          profile: { ...state.profile, goals: state.profile.goals.filter((g) => g.id !== id) },
        })),

      replaceState: (next) =>
        set((state) => ({
          months: next.months,
          activeMonthId: next.activeMonthId,
          settings: { ...DEFAULT_SETTINGS, ...next.settings },
          profile: state.profile,
          transactions: next.transactions ?? state.transactions,
          categories: next.categories ?? state.categories,
          accounts: next.accounts ?? state.accounts,
          recurringRules: next.recurringRules ?? state.recurringRules,
          contracts: next.contracts ?? state.contracts,
        })),

      importParsed: (parsed, accountId) => {
        let count = 0
        set((state) => {
          const categories =
            state.categories.length > 0 ? state.categories : defaultCategories()
          const checking = state.accounts.find((a) => a.type === 'checking')
          const accId = accountId ?? checking?.id ?? state.accounts[0]?.id
          if (!accId) return {}
          const news = buildImportedTransactions(parsed, {
            accountId: accId,
            categories,
            existing: state.transactions,
          })
          count = news.length
          if (news.length === 0 && categories === state.categories) return {}
          const merged = [...state.transactions, ...news]
          const transactions = categorizeAll(merged, categories)
          return { categories, transactions, recurringRules: detectRecurring(transactions) }
        })
        return count
      },

      setTransactionCategory: (txId, categoryId) =>
        set((state) => {
          const tx = state.transactions.find((t) => t.id === txId)
          if (!tx) return {}
          const transactions = state.transactions.map((t) =>
            t.id === txId ? { ...t, categoryId } : t,
          )
          // Lernen nur beim Setzen einer Kategorie, nicht beim Entfernen.
          const categories = categoryId
            ? learnRule(state.categories, categoryId, tx.counterparty)
            : state.categories
          // Rückwirkend alle noch unkategorisierten Buchungen mit neuen Regeln zuordnen.
          const recategorized = categorizeAll(transactions, categories)
          return { transactions: recategorized, categories }
        }),

      addCategory: (category) =>
        set((state) => ({ categories: [...state.categories, category] })),

      updateCategory: (id, patch) =>
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
          // Buchungen dieser Kategorie werden wieder „unkategorisiert".
          transactions: state.transactions.map((t) =>
            t.categoryId === id ? { ...t, categoryId: null } : t,
          ),
        })),

      setAccountBalance: (accountId, balance) =>
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === accountId ? { ...a, balance } : a)),
        })),

      aiCategorize: async () => {
        const state = get()
        const uncategorized = state.transactions.filter((t) => t.categoryId === null)
        if (uncategorized.length === 0) return
        const cfg = getSyncConfig()
        if (!cfg) return
        try {
          const payload = uncategorized.map((t) => ({
            id: t.id,
            counterparty: t.counterparty,
            purpose: t.purpose,
            amount: t.amount,
          }))
          const catPayload = state.categories.map((c) => ({ id: c.id, label: c.label }))
          const assignments = await apiAiCategorize(cfg, payload, catPayload)
          const map = new Map(
            assignments.filter((a) => a.categoryId !== null).map((a) => [a.id, a.categoryId!]),
          )
          if (map.size === 0) return
          set((s) => ({
            transactions: s.transactions.map((t) => {
              const newCat = map.get(t.id)
              if (newCat && t.categoryId === null) return { ...t, categoryId: newCat }
              return t
            }),
          }))
        } catch {
          // Best-effort; silently ignore failures
        }
      },

      addAccount: (account) =>
        set((state) => ({ accounts: [...state.accounts, { ...account, id: createId() }] })),

      updateAccount: (id, patch) =>
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),

      removeAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
          // Buchungen verwaisen nicht still: Verweis bleibt, wird in der UI als
          // „unbekanntes Konto" behandelt. Keine Transaktion wird gelöscht.
        })),

      addContract: (contract) =>
        set((state) => ({ contracts: [...state.contracts, { ...contract, id: createId() }] })),

      updateContract: (id, patch) =>
        set((state) => ({
          contracts: state.contracts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeContract: (id) =>
        set((state) => ({ contracts: state.contracts.filter((c) => c.id !== id) })),

      markContractCanceled: (id) =>
        set((state) => ({
          contracts: state.contracts.map((c) =>
            c.id === id ? { ...c, status: 'canceled' } : c,
          ),
        })),

      syncContractsFromRecurring: () =>
        set((state) => ({
          contracts: contractsFromRecurring(state.recurringRules, state.contracts),
        })),
    }),
    {
      name: STORAGE_KEY,
      version: 4,
      migrate: (persisted, version) => migrateBudgetState(persisted, version),
    },
  ),
)

/** Sortierte Monats-IDs (neueste zuletzt). */
export function sortedMonthIds(months: Record<string, Month>): string[] {
  return Object.keys(months).sort()
}

export function useCashEnabled(): boolean {
  return useBudgetStore((s) => s.profile.cashEnabled)
}
