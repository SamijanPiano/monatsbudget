// Globaler State (Zustand) mit automatischer Persistenz in localStorage.
// Alle Mutationen erzeugen neue Objekte (immutable).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BudgetState, LineItem, Month, Settings } from '../types/budget'
import { createId } from '../lib/id'
import { DEFAULT_SETTINGS, copyMonth, createBlankMonth, currentMonthId } from '../lib/seed'

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
  replaceState: (next: Pick<BudgetState, 'months' | 'activeMonthId' | 'settings'>) => void
}

export type BudgetStore = BudgetState & BudgetActions

function initialState(): BudgetState {
  const id = currentMonthId()
  return {
    months: { [id]: createBlankMonth(id) },
    activeMonthId: id,
    settings: { ...DEFAULT_SETTINGS },
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

      replaceState: (next) =>
        set(() => ({
          months: next.months,
          activeMonthId: next.activeMonthId,
          settings: { ...DEFAULT_SETTINGS, ...next.settings },
        })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      // Migrationspfad für künftige Schemaänderungen (aktuell unverändert).
      migrate: (persisted) => persisted as BudgetState,
    },
  ),
)

/** Sortierte Monats-IDs (neueste zuletzt). */
export function sortedMonthIds(months: Record<string, Month>): string[] {
  return Object.keys(months).sort()
}
