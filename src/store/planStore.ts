// Monatsplan: ein einziger Plan, unabhängig vom Monats-Umschalter, dauerhaft
// in localStorage. Alle Mutationen erzeugen neue Objekte (immutable).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createId } from '../lib/id'
import {
  ensurePlanRoles,
  learnCounterparty,
  planFromMonth,
  setRole as setPlanRole,
  type Plan,
  type PlanItem,
  type PlanRole,
  type PlanSection,
} from '../lib/plan'
import { normalizeKey } from '../lib/learning/signals'
import type { PlanTarget } from '../lib/planMatch'
import type { Transaction } from '../types/budget'
import { logActivity } from './activityStore'
import { formatMoney } from '../lib/format'

const SECTION_NAME: Record<PlanSection, string> = {
  income: 'Einnahmen',
  fixed: 'Feste Abzüge',
  variable: 'Variable Ausgaben',
}

const SPECIAL_NAME: Record<string, string> = {
  savings: 'Sparen',
  excluded: 'Nicht zählen',
  'other-income': 'Sonstige Eingänge',
  unassigned: 'Nicht zugeordnet',
}

/** Anzeigename eines Ziels (Posten oder Sonderziel) für das Protokoll. */
function targetName(plan: Plan, target: PlanTarget): string {
  const item = [...plan.income, ...plan.fixed, ...plan.variable].find((i) => i.id === target)
  return item?.label || SPECIAL_NAME[target] || target
}
import { useBudgetStore } from './budgetStore'

const STORAGE_KEY = 'monatsbudget-plan-v1'

const DEFAULT_LABELS: Record<PlanSection, string> = {
  income: 'Einnahme',
  fixed: 'Abo / Abzug',
  variable: 'Ausgabe',
}

interface PlanState {
  plan: Plan
  /** Manuelle Verschiebungen: Buchungs-ID → Posten-ID oder Sonderziel. */
  overrides: Record<string, PlanTarget>
  /** Neuer Posten; `extra` z. B. `{ pooled: true }` für einen Topf-Posten. */
  addItem: (section: PlanSection, extra?: Partial<Omit<PlanItem, 'id'>>) => void
  updateItem: (section: PlanSection, id: string, patch: Partial<Omit<PlanItem, 'id'>>) => void
  removeItem: (section: PlanSection, id: string) => void
  setSavings: (value: number) => void
  setBalance: (value: number) => void
  /** Verschiebt eine Buchung und merkt sich den Empfänger für künftige Buchungen. */
  moveTransaction: (tx: Pick<Transaction, 'id' | 'counterparty'>, target: PlanTarget) => void
  /** Löschen einer Buchung: Verschiebung entfernen bzw. auf die verbleibende Fassung übertragen. */
  forgetTransaction: (removedId: string, keptId?: string) => void
  /** Macht einen Posten zum Sammelposten bzw. Gehaltsposten. */
  setRole: (role: PlanRole, id: string) => void
}

/** Startwert beim allerersten Öffnen: bisher eingetragene Werte des aktiven Monats. */
function seedPlan(): Plan {
  const { months, activeMonthId } = useBudgetStore.getState()
  return ensurePlanRoles(planFromMonth(months[activeMonthId]))
}

/** Persistierter Stand v1 (nur `plan`) → v2 (Rollen + Verschiebungen). */
export function migratePlanState(persisted: unknown, version: number): unknown {
  const state = (persisted ?? {}) as Partial<PlanState>
  if (version < 2 && state.plan) {
    const list = (value: unknown): PlanItem[] => (Array.isArray(value) ? value : [])
    const plan: Plan = {
      ...state.plan,
      income: list(state.plan.income),
      fixed: list(state.plan.fixed),
      variable: list(state.plan.variable),
    }
    return { ...state, plan: ensurePlanRoles(plan), overrides: {} }
  }
  return state
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      plan: seedPlan(),
      overrides: {},

      addItem: (section, extra) =>
        set((s) => {
          const item: PlanItem = { id: createId(), label: DEFAULT_LABELS[section], amount: 0, ...extra }
          logActivity('plan', `Neuer Posten in ${SECTION_NAME[section]}`)
          return { plan: { ...s.plan, [section]: [...s.plan[section], item] } }
        }),

      updateItem: (section, id, patch) => {
        const before = get().plan[section].find((it) => it.id === id)
        if (before && patch.label !== undefined && patch.label !== before.label) {
          logActivity('plan', `Posten umbenannt: „${before.label}" → „${patch.label}"`)
        }
        if (before && patch.amount !== undefined && patch.amount !== before.amount) {
          logActivity(
            'plan',
            `${before.label || 'Posten'}: ${formatMoney(before.amount)} → ${formatMoney(patch.amount)}`,
          )
        }
        if (before && patch.pooled !== undefined) {
          logActivity(
            'plan',
            `${before.label || 'Posten'}: ${patch.pooled ? 'mit Daily zusammengefasst' : 'nicht mehr im Daily-Topf'}`,
          )
        }
        set((s) => ({
          plan: {
            ...s.plan,
            [section]: s.plan[section].map((it) => (it.id === id ? { ...it, ...patch } : it)),
          },
        }))
      },

      removeItem: (section, id) => {
        const item = get().plan[section].find((it) => it.id === id)
        logActivity('plan', `Posten gelöscht: ${item?.label || 'ohne Namen'} (${SECTION_NAME[section]})`)
        set((s) => ({
          plan: { ...s.plan, [section]: s.plan[section].filter((it) => it.id !== id) },
        }))
      },

      setSavings: (value) => {
        logActivity('plan', `Sparbetrag: ${formatMoney(get().plan.savings)} → ${formatMoney(value)}`)
        set((s) => ({ plan: { ...s.plan, savings: value } }))
      },
      setBalance: (value) => {
        logActivity('plan', `Kontostand eingetragen: ${formatMoney(value)}`)
        set((s) => ({ plan: { ...s.plan, balance: value } }))
      },

      moveTransaction: (tx, target) => {
        const { plan, overrides } = get()
        const from = overrides[tx.id]
        logActivity(
          'verschoben',
          `${tx.counterparty || 'Buchung'}${from ? ` (aus ${targetName(plan, from)})` : ''} → ${targetName(plan, target)}`,
        )
        set((s) => ({
          overrides: { ...s.overrides, [tx.id]: target },
          plan: learnCounterparty(s.plan, normalizeKey(tx.counterparty), target),
        }))
      },

      forgetTransaction: (removedId, keptId) =>
        set((s) => {
          const target = s.overrides[removedId]
          if (target === undefined) return {}
          const rest = { ...s.overrides }
          delete rest[removedId]
          const carry = keptId && rest[keptId] === undefined ? { [keptId]: target } : {}
          return { overrides: { ...rest, ...carry } }
        }),

      setRole: (role, id) => {
        const name = targetName(get().plan, id)
        logActivity('plan', role === 'salary' ? `Gehaltsposten: ${name}` : `Sammelposten: ${name}`)
        set((s) => ({ plan: setPlanRole(s.plan, role, id) }))
      },
    }),
    { name: STORAGE_KEY, version: 2, migrate: migratePlanState },
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
