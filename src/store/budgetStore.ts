// Globaler State (Zustand) mit automatischer Persistenz in localStorage.
// Alle Mutationen erzeugen neue Objekte (immutable).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BudgetState, Goal, LineItem, Month, Settings } from '../types/budget'
import { createId } from '../lib/id'
import { DEFAULT_SETTINGS, copyMonth, createBlankMonth, currentMonthId } from '../lib/seed'
import { migrateBudgetState } from './migrate'
import type { OnboardingResult } from '../lib/onboarding'

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
  replaceState: (next: Pick<BudgetState, 'months' | 'activeMonthId' | 'settings'>) => void
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
    categories: [],
    accounts: [],
    recurringRules: [],
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
    (set) => ({
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
        set((state) => ({ profile: { ...state.profile, cashEnabled: value } })),

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
          transactions: state.transactions,
          categories: state.categories,
          accounts: state.accounts,
          recurringRules: state.recurringRules,
        })),
    }),
    {
      name: STORAGE_KEY,
      version: 3,
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
