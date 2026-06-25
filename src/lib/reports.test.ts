import { describe, it, expect } from 'vitest'
import { categoryTotals, monthRange, monthlySeries } from './reports'
import type { Category, Transaction } from '../types/budget'

function tx(partial: Partial<Transaction> & { date: string; amount: number }): Transaction {
  return {
    id: `tx-${partial.date}-${partial.amount}`,
    counterparty: 'X',
    purpose: '',
    categoryId: null,
    accountId: 'acc-1',
    source: 'import',
    hash: `${partial.date}-${partial.amount}`,
    ...partial,
  }
}

const cat = (id: string, label: string): Category => ({
  id,
  label,
  kind: 'variable',
  budget: null,
  rules: [],
})

describe('monthRange', () => {
  it('liefert die inklusive Monatsliste', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('ein einzelner Monat', () => {
    expect(monthRange('2025-06', '2025-06')).toEqual(['2025-06'])
  })

  it('leer, wenn from nach to liegt', () => {
    expect(monthRange('2026-02', '2025-11')).toEqual([])
  })
})

describe('monthlySeries', () => {
  const txs: Transaction[] = [
    tx({ date: '2025-01-10', amount: 200000 }),
    tx({ date: '2025-01-12', amount: -5000 }),
    tx({ date: '2025-02-10', amount: 200000 }),
    tx({ date: '2025-02-15', amount: -8000 }),
  ]

  it('liefert je Monat Einnahmen/Ausgaben/Netto', () => {
    const series = monthlySeries(txs, '2025-01', '2025-02')
    expect(series).toHaveLength(2)
    expect(series[0]).toEqual({ key: '2025-01', income: 200000, expenses: 5000, net: 195000 })
    expect(series[1]).toEqual({ key: '2025-02', income: 200000, expenses: 8000, net: 192000 })
  })

  it('füllt Monate ohne Buchungen mit Nullen', () => {
    const series = monthlySeries(txs, '2025-01', '2025-03')
    expect(series[2]).toEqual({ key: '2025-03', income: 0, expenses: 0, net: 0 })
  })
})

describe('categoryTotals', () => {
  const categories = [cat('c-food', 'Lebensmittel'), cat('c-fun', 'Freizeit')]
  const txs: Transaction[] = [
    tx({ date: '2025-01-05', amount: -3000, categoryId: 'c-food' }),
    tx({ date: '2025-02-05', amount: -2000, categoryId: 'c-food' }),
    tx({ date: '2025-02-10', amount: -5000, categoryId: 'c-fun' }),
    tx({ date: '2025-02-20', amount: -1500, categoryId: null }), // unkategorisiert
    tx({ date: '2025-02-25', amount: 100000, categoryId: 'c-food' }), // Einnahme -> ignorieren
    tx({ date: '2025-03-01', amount: -9999, categoryId: 'c-food' }), // außerhalb Zeitraum
  ]

  it('summiert Ausgaben je Kategorie über den Zeitraum, absteigend', () => {
    const totals = categoryTotals(txs, categories, '2025-01', '2025-02')
    expect(totals).toEqual([
      { categoryId: 'c-food', label: 'Lebensmittel', total: 5000 },
      { categoryId: 'c-fun', label: 'Freizeit', total: 5000 },
      { categoryId: null, label: 'Unkategorisiert', total: 1500 },
    ])
  })

  it('grenzt den Zeitraum korrekt ab (März bleibt außen vor)', () => {
    const totals = categoryTotals(txs, categories, '2025-01', '2025-02')
    const food = totals.find((t) => t.categoryId === 'c-food')
    expect(food?.total).toBe(5000) // ohne den März-Posten (-9999)
  })

  it('ignoriert Einnahmen', () => {
    const totals = categoryTotals(txs, categories, '2025-02', '2025-02')
    const food = totals.find((t) => t.categoryId === 'c-food')
    expect(food?.total).toBe(2000)
  })
})
