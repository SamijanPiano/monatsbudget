// Ordnet Bank-Buchungen den Posten des Monatsplans zu. Reine Funktion, keine
// Seiteneffekte. Reihenfolge, der erste Treffer gewinnt:
//   1. manuelle Verschiebung  2. gelernter Empfänger  3. Kategorie-Art
//   (Sparen/Umbuchung)  4. fester Abzug (Betrag + Name oder Dauerposten)
//   5. Einnahmen  6. Kategorie-Name = Postenname  7. Sammelposten.
// Planbeträge sind Euro, Buchungen Cent.

import type { Plan, PlanItem } from './plan'
import type { Period } from './period'
import type { Category, RecurringRule, Transaction } from '../types/budget'
import { normalizeKey } from './learning/signals'

/** Sonderziele neben den Posten-IDs. */
export const SAVINGS = 'savings'
export const EXCLUDED = 'excluded'
export const OTHER_INCOME = 'other-income'
export const UNASSIGNED = 'unassigned'

/** Posten-ID oder eines der Sonderziele. */
export type PlanTarget = string

export interface MatchInput {
  transactions: readonly Transaction[]
  plan: Plan
  categories: readonly Category[]
  /** Manuelle Verschiebungen: Buchungs-ID → Ziel. */
  overrides: Readonly<Record<string, PlanTarget>>
  /** Erkannte Dauerposten (für feste Abzüge ohne Namensgleichheit). */
  recurring: readonly RecurringRule[]
}

const AMOUNT_TOLERANCE_CENT = 50
const AMOUNT_TOLERANCE_RATIO = 0.03
const SPECIAL_TARGETS = new Set([SAVINGS, EXCLUDED, OTHER_INCOME, UNASSIGNED])
/** Ein Eingang zählt als Gehalt für den Periodenstart ab diesem Anteil des Planbetrags. */
const MIN_SALARY_SHARE = 0.5

function cents(euro: number): number {
  return Math.round((Number.isFinite(euro) ? euro : 0) * 100)
}

function amountMatches(txCents: number, planCents: number): boolean {
  if (planCents === 0) return false
  const diff = Math.abs(Math.abs(txCents) - Math.abs(planCents))
  return diff <= AMOUNT_TOLERANCE_CENT || diff <= Math.abs(planCents) * AMOUNT_TOLERANCE_RATIO
}

/** Wörter des Postennamens (ab 3 Buchstaben), kleingeschrieben. */
function labelTokens(label: string): string[] {
  return normalizeKey(label)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3)
}

function nameMatches(item: PlanItem, text: string): boolean {
  const haystack = normalizeKey(text)
  return labelTokens(item.label).some((token) => haystack.includes(token))
}

function sameName(a: string, b: string): boolean {
  const x = normalizeKey(a)
  const y = normalizeKey(b)
  return x.length > 0 && y.length > 0 && (x === y || x.includes(y) || y.includes(x))
}

/** Gehaltsposten: markierter Posten, sonst der erste Einnahmen-Posten. */
export function salaryItem(plan: Plan): PlanItem | undefined {
  return plan.income.find((i) => i.salary) ?? plan.income[0]
}

/** Sammelposten für alles Übrige. */
export function catchAllItem(plan: Plan): PlanItem | undefined {
  return [...plan.variable, ...plan.fixed].find((i) => i.catchAll)
}

function allItems(plan: Plan): PlanItem[] {
  return [...plan.income, ...plan.fixed, ...plan.variable]
}

function isRecurring(tx: Transaction, recurring: readonly RecurringRule[]): boolean {
  const key = normalizeKey(tx.counterparty)
  return recurring.some(
    (r) => normalizeKey(r.counterparty) === key && amountMatches(tx.amount, r.amountApprox),
  )
}

function matchFixed(tx: Transaction, input: MatchInput): PlanItem | undefined {
  const byAmount = input.plan.fixed.filter((i) => amountMatches(tx.amount, cents(i.amount)))
  if (byAmount.length === 0) return undefined
  const byName = byAmount.find((i) => nameMatches(i, `${tx.counterparty} ${tx.purpose}`))
  if (byName) return byName
  return isRecurring(tx, input.recurring) ? byAmount[0] : undefined
}

