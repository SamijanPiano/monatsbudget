import { describe, it, expect } from 'vitest'
import { calcPlan, type Plan, type PlanItem } from './plan'
import { calcDailyPool, daysLeft, isPooled, poolSpent, poolTransactions } from './dailyPool'
import { UNASSIGNED, type PeriodActuals } from './planMatch'
import type { Transaction } from '../types/budget'

function item(label: string, amount: number, extra: Partial<PlanItem> = {}): PlanItem {
  return { id: label, label, amount, ...extra }
}

/** Samuels Plan, Stand 16.10.2026. */
function samuelPlan(patch: Partial<Plan> = {}): Plan {
  return {
    income: [item('Gehalt', 1130, { salary: true })],
    fixed: [
      item('Handy Guthaben', 15),
      item('Netflix', 14),
      item('iCloud', 10),
      item('Spotify', 7.2),
      item('Abo / Abzug', 57),
      item('Figma', 24),
    ],
    variable: [
      item('Tanken', 240),
      item('Nadja', 120),
      item('Andere', 100),
      item('Daily', 150, { catchAll: true }),
    ],
    savings: 350,
    balance: 0,
    ...patch,
  }
}

function pool(plan: Plan) {
  return calcDailyPool(plan, calcPlan(plan))
}

describe('isPooled', () => {
  it('Sammelposten gehört immer zum Topf', () => {
    expect(isPooled(item('Daily', 150, { catchAll: true, pooled: false }))).toBe(true)
  })

  it('„Andere", „Allgemein", „Zusätzliche", „Nadja" gehören ohne Markierung dazu, andere Namen nicht', () => {
    expect(isPooled(item('Andere', 100))).toBe(true)
    expect(isPooled(item('Allgemein', 50))).toBe(true)
    expect(isPooled(item('Zusätzliche Ausgaben', 50))).toBe(true)
    expect(isPooled(item('Nadja', 120))).toBe(true)
    expect(isPooled(item('Nadia', 120))).toBe(true)
    expect(isPooled(item('Tanken', 240))).toBe(false)
  })

  it('ausdrückliche Markierung schlägt den Namen', () => {
    expect(isPooled(item('Andere', 100, { pooled: false }))).toBe(false)
    expect(isPooled(item('Tanken', 240, { pooled: true }))).toBe(true)
  })
})

describe('calcDailyPool', () => {
  it('Puffer nach Sparen fließt ins Daily', () => {
    const p = pool(samuelPlan())
    expect(p.dailyBase).toBe(150)
    expect(p.others).toBe(220)
    expect(p.buffer).toBe(42.8)
    expect(p.daily).toBe(192.8)
    expect(p.total).toBe(412.8)
    expect(p.dailyCut).toBe(0)
  })

  it('max. sparen lässt Daily beim Grundbetrag stehen', () => {
    const plan = samuelPlan()
    expect(calcPlan(plan).maxSave).toBe(392.8)
    const p = pool({ ...plan, savings: 392.8 })
    expect(p.daily).toBe(150)
    expect(p.buffer).toBe(0)
  })

  it('wer mehr spart als das Maximum, kürzt nur das Daily', () => {
    const p = pool(samuelPlan({ savings: 450 }))
    expect(p.dailyCut).toBe(57.2)
    expect(p.daily).toBe(92.8)
    expect(p.others).toBe(220)
    expect(p.total).toBe(312.8)
  })

  it('ohne Sammelposten ist der Daily-Grundbetrag 0', () => {
    const plan = samuelPlan({ variable: [item('Andere', 100)] })
    const p = pool(plan)
    expect(p.dailyBase).toBe(0)
    expect(p.others).toBe(100)
  })
})

function tx(id: string, cents: number, date = '2026-10-16'): Transaction {
  return { id, amount: -cents, date } as Transaction
}

describe('poolSpent', () => {
  it('rechnet Buchungen aller Topf-Posten und nicht zugeordnete zusammen', () => {
    const p = pool(samuelPlan())
    const actuals: PeriodActuals = {
      byTarget: {
        Andere: { cents: 1200, transactions: [tx('a', 1200)] },
        Daily: { cents: 1950, transactions: [tx('b', 1000), tx('c', 950)] },
        [UNASSIGNED]: { cents: 300, transactions: [tx('d', 300)] },
        Tanken: { cents: 6000, transactions: [tx('e', 6000)] },
      },
    }
    expect(poolSpent(p, actuals)).toEqual({ cents: 3450, count: 4 })
  })

  it('Nadja zählt mit in den Topf', () => {
    const p = pool(samuelPlan())
    const actuals: PeriodActuals = {
      byTarget: {
        Nadja: { cents: 4000, transactions: [tx('n', 4000)] },
        Daily: { cents: 1000, transactions: [tx('b', 1000)] },
      },
    }
    expect(poolSpent(p, actuals)).toEqual({ cents: 5000, count: 2 })
  })
})

describe('poolTransactions', () => {
  it('mischt alle Topf-Buchungen mit ihrem Posten, neueste zuerst, ohne fremde Posten', () => {
    const p = pool(samuelPlan())
    const actuals: PeriodActuals = {
      byTarget: {
        Nadja: { cents: 4000, transactions: [tx('n', 4000, '2026-10-18')] },
        Daily: { cents: 1000, transactions: [tx('b', 1000, '2026-10-20')] },
        [UNASSIGNED]: { cents: 300, transactions: [tx('d', 300, '2026-10-17')] },
        Tanken: { cents: 6000, transactions: [tx('e', 6000, '2026-10-19')] },
      },
    }
    expect(poolTransactions(p, actuals).map((e) => [e.tx.id, e.target])).toEqual([
      ['b', 'Daily'],
      ['n', 'Nadja'],
      ['d', UNASSIGNED],
    ])
  })
})

describe('daysLeft', () => {
  const period = { start: '2026-10-15', end: '2026-11-14' }

  it('zählt heute mit', () => {
    expect(daysLeft(period, '2026-10-16')).toBe(30)
    expect(daysLeft(period, '2026-11-14')).toBe(1)
  })

  it('außerhalb der Periode: null', () => {
    expect(daysLeft(period, '2026-11-15')).toBeNull()
    expect(daysLeft(period, '2026-10-14')).toBeNull()
  })
})
