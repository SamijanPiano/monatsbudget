import { describe, it, expect } from 'vitest'
import { calcMonth, calcSituation, round2, sumKonto, sumBar } from './calc'
import { makeSampleMonth } from './sampleMonth'
import type { Month } from '../types/budget'

const sample: Month = makeSampleMonth()

describe('round2', () => {
  it('rundet auf zwei Nachkommastellen', () => {
    expect(round2(7.199999)).toBe(7.2)
    expect(round2(46.2)).toBe(46.2)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})

describe('sumKonto / sumBar', () => {
  it('summiert die Konto-Spalte', () => {
    expect(sumKonto(sample.fixed)).toBe(50)
  })

  it('ignoriert NaN-Beträge sicher', () => {
    const items = [
      { id: 'a', label: 'x', konto: Number.NaN, bar: 10 },
      { id: 'b', label: 'y', konto: 5, bar: Number.NaN },
    ]
    expect(sumKonto(items)).toBe(5)
    expect(sumBar(items)).toBe(10)
  })
})

describe('calcMonth — Beispielmonat (2000/500 · fix 50 · var 300/500)', () => {
  const c = calcMonth(sample)

  it('Einnahmen: Konto 2000, Bar 500', () => {
    expect(c.incomeKonto).toBe(2000)
    expect(c.incomeBar).toBe(500)
  })

  it('Feste Abzüge gesamt = 50', () => {
    expect(c.fixedTotal).toBe(50)
  })

  it('Variable Ausgaben: Konto 300, Bar 500', () => {
    expect(c.variableKonto).toBe(300)
    expect(c.variableBar).toBe(500)
  })

  it('Konto nach allen Abzügen = 1650', () => {
    expect(c.kontoAfterDeductions).toBe(1650)
  })

  it('Bar nach Ausgaben = 0', () => {
    expect(c.barAfterExpenses).toBe(0)
  })

  it('Sicherheitspuffer Konto = 1050 (1650 − 600)', () => {
    expect(c.bufferKonto).toBe(1050)
  })

  it('Gesamtersparnis = 600', () => {
    expect(c.totalSavings).toBe(600)
  })
})

describe('calcMonth — Randfälle', () => {
  it('MAX sparen wird nie negativ angezeigt', () => {
    const broke: Month = {
      ...sample,
      income: [{ id: 'g', label: 'Gehalt', konto: 100, bar: 0 }],
    }
    const c = calcMonth(broke)
    expect(c.kontoAfterDeductions).toBeLessThan(0)
    expect(c.maxSaveKonto).toBe(0)
  })

  it('Puffer darf negativ sein (Sparbetrag höher als verfügbar)', () => {
    const c = calcMonth({ ...sample, savingsKonto: 2000 })
    expect(c.bufferKonto).toBeLessThan(0)
  })
})

describe('calcSituation — „Reicht es?"', () => {
  it('reicht knapp: Stand 1000 → Puffer 150', () => {
    const c = calcMonth(sample)
    const s = calcSituation(sample, c)
    expect(s.kontoNeededFixedVar).toBe(350)
    expect(s.barCovers).toBe(0)
    expect(s.restBarToKonto).toBe(500)
    expect(s.kontoNeededTotal).toBe(850)
    expect(s.kontoRemaining).toBe(150)
    expect(s.isEnough).toBe(true)
    expect(s.diff).toBe(150)
  })

  it('reicht nicht: Stand 500 → es fehlen 350', () => {
    const month = { ...sample, currentKonto: 500 }
    const c = calcMonth(month)
    const s = calcSituation(month, c)
    expect(s.kontoRemaining).toBe(-350)
    expect(s.isEnough).toBe(false)
    expect(s.diff).toBe(350)
  })

  it('Bargeld deckt Bar-Ausgaben: 600 bar → 0 Rest aufs Konto', () => {
    const month = { ...sample, currentBar: 600 }
    const c = calcMonth(month)
    const s = calcSituation(month, c)
    expect(s.barCovers).toBe(500)
    expect(s.restBarToKonto).toBe(0)
    expect(s.kontoRemaining).toBe(650)
    expect(s.barRemaining).toBe(100)
    expect(s.isEnough).toBe(true)
  })
})
