// Vertrags-Logik: Ableitung aus erkannten Dauerposten + Kündigungsfristen.
// Rein funktional, deterministisch, ohne Seiteneffekte. Beträge in CENT
// (signed; negativ = Ausgabe). Daten im Format YYYY-MM-DD.

import { createId } from './id'
import type { Contract, RecurringRule } from '../types/budget'

/** Empfänger normalisieren (trimmen, Whitespace, Groß/Klein) — Verknüpfungs-Key. */
export function normalizeCounterparty(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** YYYY-MM-DD -> UTC-Date (Mittag, gegen Zeitzonen-Kippeln). */
function isoToUtc(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

/** UTC-Date -> YYYY-MM-DD. */
function utcToIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Ganztägige Differenz (Zieltag − Bezugstag) in Tagen. */
function dayDiff(target: Date, base: Date): number {
  const targetMs = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  const baseMs = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
  return Math.round((targetMs - baseMs) / 86_400_000)
}

/**
 * Leitet Vertrags-Entwürfe aus erkannten wiederkehrenden AUSFLÜSSEN ab.
 * Bereits verknüpfte Verträge (per linkedCounterpartyKey) bleiben unverändert
 * und werden nicht dupliziert — vom Nutzer gepflegte Felder gehen nicht verloren.
 * Reihenfolge: bestehende Verträge zuerst, dann neu erkannte.
 */
export function contractsFromRecurring(
  recurring: readonly RecurringRule[],
  existing: readonly Contract[],
): Contract[] {
  const known = new Set(
    existing
      .map((c) => c.linkedCounterpartyKey)
      .filter((key): key is string => Boolean(key)),
  )
  const result: Contract[] = [...existing]

  for (const rule of recurring) {
    // Nur Ausgaben werden zu Verträgen (Einnahmen wie Gehalt nicht).
    if (rule.amountApprox >= 0) continue
    const key = normalizeCounterparty(rule.counterparty)
    if (known.has(key)) continue
    known.add(key)
    result.push({
      id: createId(),
      label: rule.counterparty,
      counterparty: rule.counterparty,
      categoryId: rule.categoryId,
      amountApprox: rule.amountApprox,
      cadence: 'monthly',
      nextDue: rule.nextExpected,
      status: 'active',
      source: 'detected',
      linkedCounterpartyKey: key,
    })
  }

  return result
}

/**
 * Kündigungsfrist-Stichtag: Vertragsende − Kündigungsfrist (in Tagen).
 * null, wenn Vertragsende oder Frist fehlt.
 */
export function noticeDeadline(contract: Contract): string | null {
  if (!contract.contractEnd || contract.noticePeriodDays == null) return null
  const end = isoToUtc(contract.contractEnd)
  end.setUTCDate(end.getUTCDate() - contract.noticePeriodDays)
  return utcToIso(end)
}

/** Ein anstehender Kündigungs-Hinweis für den „Vertragswecker". */
export interface ContractReminder {
  contract: Contract
  /** Kündigungs-Stichtag YYYY-MM-DD. */
  deadline: string
  /** Tage bis zum Stichtag (0 = heute). */
  daysLeft: number
}

/**
 * Verträge, deren Kündigungs-Stichtag innerhalb der nächsten `leadDays` liegt
 * (0 ≤ daysLeft ≤ leadDays). Nur aktive Verträge. Aufsteigend nach Dringlichkeit.
 */
export function dueReminders(
  contracts: readonly Contract[],
  today: Date = new Date(),
  leadDays = 30,
): ContractReminder[] {
  const reminders: ContractReminder[] = []
  for (const contract of contracts) {
    if (contract.status !== 'active') continue
    const deadline = noticeDeadline(contract)
    if (!deadline) continue
    const daysLeft = dayDiff(isoToUtc(deadline), today)
    if (daysLeft < 0 || daysLeft > leadDays) continue
    reminders.push({ contract, deadline, daysLeft })
  }
  return reminders.sort((a, b) => a.daysLeft - b.daysLeft)
}
