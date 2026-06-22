// Backup-Logik: Export/Import als JSON. Reine Funktionen (testbar), ohne DOM.
// Ein Backup umfasst sowohl das Budget als auch die Schulden/Auslagen (Saldo).
// Alt-Backups (nur Budget bzw. nur Saldo) werden weiterhin erkannt.

import type {
  Account,
  BudgetState,
  Category,
  CategoryKind,
  CategoryRule,
  LineItem,
  Month,
  RecurringRule,
  Transaction,
} from '../types/budget'
import type { SaldoState } from '../types/saldo'
import { DEFAULT_SETTINGS } from './seed'
import { createId } from './id'
import { sanitizeSaldoState, isSaldoBackup } from './saldoBackup'

// v2: Backup umfasst zusätzlich die Transaktions-Schicht (transactions/
// categories/accounts/recurringRules). Alt-Backups (v1, nur Monate) bleiben lesbar.
export const BACKUP_VERSION = 2

export type BackupPayload = Pick<BudgetState, 'months' | 'activeMonthId' | 'settings'> &
  Partial<Pick<BudgetState, 'transactions' | 'categories' | 'accounts' | 'recurringRules'>>

export interface UnifiedBackup {
  budget?: BackupPayload
  saldo?: SaldoState
}

export interface BackupFile {
  app: 'monatsbudget'
  version: number
  exportedAt: string
  months: Record<string, Month>
  activeMonthId: string
  settings: BudgetState['settings']
  transactions: Transaction[]
  categories: Category[]
  accounts: Account[]
  recurringRules: RecurringRule[]
  saldo: SaldoState
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Geldbetrag aus untrusted Input: endlich und nicht negativ. */
function coerceAmount(value: unknown): number {
  return isNumber(value) ? Math.max(0, value) : 0
}

function coerceLineItem(raw: unknown): LineItem {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: typeof r.id === 'string' ? r.id : createId(),
    label: typeof r.label === 'string' ? r.label : '',
    konto: coerceAmount(r.konto),
    bar: coerceAmount(r.bar),
    note: typeof r.note === 'string' ? r.note : undefined,
  }
}

function coerceItems(raw: unknown): LineItem[] {
  return Array.isArray(raw) ? raw.map(coerceLineItem) : []
}

function coerceMonth(id: string, raw: unknown): Month {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id,
    income: coerceItems(r.income),
    fixed: coerceItems(r.fixed),
    variable: coerceItems(r.variable),
    savingsKonto: coerceAmount(r.savingsKonto),
    savingsBar: coerceAmount(r.savingsBar),
    currentKonto: coerceAmount(r.currentKonto),
    currentBar: coerceAmount(r.currentBar),
  }
}

const MONTH_ID_RE = /^\d{4}-\d{2}$/

// ── Transaktions-Schicht (untrusted Input absichern) ─────────────────────────

/** Vorzeichenbehafteter Cent-Betrag: ganzzahlig, endlich. */
function coerceSignedCents(value: unknown): number {
  return isNumber(value) ? Math.round(value) : 0
}

function coerceStr(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

const CATEGORY_KINDS: CategoryKind[] = ['income', 'fixed', 'variable', 'savings', 'transfer', 'ignore']

function coerceTransaction(raw: unknown): Transaction {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: coerceStr(r.id, createId()),
    date: coerceStr(r.date),
    amount: coerceSignedCents(r.amount),
    counterparty: coerceStr(r.counterparty),
    purpose: coerceStr(r.purpose),
    categoryId: typeof r.categoryId === 'string' ? r.categoryId : null,
    accountId: coerceStr(r.accountId),
    source: r.source === 'sync' || r.source === 'manual' ? r.source : 'import',
    hash: coerceStr(r.hash, createId()),
  }
}

function coerceCategoryRule(raw: unknown): CategoryRule | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const field = r.field === 'purpose' || r.field === 'counterparty' ? r.field : null
  const match =
    r.match === 'equals' || r.match === 'regex' || r.match === 'contains' ? r.match : null
  if (!field || !match || typeof r.value !== 'string') return null
  return { field, match, value: r.value }
}

function coerceCategory(raw: unknown): Category {
  const r = (raw ?? {}) as Record<string, unknown>
  const rules = Array.isArray(r.rules)
    ? r.rules.map(coerceCategoryRule).filter((x): x is CategoryRule => x !== null)
    : []
  return {
    id: coerceStr(r.id, createId()),
    label: coerceStr(r.label),
    kind: CATEGORY_KINDS.includes(r.kind as CategoryKind) ? (r.kind as CategoryKind) : 'variable',
    budget: isNumber(r.budget) ? Math.round(r.budget) : null,
    rules,
    icon: typeof r.icon === 'string' ? r.icon : undefined,
  }
}

function coerceAccount(raw: unknown): Account {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: coerceStr(r.id, createId()),
    name: coerceStr(r.name, 'Konto'),
    type: r.type === 'cash' ? 'cash' : 'checking',
    balance: isNumber(r.balance) ? Math.round(r.balance) : null,
    iban: typeof r.iban === 'string' ? r.iban : undefined,
  }
}