function matchIncome(tx: Transaction, input: MatchInput, category: Category | undefined): PlanTarget {
  const byName = input.plan.income.find((i) => nameMatches(i, `${tx.counterparty} ${tx.purpose}`))
  if (byName) return byName.id
  const salary = salaryItem(input.plan)
  if (category?.kind === 'income' && salary) return salary.id
  return OTHER_INCOME
}

function assignOne(
  tx: Transaction,
  input: MatchInput,
  itemIds: ReadonlySet<string>,
  categoriesById: ReadonlyMap<string, Category>,
): PlanTarget {
  const override = input.overrides[tx.id]
  if (override && (itemIds.has(override) || SPECIAL_TARGETS.has(override))) return override

  const key = normalizeKey(tx.counterparty)
  const learned = key ? allItems(input.plan).find((i) => i.counterparties?.includes(key)) : undefined
  if (learned) return learned.id

  const category = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined
  if (category?.kind === 'savings') return SAVINGS
  if (category?.kind === 'transfer' || category?.kind === 'ignore') return EXCLUDED

  const byCategory =
    category && category.kind !== 'income'
      ? [...input.plan.fixed, ...input.plan.variable].find((i) => sameName(i.label, category.label))
      : undefined

  // Erstattung mit Ausgaben-Kategorie: verrechnet sich mit dem Ausgabenposten.
  if (tx.amount > 0) return byCategory?.id ?? matchIncome(tx, input, category)

  const fixed = matchFixed(tx, input)
  if (fixed) return fixed.id
  if (byCategory) return byCategory.id

  return catchAllItem(input.plan)?.id ?? UNASSIGNED
}

/** Ordnet jede Buchung genau einem Ziel zu. */
export function assignToPlan(input: MatchInput): Map<string, PlanTarget> {
  const itemIds = new Set(allItems(input.plan).map((i) => i.id))
  const categoriesById = new Map(input.categories.map((c) => [c.id, c]))
  const result = new Map<string, PlanTarget>()
  for (const tx of input.transactions) {
    result.set(tx.id, assignOne(tx, input, itemIds, categoriesById))
  }
  return result
}

export interface TargetActual {
  /** Summe in Cent: Einnahmen positiv, Ausgaben als positiver Verbrauch. */
  cents: number
  /** Buchungen der Periode, neueste zuerst. */
  transactions: Transaction[]
}

export interface PeriodActuals {
  byTarget: Record<PlanTarget, TargetActual>
}

/** Summiert die zugeordneten Buchungen eines Zeitraums je Ziel. */
export function actualsForPeriod(
  input: MatchInput,
  assignments: ReadonlyMap<string, PlanTarget>,
  period: Period,
): PeriodActuals {
  const incomeTargets = new Set([...input.plan.income.map((i) => i.id), OTHER_INCOME])
  const byTarget: Record<PlanTarget, TargetActual> = {}
  const inPeriod = input.transactions
    .filter((t) => t.date >= period.start && t.date <= period.end)
    .sort((a, b) => b.date.localeCompare(a.date))

  for (const tx of inPeriod) {
    const target = assignments.get(tx.id) ?? UNASSIGNED
    const signed = incomeTargets.has(target) ? tx.amount : -tx.amount
    const entry = byTarget[target] ?? { cents: 0, transactions: [] }
    byTarget[target] = { cents: entry.cents + signed, transactions: [...entry.transactions, tx] }
  }
  return { byTarget }
}

/** Buchungsdaten der Gehaltseingänge (bestimmen den Periodenstart). */
export function salaryDates(input: MatchInput, assignments: ReadonlyMap<string, PlanTarget>): string[] {
  const salary = salaryItem(input.plan)
  if (!salary) return []
  // Kleine Eingänge (Erstattung, Rückbuchung) dürfen den Periodenstart nicht verschieben.
  const minCents = Math.round(cents(salary.amount) * MIN_SALARY_SHARE)
  // Je Monat zählt nur der größte Eingang: ein Nebenjob-Lohn am 10. ist nicht das Gehalt am 15.
  const largestPerMonth = new Map<string, Transaction>()
  for (const t of input.transactions) {
    if (t.amount <= 0 || t.amount < minCents || assignments.get(t.id) !== salary.id) continue
    const month = t.date.slice(0, 7)
    const best = largestPerMonth.get(month)
    if (!best || t.amount > best.amount) largestPerMonth.set(month, t)
  }
  return [...largestPerMonth.values()].map((t) => t.date).sort()
}
