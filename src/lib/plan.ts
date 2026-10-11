// Monatsplan: ein einziger, dauerhaft gespeicherter Plan (kein Monatsbezug,
// kein Bargeld). Rechnet wie die Excel „Monatskalkulation", Konto-Spalte.
// Keine UI, vollständig getestet.

import { round2 } from './calc'
import type { Month } from '../types/budget'

export type PlanSection = 'income' | 'fixed' | 'variable'

export interface PlanItem {
  id: string
  label: string
  /** Betrag in Euro */
  amount: number
}

export interface Plan {
  income: PlanItem[]
  fixed: PlanItem[]
  variable: PlanItem[]
  /** Geplanter Sparbetrag (€) */
  savings: number
  /** Aktueller Kontostand für „Reicht es?" (€) */
  balance: number
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

  // TODO(human): Ab wann ist ein positiver Puffer „knapp" ('tight')?
  // Verfügbar: calc.remaining (Puffer in €), calc.needed (was noch abgeht),
  // calc.fixed (feste Abzüge), calc.income.

  return 'ok'
}
