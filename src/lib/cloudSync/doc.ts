// Gemeinsamer App-Stand aller Geräte (wie beim ERP: eine Quelle im Worker).
// Hier nur reine Funktionen: Dokument-Form, Prüfung eingehender Daten und das
// Zusammenführen zweier Stände, wenn zwei Geräte gleichzeitig geändert haben.
//
// Zusammengeführt wird Feld für Feld: jedes Feld trägt den Zeitpunkt seiner
// letzten Änderung, der neuere gewinnt. Buchungen und Monate werden darüber
// hinaus Eintrag für Eintrag vereinigt, gelöschte Buchungen bleiben gelöscht.

import type {
  Account,
  BankPending,
  BudgetState,
  Category,
  Contract,
  Goal,
  Month,
  Settings,
  Transaction,
} from '../../types/budget'
import type { SaldoState } from '../../types/saldo'
import type { Plan } from '../plan'

export const EPOCH = '1970-01-01T00:00:00.000Z'
const MAX_TOMBSTONES = 20000

export const SECTIONS = [
  'months',
  'settings',
  'transactions',
  'categories',
  'accounts',
  'contracts',
  'misc',
  'profile',
  'plan',
  'saldo',
] as const
export type Section = (typeof SECTIONS)[number]
export type ChangedAt = Record<Section, string>

export function emptyChangedAt(): ChangedAt {
  return Object.fromEntries(SECTIONS.map((s) => [s, EPOCH])) as ChangedAt
}

export interface SyncDoc {
  version: 1
  /** Letzte Änderung je Feld; beim Zusammenführen gewinnt der neuere. */
  changedAt: ChangedAt
  budget: {
    months: Record<string, Month>
    settings: Settings
    transactions: Transaction[]
    categories: Category[]
    accounts: Account[]
    contracts: Contract[]
    bankPending: BankPending | null
    dismissedDuplicates: string[]
    deletedTransactionIds: string[]
    cashEnabled: boolean
    goals: Goal[]
  }
  plan: { plan: Plan; overrides: Record<string, string> }
  saldo: SaldoState
}

/** Baut das Dokument aus den Store-Zuständen. */
export function buildDoc(
  budget: BudgetState,
  plan: { plan: Plan; overrides: Record<string, string> },
  saldo: SaldoState,
  changedAt: ChangedAt,
): SyncDoc {
  return {
    version: 1,
    changedAt,
    budget: {
      months: budget.months,
      settings: budget.settings,
      transactions: budget.transactions,
      categories: budget.categories,
      accounts: budget.accounts,
      contracts: budget.contracts,
      bankPending: budget.bankPending,
      dismissedDuplicates: budget.dismissedDuplicates ?? [],
      deletedTransactionIds: budget.deletedTransactionIds ?? [],
      cashEnabled: budget.profile.cashEnabled,
      goals: budget.profile.goals,
    },
    plan: { plan: plan.plan, overrides: plan.overrides },
    saldo: { people: saldo.people, products: saldo.products, trips: saldo.trips },
  }
}

/** Ein Monat ohne Beträge (z. B. nur durch Blättern angelegt, Vorlagezeilen mit 0 €). */
export function isBlankMonth(m: Month): boolean {
  return (
    [...m.income, ...m.fixed, ...m.variable].every((item) => !item.konto && !item.bar) &&
    !m.savingsKonto &&
    !m.savingsBar &&
    !m.currentKonto &&
    !m.currentBar
  )
}

/** Frisches Gerät: nichts, was beim ersten Abgleich verloren gehen könnte. */
export function isEmptyDoc(doc: SyncDoc): boolean {
  const p = doc.plan.plan
  const b = doc.budget
  return (
    b.transactions.length === 0 &&
    Object.values(b.months).every(isBlankMonth) &&
    b.contracts.length === 0 &&
    b.goals.length === 0 &&
    b.accounts.every((a) => a.balance === null && !a.manual) &&
    p.income.length + p.fixed.length + p.variable.length === 0 &&
    !p.savings &&
    !p.balance &&
    doc.saldo.people.length === 0 &&
    doc.saldo.trips.length === 0
  )
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const objects = <T>(v: unknown): T[] => (Array.isArray(v) ? (v.filter(isObj) as T[]) : [])

function isMonth(v: unknown): v is Month {
  return isObj(v) && Array.isArray(v.income) && Array.isArray(v.fixed) && Array.isArray(v.variable)
}

function isTransaction(v: unknown): v is Transaction {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.date === 'string' &&
    typeof v.amount === 'number' &&
    Number.isFinite(v.amount) &&
    typeof v.hash === 'string'
  )
}

/**
 * Prüft ein Dokument aus dem Netz. Bewusst nur die Form, ohne Werte zu ändern:
 * das Dokument stammt von dieser App selbst (über den eigenen, geschützten
 * Worker). null = unbrauchbar, lokal nichts ändern.
 */
