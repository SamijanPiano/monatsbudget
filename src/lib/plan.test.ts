import { describe, it, expect } from 'vitest'
import {
  calcPlan,
  emptyPlan,
  ensurePlanRoles,
  learnCounterparty,
  planFromMonth,
  setRole,
  verdictTone,
  type Plan,
  type PlanItem,
} from './plan'
import type { Month } from '../types/budget'

function item(label: string, amount: number): PlanItem {
  return { id: label, label, amount }
}

/** Werte aus Monatsbudget.xlsx (Stand 15.09.2026), Blatt „Monatskalkulation". */
function excelPlan(patch: Partial<Plan> = {}): Plan {
  return {
    income: [item('Gehalt (Überweisung)', 990)],
    fixed: [
      item('Spotify', 7.2),
      item('Aldi Talk', 15),
      item('iCloud', 10),
      item('Netflix', 14),
      item('Tanken (geschätzt)', 240),
    ],
    variable: [item('Nadja', 120), item('Andere', 100)],
    savings: 300,
    balance: 543,
    ...patch,
  }
}

describe('calcPlan rechnet wie die Excel', () => {
  const c = calcPlan(excelPlan())

  it('C20 feste Abzüge = 286,20 €', () => {
    expect(c.fixed).toBe(286.2)
  })

  it('C30 nach Abzügen & Ausgaben = 483,80 €', () => {
    expect(c.afterExpenses).toBe(483.8)
    expect(c.maxSave).toBe(483.8)
  })

  it('C41 Puffer nach Sparen = 183,80 €', () => {
    expect(c.buffer).toBe(183.8)
  })

  it('C64 geht noch ab = 506,20 €', () => {
    expect(c.needed).toBe(506.2)
  })

  it('C65 Konto danach = 36,80 € → reicht', () => {
    expect(c.remaining).toBe(36.8)
    expect(c.isEnough).toBe(true)
  })

  it('maximal sparen wird nie negativ', () => {
    const minus = calcPlan(excelPlan({ income: [item('Gehalt', 100)] }))
    expect(minus.afterExpenses).toBe(-406.2)
    expect(minus.maxSave).toBe(0)
  })

  it('ignoriert NaN-Beträge sicher', () => {
    const c2 = calcPlan({ ...emptyPlan(), income: [item('x', Number.NaN), item('y', 5)] })
    expect(c2.income).toBe(5)
  })
})

describe('planFromMonth', () => {
  it('übernimmt nur die Konto-Spalte, reine Bar-Posten fallen weg', () => {
    const month: Month = {
      id: '2026-10',
      income: [
        { id: 'a', label: 'Gehalt', konto: 990, bar: 50 },
        { id: 'c', label: 'Gehalt (Bar)', konto: 0, bar: 80 },
        { id: 'd', label: 'Neu, noch leer', konto: 0, bar: 0 },
      ],
      fixed: [{ id: 'b', label: 'Spotify', konto: 7.2, bar: 0 }],
      variable: [],
      savingsKonto: 300,
      savingsBar: 20,
      currentKonto: 543,
      currentBar: 40,
    }
    expect(planFromMonth(month)).toEqual({
      income: [
        { id: 'a', label: 'Gehalt', amount: 990 },
        { id: 'd', label: 'Neu, noch leer', amount: 0 },
      ],
      fixed: [{ id: 'b', label: 'Spotify', amount: 7.2 }],
      variable: [],
      savings: 300,
      balance: 543,
    })
  })

  it('ohne Monat: leerer Plan', () => {
    expect(planFromMonth(undefined)).toEqual(emptyPlan())
  })
})

describe('verdictTone', () => {
  const tone = (p: Plan) => verdictTone(p, calcPlan(p))

  it('ohne Kontostand: unknown statt geratenem Urteil', () => {
    expect(tone(excelPlan({ balance: 0 }))).toBe('unknown')
  })

  it('Konto im Minus: short', () => {
    expect(tone(excelPlan({ balance: 400 }))).toBe('short')
  })

  it('reichlich Puffer: ok', () => {
    expect(tone(excelPlan({ balance: 2000 }))).toBe('ok')
  })

  it('genau aufgebraucht (0 € übrig) reicht noch, wie in der Excel', () => {
    expect(tone(excelPlan({ balance: 506.2 }))).not.toBe('short')
  })
})

