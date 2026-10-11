import { describe, it, expect } from 'vitest'
import { calcPlan, emptyPlan, planFromMonth, verdictTone, type Plan, type PlanItem } from './plan'
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
