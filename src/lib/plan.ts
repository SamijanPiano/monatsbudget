// Monatsplan: ein einziger, dauerhaft gespeicherter Plan (kein Monatsbezug,
// kein Bargeld). Rechnet wie die Excel „Monatskalkulation", Konto-Spalte.
// Keine UI, vollständig getestet.

import { round2 } from './calc'
import { createId } from './id'
import type { Month } from '../types/budget'

export type PlanSection = 'income' | 'fixed' | 'variable'

export interface PlanItem {
  id: string
  label: string
  /** Betrag in Euro */
  amount: number
  /** Gelernte Empfänger (normalisiert): deren Buchungen gehören zu diesem Posten. */
  counterparties?: string[]
  /** Sammelposten: nimmt alle Ausgaben auf, die sonst nirgends passen. */
  catchAll?: boolean
  /** Gehaltsposten: sein Eingang bestimmt den Periodenstart. */
  salary?: boolean
  /** Daily-Topf: mit Daily und Puffer zusammenfassen (fehlt = nach Name, siehe dailyPool). */
  pooled?: boolean
}

export interface Plan {
  income: PlanItem[]
  fixed: PlanItem[]
  variable: PlanItem[]
  /** Geplanter Sparbetrag (€) */
  savings: number
  /** Aktueller Kontostand für „Reicht es?" (€) */
  balance: number
  /** Gelernte Empfänger für Sonderziele: Empfänger → 'savings' | 'excluded'. */
  learnedSpecial?: Record<string, string>
}

export interface PlanCalc {
  income: number
  fixed: number
  variable: number
  /** Konto nach Abzügen & Ausgaben (Excel C30) */
  afterExpenses: number
  /** Maximal sparen, nie negativ (C35) */
  maxSave: number
  savings: number
  /** Puffer nach Sparen (C41) */
  buffer: number
  /** Was vom Konto noch abgeht: fix + variabel (C64) */
  needed: number
  /** Kontostand minus alles, was noch abgeht (C65) */
  remaining: number
  /** C65 >= 0 */
  isEnough: boolean
}

/**
 * ok      = Konto reicht mit Luft
 * tight   = Konto reicht, aber knapp
 * short   = Konto reicht nicht (Excel: „NEIN, Konto fehlen")
 * unknown = noch kein Kontostand eingetragen
 */
export type VerdictTone = 'ok' | 'tight' | 'short' | 'unknown'