describe('ensurePlanRoles', () => {
  it('markiert einen vorhandenen „Täglicher Verbrauch"-Posten als Sammelposten und das erste Einkommen als Gehalt', () => {
    const plan = {
      ...emptyPlan(),
      income: [{ id: 'g', label: 'Gehalt', amount: 990 }, { id: 'n', label: 'Nebenjob', amount: 100 }],
      variable: [{ id: 'v', label: 'Täglicher Verbrauch', amount: 220 }],
    }
    const out = ensurePlanRoles(plan)
    expect(out.variable[0].catchAll).toBe(true)
    expect(out.income[0].salary).toBe(true)
    expect(out.income[1].salary).toBeUndefined()
  })

  it('legt den Sammelposten an, wenn keiner existiert', () => {
    const out = ensurePlanRoles(emptyPlan())
    expect(out.variable).toHaveLength(1)
    expect(out.variable[0]).toMatchObject({ label: 'Täglicher Verbrauch', amount: 0, catchAll: true })
  })

  it('lässt bestehende Rollen unverändert', () => {
    const plan = ensurePlanRoles(emptyPlan())
    expect(ensurePlanRoles(plan)).toEqual(plan)
  })
})

describe('learnCounterparty', () => {
  it('hängt den Empfänger am Ziel an und entfernt ihn überall sonst', () => {
    const plan = {
      ...emptyPlan(),
      fixed: [{ id: 'a', label: 'A', amount: 0, counterparties: ['rewe'] }],
      variable: [{ id: 'b', label: 'B', amount: 0 }],
    }
    const out = learnCounterparty(plan, 'rewe', 'b')
    expect(out.fixed[0].counterparties).toEqual([])
    expect(out.variable[0].counterparties).toEqual(['rewe'])
  })

  it('Sonderziel: Empfänger wird nur entfernt', () => {
    const plan = { ...emptyPlan(), variable: [{ id: 'b', label: 'B', amount: 0, counterparties: ['rewe'] }] }
    expect(learnCounterparty(plan, 'rewe', 'excluded').variable[0].counterparties).toEqual([])
  })
})

describe('setRole', () => {
  it('genau ein Posten trägt die Rolle', () => {
    const plan = ensurePlanRoles({
      ...emptyPlan(),
      variable: [{ id: 'x', label: 'Essen', amount: 0 }],
    })
    const out = setRole(plan, 'catchAll', 'x')
    expect(out.variable.filter((i) => i.catchAll).map((i) => i.id)).toEqual(['x'])
  })
})

describe('learnCounterparty ohne Empfänger', () => {
  it('lernt nichts, wenn der Empfänger leer ist', () => {
    const plan = { ...emptyPlan(), variable: [{ id: 'b', label: 'B', amount: 0 }] }
    expect(learnCounterparty(plan, '', 'b')).toBe(plan)
  })
})

describe('learnCounterparty für Sparen und Nicht zählen', () => {
  it('merkt sich Sonderziele und nimmt den Empfänger aus allen Posten', () => {
    const plan = { ...emptyPlan(), variable: [{ id: 'd', label: 'Daily', amount: 150, counterparties: ['sempf samuel'] }] }
    const out = learnCounterparty(plan, 'sempf samuel', 'savings')
    expect(out.learnedSpecial).toEqual({ 'sempf samuel': 'savings' })
    expect(out.variable[0].counterparties).toEqual([])
  })

  it('Verschieben zurück in einen Posten vergisst das Sonderziel', () => {
    const plan = { ...emptyPlan(), variable: [{ id: 'd', label: 'Daily', amount: 150 }], learnedSpecial: { x: 'savings' } }
    const out = learnCounterparty(plan, 'x', 'd')
    expect(out.learnedSpecial).toEqual({})
    expect(out.variable[0].counterparties).toEqual(['x'])
  })
})

