// Daily-Topf: „Andere", „Daily" (Sammelposten) und der Puffer nach Sparen
// werden am Ende zu einem Betrag zusammengefasst. Die Posten bleiben als
// Schätzung einzeln eintragbar, die laufenden Buchungen zählen gemeinsam.
// Daily ist der Grundbetrag, mit dem Samuel plant: Was nach dem Sparen übrig
// bleibt, kommt dazu; wer mehr spart als möglich, kürzt nur das Daily.
// Reine Funktionen, keine UI.

import { round2 } from './calc'
import type { Plan, PlanCalc, PlanItem } from './plan'
import { UNASSIGNED, type PeriodActuals } from './planMatch'
import type { Period } from './period'

/** Posten mit diesem Namen gehören ohne Markierung zum Topf. */
const POOL_HINT = /^(andere|allgemein)\b/i
const DAY_MS = 86_400_000

function safe(value: number): number {
  return Number.isFinite(value) ? value : 0
}

/** Gehört der Posten zum Daily-Topf? Sammelposten immer, sonst Markierung vor Name. */
export function isPooled(item: PlanItem): boolean {
  if (item.catchAll) return true
  return item.pooled ?? POOL_HINT.test(item.label.trim())
}

export interface DailyPool {
  /** Alle Topf-Posten (Ausgaben). */
  items: PlanItem[]
  /** Daily-Grundbetrag (Sammelposten), die Planungsbasis. */
  dailyBase: number
  /** Übrige Topf-Posten (Andere …), als Schätzung eingetragen. */
  others: number
  /** Puffer nach Sparen; negativ, wenn der Sparbetrag über dem Maximum liegt. */
  buffer: number
  /** Daily tatsächlich: Grundbetrag plus Puffer. */
  daily: number
  /** Ganzer Topf: übrige Posten plus Daily tatsächlich. */
  total: number
  /** Um so viel sinkt Daily, weil mehr gespart wird als möglich. */
  dailyCut: number
}

export function calcDailyPool(plan: Plan, calc: PlanCalc): DailyPool {
  const items = [...plan.fixed, ...plan.variable].filter(isPooled)
  const catchAll = items.find((i) => i.catchAll)
  const dailyBase = round2(safe(catchAll?.amount ?? 0))
  const others = round2(
    items.filter((i) => !i.catchAll).reduce((acc, i) => acc + safe(i.amount), 0),
  )
  // calc.buffer = Einnahmen − alle Ausgaben (inkl. Topf-Posten) − Sparen.
  const buffer = calc.buffer
  const daily = round2(dailyBase + buffer)
  return {
    items,
    dailyBase,
    others,
    buffer,
    daily,
    total: round2(others + daily),
    dailyCut: round2(Math.max(0, -buffer)),
  }
}

/** Buchungen aller Topf-Posten plus nicht zugeordnete, gemeinsam gezählt. */
export function poolSpent(pool: DailyPool, actuals: PeriodActuals): { cents: number; count: number } {
  const targets = [...pool.items.map((i) => i.id), UNASSIGNED]
  return targets.reduce(
    (acc, id) => {
      const actual = actuals.byTarget[id]
      return actual
        ? { cents: acc.cents + actual.cents, count: acc.count + actual.transactions.length }
        : acc
    },
    { cents: 0, count: 0 },
  )
}

/** Verbleibende Tage der Periode, heute mitgezählt; null außerhalb der Periode. */
export function daysLeft(period: Period, today: string): number | null {
  if (today < period.start || today > period.end) return null
  const diff = Date.parse(`${period.end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)
  return Math.round(diff / DAY_MS) + 1
}
