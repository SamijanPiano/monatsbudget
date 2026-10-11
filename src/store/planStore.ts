// Monatsplan: ein einziger Plan, unabhängig vom Monats-Umschalter, dauerhaft
// in localStorage. Alle Mutationen erzeugen neue Objekte (immutable).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createId } from '../lib/id'
import { planFromMonth, type Plan, type PlanItem, type PlanSection } from '../lib/plan'
import { useBudgetStore } from './budgetStore'

const STORAGE_KEY = 'monatsbudget-plan-v1'

const DEFAULT_LABELS: Record<PlanSection, string> = {
  income: 'Einnahme',
  fixed: 'Abo / Abzug',
  variable: 'Ausgabe',
}

interface PlanState {
  plan: Plan
  addItem: (section: PlanSection) => void
  updateItem: (section: PlanSection, id: string, patch: Partial<Omit<PlanItem, 'id'>>) => void
  removeItem: (section: PlanSection, id: string) => void
  setSavings: (value: number) => void
  setBalance: (value: number) => void
}

/** Startwert beim allerersten Öffnen: bisher eingetragene Werte des aktiven Monats. */
function seedPlan(): Plan {
  const { months, activeMonthId } = useBudgetStore.getState()
  return planFromMonth(months[activeMonthId])
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      plan: seedPlan(),

      addItem: (section) =>
        set((s) => {
          const item: PlanItem = { id: createId(), label: DEFAULT_LABELS[section], amount: 0 }
          return { plan: { ...s.plan, [section]: [...s.plan[section], item] } }
        }),

      updateItem: (section, id, patch) =>
        set((s) => ({
          plan: {
            ...s.plan,
            [section]: s.plan[section].map((it) => (it.id === id ? { ...it, ...patch } : it)),
          },
        })),

      removeItem: (section, id) =>
        set((s) => ({
          plan: { ...s.plan, [section]: s.plan[section].filter((it) => it.id !== id) },
        })),

      setSavings: (value) => set((s) => ({ plan: { ...s.plan, savings: value } })),
      setBalance: (value) => set((s) => ({ plan: { ...s.plan, balance: value } })),
    }),
    { name: STORAGE_KEY, version: 1 },
  ),
)

// Übernommene Startwerte sofort festschreiben, damit der Plan danach nie
// wieder vom Monat abhängt (persist speichert sonst erst bei der ersten Änderung).
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === null) {
    usePlanStore.setState({ plan: usePlanStore.getState().plan })
  }
} catch {
  // localStorage gesperrt (privates Fenster): Plan lebt dann nur in dieser Sitzung.
}
