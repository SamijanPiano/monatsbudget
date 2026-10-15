import { describe, expect, it } from 'vitest'
import { migratePlanState } from './planStore'

describe('migratePlanState', () => {
  it('v1 → v2: ergänzt Rollen und leere Verschiebungen', () => {
    const v1 = {
      plan: {
        income: [{ id: 'g', label: 'Gehalt', amount: 990 }],
        fixed: [],
        variable: [{ id: 't', label: 'Täglicher Verbrauch', amount: 220 }],
        savings: 300,
        balance: 0,
      },
    }
    const out = migratePlanState(v1, 1) as { plan: typeof v1.plan & Record<string, unknown>; overrides: object }
    expect(out.overrides).toEqual({})
    expect(out.plan.income[0]).toMatchObject({ salary: true })
    expect(out.plan.variable[0]).toMatchObject({ catchAll: true })
  })

  it('lässt v2-Daten unverändert', () => {
    const v2 = { plan: { income: [], fixed: [], variable: [], savings: 0, balance: 0 }, overrides: { a: 'b' } }
    expect(migratePlanState(v2, 2)).toBe(v2)
  })
})

describe('migratePlanState mit beschädigten Daten', () => {
  it('fehlende Listen werden zu leeren Listen statt abzustürzen', () => {
    const out = migratePlanState({ plan: { savings: 0, balance: 0 } }, 1) as {
      plan: { income: unknown[]; variable: { catchAll?: boolean }[] }
    }
    expect(out.plan.income).toEqual([])
    expect(out.plan.variable[0].catchAll).toBe(true)
  })
})
