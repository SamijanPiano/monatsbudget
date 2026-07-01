import { describe, expect, test } from 'vitest'
import type { Transaction } from '../../types/budget'
import { budgetPredictor } from './budgetPredictor'

function tx(date: string, amount: number, categoryId: string | null): Transaction {
  return {
    id: `t-${date}-${amount}-${Math.random()}`,
    date,
    amount,
    counterparty: '',
    purpose: '',
    categoryId,
    accountId: 'a1',
    source: 'import',
    hash: `h-${Math.random()}`,
  }
}

describe('budgetPredictor', () => {
  test('Median der Monatsausgaben als positiver Budgetvorschlag', () => {
    const txs = [
      tx('2026-04-10', -20000, 'food'),
      tx('2026-05-12', -22000, 'food'),
      tx('2026-06-03', -18000, 'food'),
    ]
    const out = budgetPredictor({ categoryId: 'food', transactions: txs })
    expect(out[0].value).toBe(20000)
    expect(out[0].confidence).toBeGreaterThan(0.6)
  })

  test('summiert mehrere Buchungen desselben Monats', () => {
    const txs = [
      tx('2026-05-01', -10000, 'food'),
      tx('2026-05-20', -12000, 'food'),
      tx('2026-04-01', -22000, 'food'),
      tx('2026-06-01', -22000, 'food'),
    ]
    const out = budgetPredictor({ categoryId: 'food', transactions: txs })
    expect(out[0].value).toBe(22000)
  })

  test('einzelner Monat: Vorschlag da, aber niedrige Konfidenz', () => {
    const txs = [tx('2026-06-10', -5000, 'fun')]
    const out = budgetPredictor({ categoryId: 'fun', transactions: txs })
    expect(out[0].value).toBe(5000)
    expect(out[0].confidence).toBeLessThan(0.5)
  })

  test('keine Buchungen der Kategorie: leeres Ergebnis', () => {
    const txs = [tx('2026-06-10', -5000, 'other')]
    const out = budgetPredictor({ categoryId: 'fun', transactions: txs })
    expect(out).toEqual([])
  })

  test('berücksichtigt nur das jüngste Zeitfenster (monthsBack)', () => {
    const txs = [
      tx('2026-01-01', -90000, 'food'), // alt, außerhalb von monthsBack=3
      tx('2026-04-01', -10000, 'food'),
      tx('2026-05-01', -10000, 'food'),
      tx('2026-06-01', -10000, 'food'),
    ]
    const out = budgetPredictor({ categoryId: 'food', transactions: txs, monthsBack: 3 })
    expect(out[0].value).toBe(10000)
  })
})
