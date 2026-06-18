// Backup-Logik: Export/Import als JSON. Reine Funktionen (testbar), ohne DOM.
// Ein Backup umfasst sowohl das Budget als auch die Schulden/Auslagen (Saldo).
// Alt-Backups (nur Budget bzw. nur Saldo) werden weiterhin erkannt.

import type { BudgetState, LineItem, Month } from '../types/budget'
import type { SaldoState } from '../types/saldo'
import { DEFAULT_SETTINGS } from './seed'
import { createId } from './id'
import { sanitizeSaldoState, isSaldoBackup } from './saldoBackup'

export const BACKUP_VERSION = 1

export type BackupPayload = Pick<BudgetState, 'months' | 'activeMonthId' | 'settings'>

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

  return { months, activeMonthId, settings }
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