function coerceRecurring(raw: unknown): RecurringRule {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: coerceStr(r.id, createId()),
    counterparty: coerceStr(r.counterparty),
    amountApprox: coerceSignedCents(r.amountApprox),
    cadence: 'monthly',
    categoryId: typeof r.categoryId === 'string' ? r.categoryId : null,
    nextExpected: coerceStr(r.nextExpected),
  }
}

/** Versucht, Budget-Daten aus einem Objekt zu lesen; null wenn keine Monate. */
function coerceBudget(obj: Record<string, unknown>): BackupPayload | null {
  if (typeof obj.months !== 'object' || !obj.months) return null
  const rawMonths = obj.months as Record<string, unknown>
  const monthIds = Object.keys(rawMonths).filter((id) => MONTH_ID_RE.test(id))
  if (monthIds.length === 0) return null

  const months: Record<string, Month> = {}
  for (const id of monthIds) months[id] = coerceMonth(id, rawMonths[id])

  const activeMonthId =
    typeof obj.activeMonthId === 'string' && months[obj.activeMonthId]
      ? obj.activeMonthId
      : monthIds.sort()[monthIds.length - 1]

  const rawSettings = (obj.settings ?? {}) as Record<string, unknown>
  const settings: BudgetState['settings'] = {
    currency:
      typeof rawSettings.currency === 'string' ? rawSettings.currency : DEFAULT_SETTINGS.currency,
    locale: typeof rawSettings.locale === 'string' ? rawSettings.locale : DEFAULT_SETTINGS.locale,
    savingsGoal: isNumber(rawSettings.savingsGoal) ? rawSettings.savingsGoal : 0,
  }

  const payload: BackupPayload = { months, activeMonthId, settings }
  // Transaktions-Schicht nur übernehmen, wenn vorhanden (sonst undefined lassen,
  // damit ein Alt-Backup beim Restore die aktuellen Transaktionen nicht löscht).
  if (Array.isArray(obj.transactions)) payload.transactions = obj.transactions.map(coerceTransaction)
  if (Array.isArray(obj.categories)) payload.categories = obj.categories.map(coerceCategory)
  if (Array.isArray(obj.accounts)) payload.accounts = obj.accounts.map(coerceAccount)
  if (Array.isArray(obj.recurringRules))
    payload.recurringRules = obj.recurringRules.map(coerceRecurring)
  return payload
}

function parseJsonObject(text: string): Record<string, unknown> {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Das sieht nicht nach einem Backup aus.')
  }
  return data as Record<string, unknown>
}

/** Nur Budget — bleibt für Bestandstests/Direktnutzung erhalten. */
export function buildBackup(state: BackupPayload, saldo: SaldoState = { people: [], products: [], trips: [] }): BackupFile {
  return {
    app: 'monatsbudget',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    months: state.months,
    activeMonthId: state.activeMonthId,
    settings: state.settings,
    transactions: state.transactions ?? [],
    categories: state.categories ?? [],
    accounts: state.accounts ?? [],
    recurringRules: state.recurringRules ?? [],
    saldo,
  }
}

export function serializeBackup(
  state: BackupPayload,
  saldo: SaldoState = { people: [], products: [], trips: [] },
): string {
  return JSON.stringify(buildBackup(state, saldo), null, 2)
}

export function parseBackup(text: string): BackupPayload {
  const obj = parseJsonObject(text)
  if (typeof obj.app === 'string' && obj.app !== 'monatsbudget') {
    throw new Error('Diese Datei gehört nicht zu Monatsbudget.')
  }
  if (isNumber(obj.version) && obj.version > BACKUP_VERSION) {
    throw new Error('Das Backup stammt aus einer neueren App-Version.')
  }
  const budget = coerceBudget(obj)
  if (!budget) throw new Error('Das Backup enthält keine gültigen Monate (Format YYYY-MM).')
  return budget
}

/**
 * Liest ein vereinheitlichtes Backup: Budget und/oder Saldo. Erkennt auch
 * Alt-Backups (nur Budget mit `months`, oder nur Saldo mit `trips`/`people`).
 */
export function parseUnifiedBackup(text: string): UnifiedBackup {
  const obj = parseJsonObject(text)

  if (typeof obj.app === 'string' && obj.app !== 'monatsbudget' && !isSaldoBackup(obj)) {
    throw new Error('Diese Datei gehört nicht zu Monatsbudget.')
  }
  if (isNumber(obj.version) && obj.version > BACKUP_VERSION && typeof obj.months === 'object') {
    throw new Error('Das Backup stammt aus einer neueren App-Version.')
  }

  const budget = coerceBudget(obj) ?? undefined

  let saldo: SaldoState | undefined
  if (obj.saldo && typeof obj.saldo === 'object') {
    saldo = sanitizeSaldoState(obj.saldo)
  } else if (!budget && isSaldoBackup(obj)) {
    saldo = sanitizeSaldoState(obj)
  }

  if (!budget && !saldo) {
    throw new Error('Das sieht nicht nach einem Monatsbudget-Backup aus.')
  }
  return { budget, saldo }
}
