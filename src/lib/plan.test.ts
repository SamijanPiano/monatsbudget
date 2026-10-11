import { describe, it, expect } from 'vitest'
import { calcMonth, calcSituation } from './calc'
import { hasCurrentBalance, verdictTone } from './plan'
import type { LineItem, Month } from '../types/budget'

function item(label: string, konto: number, bar = 0): LineItem {
  return { id: label, label, konto, bar }
}

/** Werte aus Monatsbudget.xlsx (Stand 15.09.2026), Blatt „Monatskalkulation". */
function excelMonth(patch: Partial<Month> = {}): Month {
  return {
    id: '2026-10',
    income: [item('Gehalt (Überweisung)', 990)],
    fixed: [
      item('Spotify', 7.2),
      item('Aldi Talk', 15),
      item('iCloud', 10),
      item('Netflix', 14),
      item('Tanken (geschätzt)', 240),
    ],
    variable: [item('Nadja', 120), item('Andere', 100)],
    savingsKonto: 300,
    savingsBar: 0,
    currentKonto: 543,
    currentBar: 0,
    ...patch,
  }
}

function evaluate(month: Month) {
  const calc = calcMonth(month)
  const situation = calcSituation(month, calc)
  return { calc, situation, tone: verdictTone(month, calc, situation) }
}

describe('Monatsplan rechnet wie die Excel', () => {
  const { calc, situation } = evaluate(excelMonth())

  it('C20 feste Abzüge = 286,20 €', () => {
    expect(calc.fixedTotal).toBe(286.2)
  })

  it('C30 Konto nach Abzügen = 483,80 €', () => {
    expect(calc.kontoAfterDeductions).toBe(483.8)
  })

  it('C41 Puffer nach Sparen = 183,80 €', () => {
    expect(calc.bufferKonto).toBe(183.8)
  })

  it('C64 Konto braucht gesamt = 506,20 €', () => {
    expect(situation.kontoNeededTotal).toBe(506.2)
  })

  it('C65 Konto danach = 36,80 € → „JA, Konto reicht"', () => {
    expect(situation.kontoRemaining).toBe(36.8)
    expect(situation.isEnough).toBe(true)
  })
})

describe('verdictTone', () => {
  it('ohne eingetragenen Stand: unknown statt geratenem Urteil', () => {
    const month = excelMonth({ currentKonto: 0, currentBar: 0 })
    expect(hasCurrentBalance(month)).toBe(false)
    expect(evaluate(month).tone).toBe('unknown')
  })

  it('nur Bargeld eingetragen zählt als Stand', () => {
    expect(hasCurrentBalance(excelMonth({ currentKonto: 0, currentBar: 20 }))).toBe(true)
  })

  it('Konto im Minus: short', () => {
    expect(evaluate(excelMonth({ currentKonto: 400 })).tone).toBe('short')
  })

  it('reichlich Puffer: ok', () => {
    expect(evaluate(excelMonth({ currentKonto: 2000 })).tone).toBe('ok')
  })

  it('Kontostand genau aufgebraucht (0 € übrig) reicht noch, wie in der Excel', () => {
    const tone = evaluate(excelMonth({ currentKonto: 506.2 })).tone
    expect(tone).not.toBe('short')
  })
})
