// Schnappschuss der App für Claude. Rein funktional: gleiche Rechenwege wie der
// Monatsplan (Zuordnung, Perioden), damit Claude dieselben Zahlen sieht wie
// Samuel. Beträge in Cent.

import type { Plan, PlanItem } from '../plan'
import { actualsForPeriod, assignToPlan, salaryDates, type MatchInput, type PlanTarget } from '../planMatch'
import { addDays, listPeriods, periodLabel, type Period } from '../period'
import { findDuplicateCandidates } from '../duplicates'
import { computeBalances } from '../saldo'
import type { SaldoState } from '../../types/saldo'
import type { Account, BankPending, Category, Contract, RecurringRule, Transaction } from '../../types/budget'

const RECENT_PERIODS = 6
/** Einzelbuchungen nur der letzten 12 Monate, damit der Upload klein bleibt (Worker-Grenze 2 MB). */
const TRANSACTION_DAYS = 365

export interface SnapshotInput {
  /** Heutiges Datum, YYYY-MM-DD. */
  today: string
  transactions: readonly Transaction[]
  categories: readonly Category[]
  accounts: readonly Account[]
  recurringRules: readonly RecurringRule[]
  contracts: readonly Contract[]
  bankPending: BankPending | null
  dismissedDuplicates: readonly string[]
  plan: Plan
  overrides: Readonly<Record<string, PlanTarget>>
  saldo: SaldoState
}

export interface ItemSummary {
  id: string
  label: string
  section: 'income' | 'fixed' | 'variable'
  plannedCents: number
  actualCents: number
  count: number
  role: 'catchAll' | 'salary' | null
}

export interface PeriodSummary {
  period: Period & { label: string }
  items: ItemSummary[]
  /** Ausgaben über alle Ausgabenposten + nicht zugeordnet. */
  spentCents: number
  /** Geplante Ausgaben (fest + variabel). */
  plannedSpendCents: number
  incomeCents: number
  extras: Record<string, number>
}

export interface MirrorSnapshot {
  version: 1
  createdAt: string
  period: Period & { label: string }
  periodSummary: PeriodSummary
  recentPeriods: PeriodSummary[]
  plan: { savingsCents: number; balanceCents: number }
  transactions: Array<{
    date: string
    amount: number
    counterparty: string
    purpose: string
    category: string | null
    target: PlanTarget
    source: string
  }>
  accounts: Array<{ name: string; type: string; balanceCents: number | null }>
  recurring: Array<{ counterparty: string; amountCents: number; nextExpected: string }>
  contracts: Array<{ label: string; amountCents: number; nextDue: string; status: string }>
  bankPending: BankPending | null
  openDuplicates: number
  saldo: Array<{ name: string; balanceCents: number }>
}

const cents = (euro: number) => Math.round((Number.isFinite(euro) ? euro : 0) * 100)

function roleOf(item: PlanItem): ItemSummary['role'] {
  return item.catchAll ? 'catchAll' : item.salary ? 'salary' : null
}

function summarize(input: MatchInput, assignments: Map<string, PlanTarget>, period: Period): PeriodSummary {
  const { byTarget } = actualsForPeriod(input, assignments, period)
  const sections = [
    ['income', input.plan.income],
    ['fixed', input.plan.fixed],
    ['variable', input.plan.variable],
  ] as const
  const items: ItemSummary[] = sections.flatMap(([section, list]) =>
    list.map((it) => ({
      id: it.id,
      label: it.label,
      section,
      plannedCents: cents(it.amount),
      actualCents: byTarget[it.id]?.cents ?? 0,
      count: byTarget[it.id]?.transactions.length ?? 0,
      role: roleOf(it),
    })),
  )
  const expense = items.filter((i) => i.section !== 'income')
  const extras = Object.fromEntries(
    ['savings', 'other-income', 'unassigned', 'excluded'].map((k) => [k, byTarget[k]?.cents ?? 0]),
  )
  return {
    period: { ...period, label: periodLabel(period) },
    items,
    spentCents: expense.reduce((s, i) => s + i.actualCents, 0) + (extras.unassigned ?? 0),
    plannedSpendCents: expense.reduce((s, i) => s + i.plannedCents, 0),
    incomeCents: items.filter((i) => i.section === 'income').reduce((s, i) => s + i.actualCents, 0),
    extras,
  }
}

/** Baut den vollständigen Schnappschuss. */
export function buildSnapshot(input: SnapshotInput, now: Date = new Date()): MirrorSnapshot {
  const match: MatchInput = {
    transactions: input.transactions,
    plan: input.plan,
    categories: input.categories,
    overrides: input.overrides,
    recurring: input.recurringRules,
  }
  const assignments = assignToPlan(match)
  const earliest = input.transactions.reduce<string | null>(
    (min, t) => (min === null || t.date < min ? t.date : min),
    null,
  )
  const periods = listPeriods(salaryDates(match, assignments), input.today, earliest, RECENT_PERIODS)
  const recentPeriods = periods.map((p) => summarize(match, assignments, p))
  const categoryLabel = new Map(input.categories.map((c) => [c.id, c.label]))
  const balances = computeBalances(input.saldo)

  return {
    version: 1,
    createdAt: now.toISOString(),
    period: recentPeriods[0].period,
    periodSummary: recentPeriods[0],
    recentPeriods,
    plan: { savingsCents: cents(input.plan.savings), balanceCents: cents(input.plan.balance) },
    transactions: input.transactions
      .filter((t) => t.date >= addDays(input.today, -TRANSACTION_DAYS))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => ({
        date: t.date,
        amount: t.amount,
        counterparty: t.counterparty,
        purpose: t.purpose,
        category: t.categoryId ? (categoryLabel.get(t.categoryId) ?? null) : null,
        target: assignments.get(t.id) ?? 'unassigned',
        source: t.source,
      })),
    accounts: input.accounts.map((a) => ({ name: a.name, type: a.type, balanceCents: a.balance })),
    recurring: input.recurringRules.map((r) => ({
      counterparty: r.counterparty,
      amountCents: r.amountApprox,
      nextExpected: r.nextExpected,
    })),
    contracts: input.contracts.map((c) => ({
      label: c.label,
      amountCents: c.amountApprox,
      nextDue: c.nextDue,
      status: c.status,
    })),
    bankPending: input.bankPending,
    openDuplicates: findDuplicateCandidates(input.transactions, input.dismissedDuplicates).length,
    // Salden sind bereits Cent; negativ = die Person schuldet Samuel etwas.
    saldo: input.saldo.people.map((p) => ({ name: p.name, balanceCents: Math.round(balances[p.id] ?? 0) })),
  }
}