export function parseDoc(raw: unknown): SyncDoc | null {
  if (!isObj(raw) || raw.version !== 1) return null
  const b = raw.budget
  if (!isObj(b) || !isObj(b.months) || !isObj(b.settings)) return null
  const months = Object.fromEntries(Object.entries(b.months).filter(([, m]) => isMonth(m))) as Record<string, Month>
  if (Object.keys(months).length === 0) return null

  const p = isObj(raw.plan) ? raw.plan : {}
  const plan = isObj(p.plan) ? p.plan : {}
  const s = isObj(raw.saldo) ? raw.saldo : {}
  const c = isObj(raw.changedAt) ? raw.changedAt : {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

  return {
    version: 1,
    changedAt: Object.fromEntries(SECTIONS.map((k) => [k, isIso(c[k]) ? c[k] : EPOCH])) as ChangedAt,
    budget: {
      months,
      settings: b.settings as unknown as Settings,
      transactions: (Array.isArray(b.transactions) ? b.transactions : []).filter(isTransaction),
      categories: objects<Category>(b.categories),
      accounts: objects<Account>(b.accounts),
      contracts: objects<Contract>(b.contracts),
      bankPending: isObj(b.bankPending) ? (b.bankPending as unknown as BankPending) : null,
      dismissedDuplicates: strings(b.dismissedDuplicates),
      deletedTransactionIds: strings(b.deletedTransactionIds),
      cashEnabled: b.cashEnabled === true,
      goals: objects<Goal>(b.goals),
    },
    plan: {
      plan: {
        income: objects(plan.income),
        fixed: objects(plan.fixed),
        variable: objects(plan.variable),
        savings: num(plan.savings),
        balance: num(plan.balance),
        ...(isObj(plan.learnedSpecial)
          ? {
              learnedSpecial: Object.fromEntries(
                Object.entries(plan.learnedSpecial).filter((e): e is [string, string] => typeof e[1] === 'string'),
              ),
            }
          : {}),
      },
      overrides: Object.fromEntries(
        Object.entries(isObj(p.overrides) ? p.overrides : {}).filter(
          (e): e is [string, string] => typeof e[1] === 'string',
        ),
      ),
    },
    saldo: { people: objects(s.people), products: objects(s.products), trips: objects(s.trips) },
  }
}

/** Ist `a` echt neuer als `b`? Bei Gleichstand gewinnt der Worker-Stand. */
const isNewer = (a: string, b: string) => Date.parse(a) > Date.parse(b)

/** Gleiche Bankbuchung? Hash plus Kernfelder, damit eine Hash-Kollision nichts verschluckt. */
function sameBooking(a: Transaction, b: Transaction): boolean {
  return a.hash === b.hash && a.date === b.date && a.amount === b.amount && a.counterparty === b.counterparty
}

/**
 * Buchungen vereinigen: gleiche ID → Fassung des zuletzt geänderten Geräts;
 * gelöschte bleiben weg; dieselbe Bankbuchung (Hash/Bank-Referenz) nur einmal.
 */
function mergeTransactions(
  local: readonly Transaction[],
  remote: readonly Transaction[],
  tombstones: ReadonlySet<string>,
  localWins: boolean,
): Transaction[] {
  const byId = new Map<string, Transaction>()
  for (const t of remote) byId.set(t.id, t)
  for (const t of local) {
    if (!byId.has(t.id) || localWins) byId.set(t.id, t)
  }
  const byHash = new Map<string, Transaction>()
  const seenRef = new Set<string>()
  const result: Transaction[] = []
  for (const t of byId.values()) {
    if (tombstones.has(t.id)) continue
    const ref = t.bankRef ? `${t.accountId}:${t.bankRef}` : null
    const twin = byHash.get(t.hash)
    if ((twin && sameBooking(twin, t)) || (ref && seenRef.has(ref))) continue
    byHash.set(t.hash, t)
    if (ref) seenRef.add(ref)
    result.push(t)
  }
  return result
}

/** Monate Eintrag für Eintrag: nur auf einer Seite → übernehmen, auf beiden → neuere Seite. */
function mergeMonths(
  local: Record<string, Month>,
  remote: Record<string, Month>,
  localWins: boolean,
): Record<string, Month> {
  const result: Record<string, Month> = { ...remote }
  for (const [id, month] of Object.entries(local)) {
    const other = remote[id]
    if (!other || (isBlankMonth(other) && !isBlankMonth(month)) || (localWins && !isBlankMonth(month))) {
      result[id] = month
    }
  }
  return result
}

/** Führt zwei Stände zusammen (lokal = dieses Gerät, remote = Worker). */
export function mergeDocs(local: SyncDoc, remote: SyncDoc): SyncDoc {
  const wins = Object.fromEntries(
    SECTIONS.map((s) => [s, isNewer(local.changedAt[s], remote.changedAt[s])]),
  ) as Record<Section, boolean>
  const pick = <T>(section: Section, l: T, r: T): T => (wins[section] ? l : r)
  const lb = local.budget
  const rb = remote.budget

  const tombstones = [...new Set([...rb.deletedTransactionIds, ...lb.deletedTransactionIds])].slice(
    -MAX_TOMBSTONES,
  )

  return {
    version: 1,
    changedAt: Object.fromEntries(
      SECTIONS.map((s) => [s, wins[s] ? local.changedAt[s] : remote.changedAt[s]]),
    ) as ChangedAt,
    budget: {
      months: mergeMonths(lb.months, rb.months, wins.months),
      settings: pick('settings', lb.settings, rb.settings),
      transactions: mergeTransactions(lb.transactions, rb.transactions, new Set(tombstones), wins.transactions),
      categories: pick('categories', lb.categories, rb.categories),
      accounts: pick('accounts', lb.accounts, rb.accounts),
      contracts: pick('contracts', lb.contracts, rb.contracts),
      bankPending: pick('misc', lb.bankPending, rb.bankPending),
      dismissedDuplicates: [...new Set([...rb.dismissedDuplicates, ...lb.dismissedDuplicates])],
      deletedTransactionIds: tombstones,
      cashEnabled: pick('profile', lb.cashEnabled, rb.cashEnabled),
      goals: pick('profile', lb.goals, rb.goals),
    },
    plan: {
      plan: pick('plan', local.plan.plan, remote.plan.plan),
      overrides: wins.plan
        ? { ...remote.plan.overrides, ...local.plan.overrides }
        : { ...local.plan.overrides, ...remote.plan.overrides },
    },
    saldo: pick('saldo', local.saldo, remote.saldo),
  }
}