function safe(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function sum(items: readonly PlanItem[]): number {
  return round2(items.reduce((acc, item) => acc + safe(item.amount), 0))
}

export function emptyPlan(): Plan {
  return { income: [], fixed: [], variable: [], savings: 0, balance: 0 }
}

/**
 * Startwerte aus einem bisherigen Monat übernehmen. Nur die Konto-Spalte;
 * reine Bar-Posten (Konto leer, Bar gefüllt) fallen ganz weg.
 */
export function planFromMonth(month: Month | undefined): Plan {
  if (!month) return emptyPlan()
  const toItems = (items: Month['income']): PlanItem[] =>
    items
      .filter((it) => !(safe(it.konto) === 0 && safe(it.bar) !== 0))
      .map((it) => ({ id: it.id, label: it.label, amount: safe(it.konto) }))
  return {
    income: toItems(month.income),
    fixed: toItems(month.fixed),
    variable: toItems(month.variable),
    savings: safe(month.savingsKonto),
    balance: safe(month.currentKonto),
  }
}

export function calcPlan(plan: Plan): PlanCalc {
  const income = sum(plan.income)
  const fixed = sum(plan.fixed)
  const variable = sum(plan.variable)
  const afterExpenses = round2(income - fixed - variable)
  const savings = round2(safe(plan.savings))
  const needed = round2(fixed + variable)
  const remaining = round2(safe(plan.balance) - needed)

  return {
    income,
    fixed,
    variable,
    afterExpenses,
    maxSave: Math.max(0, afterExpenses),
    savings,
    buffer: round2(afterExpenses - savings),
    needed,
    remaining,
    isEnough: remaining >= 0,
  }
}

/**
 * Bewertet, ob das Konto reicht. Die Excel kennt nur Ja/Nein (C65 >= 0).
 * Die Abstufung „knapp" ist die einzige Stelle, an der die App bewusst
 * mehr sagt als die Tabelle.
 */
export function verdictTone(plan: Plan, calc: PlanCalc): VerdictTone {
  if (safe(plan.balance) === 0) return 'unknown'
  if (!calc.isEnough) return 'short'

  // Offen (Samuel): Ab wann ist ein positiver Puffer „knapp" ('tight')?
  // Verfügbar: calc.remaining (Puffer in €), calc.needed (was noch abgeht),
  // calc.fixed (feste Abzüge), calc.income.

  return 'ok'
}

// ─── Rollen & Lernen (Perioden-Budget) ──────────────────────────────────────

export const CATCH_ALL_LABEL = 'Täglicher Verbrauch'
const CATCH_ALL_HINT = /t(ä|ae)glich|verbrauch/i

export type PlanRole = 'catchAll' | 'salary'

/** Sonderziele, deren Empfänger sich die App beim Verschieben merkt (Werte wie in planMatch). */
const LEARNABLE_SPECIAL = ['savings', 'excluded']

/** Neue Liste, in der genau `id` die Rolle trägt (alle anderen verlieren sie). */
function withRole(items: PlanItem[], role: PlanRole, id: string | undefined): PlanItem[] {
  return items.map((it) => {
    const has = it.id === id
    if (Boolean(it[role]) === has) return it
    const next: PlanItem = { ...it }
    if (has) next[role] = true
    else delete next[role]
    return next
  })
}

/**
 * Stellt sicher, dass es einen Sammelposten und einen Gehaltsposten gibt.
 * Sammelposten: vorhandener „täglich/Verbrauch"-Posten, sonst neu angelegt.
 * Gehalt: erster Einnahmen-Posten. Bestehende Rollen bleiben unberührt.
 */
export function ensurePlanRoles(plan: Plan): Plan {
  let next = plan
  const hasCatchAll = [...plan.fixed, ...plan.variable].some((i) => i.catchAll)
  if (!hasCatchAll) {
    const hinted = plan.variable.find((i) => CATCH_ALL_HINT.test(i.label))
    next = hinted
      ? { ...next, variable: withRole(next.variable, 'catchAll', hinted.id) }
      : {
          ...next,
          variable: [...next.variable, { id: createId(), label: CATCH_ALL_LABEL, amount: 0, catchAll: true }],
        }
  }
  if (!next.income.some((i) => i.salary) && next.income[0]) {
    next = { ...next, income: withRole(next.income, 'salary', next.income[0].id) }
  }
  return next
}

/** Setzt eine Rolle auf genau einen Posten. Sammelposten nur bei Ausgaben, Gehalt nur bei Einnahmen. */
export function setRole(plan: Plan, role: PlanRole, id: string): Plan {
  if (role === 'salary') return { ...plan, income: withRole(plan.income, 'salary', id) }
  return {
    ...plan,
    fixed: withRole(plan.fixed, 'catchAll', id),
    variable: withRole(plan.variable, 'catchAll', id),
  }
}

/**
 * Lernt aus einer Verschiebung: der Empfänger gehört ab jetzt zum Zielposten
 * und wird bei allen anderen Posten entfernt. Bei einem Sonderziel (Sparen,
 * nicht zählen) wird er nur entfernt.
 */
export function learnCounterparty(plan: Plan, counterpartyKey: string, targetId: string): Plan {
  // Ohne Empfänger gäbe es nichts zu lernen; ein leerer Schlüssel würde sonst
  // jede Buchung ohne Empfänger an diesen Posten binden.
  if (counterpartyKey.trim() === '') return plan
  // Sparen und „nicht zählen" sind keine Posten: dafür eine eigene Zuordnung merken.
  const learnedSpecial = { ...(plan.learnedSpecial ?? {}) }
  delete learnedSpecial[counterpartyKey]
  if (LEARNABLE_SPECIAL.includes(targetId)) learnedSpecial[counterpartyKey] = targetId
  const update = (items: PlanItem[]): PlanItem[] =>
    items.map((it) => {
      const others = (it.counterparties ?? []).filter((c) => c !== counterpartyKey)
      const counterparties = it.id === targetId ? [...others, counterpartyKey] : others
      return it.counterparties || it.id === targetId ? { ...it, counterparties } : it
    })
  return {
    ...plan,
    income: update(plan.income),
    fixed: update(plan.fixed),
    variable: update(plan.variable),
    learnedSpecial,
  }
}

