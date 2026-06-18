// Backup-Logik: Export/Import des kompletten Budget-Zustands als JSON.
// Reine Funktionen (testbar), ohne DOM-Zugriff.

import type { BudgetState, LineItem, Month } from '../types/budget'
import { DEFAULT_SETTINGS } from './seed'
import { createId } from './id'

export const BACKUP_VERSION = 1

export interface BackupFile {
  app: 'monatsbudget'
  version: number
  exportedAt: string
  months: Record<string, Month>
  activeMonthId: string
  settings: BudgetState['settings']
}

type BackupPayload = Pick<BudgetState, 'months' | 'activeMonthId' | 'settings'>

export function buildBackup(state: BackupPayload): BackupFile {
  return {
    app: 'monatsbudget',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    months: state.months,
    activeMonthId: state.activeMonthId,
    settings: state.settings,
  }
}

export function serializeBackup(state: BackupPayload): string {
  return JSON.stringify(buildBackup(state), null, 2)
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

/** YYYY-MM erwarten. */
const MONTH_ID_RE = /^\d{4}-\d{2}$/

/**
 * Liest einen JSON-Backup-Text ein und gibt einen validierten Zustand zurück.
 * Wirft eine Fehlermeldung bei ungültigen Daten.
 */
export function parseBackup(text: string): BackupPayload {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.')
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Das sieht nicht nach einem Monatsbudget-Backup aus.')
  }
  const obj = data as Record<string, unknown>

  if (typeof obj.app === 'string' && obj.app !== 'monatsbudget') {
    throw new Error('Diese Datei gehört nicht zu Monatsbudget.')
  }
  if (isNumber(obj.version) && obj.version > BACKUP_VERSION) {
    throw new Error('Das Backup stammt aus einer neueren App-Version.')
  }
  if (typeof obj.months !== 'object' || !obj.months) {
    throw new Error('Das sieht nicht nach einem Monatsbudget-Backup aus.')
  }

  const rawMonths = obj.months as Record<string, unknown>
  const monthIds = Object.keys(rawMonths).filter((id) => MONTH_ID_RE.test(id))
  if (monthIds.length === 0) {
    throw new Error('Das Backup enthält keine gültigen Monate (Format YYYY-MM).')
  }

  const months: Record<string, Month> = {}
  for (const id of monthIds) {
    months[id] = coerceMonth(id, rawMonths[id])
  }

  const activeMonthId =
    typeof obj.activeMonthId === 'string' && months[obj.activeMonthId]
      ? obj.activeMonthId
      : monthIds.sort()[monthIds.length - 1]

  const rawSettings = (obj.settings ?? {}) as Record<string, unknown>
  const settings: BudgetState['settings'] = {
    currency:
      typeof rawSettings.currency === 'string' ? rawSettings.currency : DEFAULT_SETTINGS.currency,
    locale:
      typeof rawSettings.locale === 'string' ? rawSettings.locale : DEFAULT_SETTINGS.locale,
    savingsGoal: isNumber(rawSettings.savingsGoal) ? rawSettings.savingsGoal : 0,
  }

  return { months, activeMonthId, settings }
}
