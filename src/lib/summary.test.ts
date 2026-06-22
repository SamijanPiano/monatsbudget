import { describe, expect, test } from 'vitest'
import { monthlyCategoryStats } from './summary'
import type { Category, Transaction } from '../types/budget'

const cat = (id: string, label: string, kind: Category['kind'], budget: number | null = null): Category => ({
  id, label, kind, budget, rules: [],
})

const tx = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  date: '2026-06-10',
  amount: -1000,
  counterparty: 'X',
  purpose: '',
  categoryId: null,
  accountId: 'a',
  source: 'import',
  hash: Math.random().toString(36).slice(2),
  ...over,
})

const cats = [
  cat('lm', 'Lebensmittel', 'variable', 30000),
  cat('abo', 'Abos', 'fixed', 5000),
  cat('inc', 'Einkommen', 'income'),
  cat('leer', 'Versicherung', 'fixed', 8000),
]

describe('monthlyCategoryStats', () => {
  test('summiert Ausgaben je Kategorie als positive Beträge', () => {
    const txs = [
      tx({ categoryId: 'lm', amount: -4215 }),
      tx({ categoryId: 'lm', amount: -2280 }),
      tx({ categoryId: 'abo', amount: -1299 }),
    ]
    const stats = monthlyCategoryStats(txs, cats, '2026-06')
    const lm = stats.find((s) => s.categoryId === 'lm')
    expect(lm?.spent).toBe(6495)
    expect(lm?.budget).toBe(30000)
    expect(stats.find((s) => s.categoryId === 'abo')?.spent).toBe(1299)
  })

  test('ignoriert Einnahmen (amount > 0) bei spent', () => {
    const txs = [tx({ categoryId: 'inc', amount: 250000 }), tx({ categoryId: 'lm', amount: -1000 })]
    const stats = monthlyCategoryStats(txs, cats, '2026-06')
    expect(stats.find((s) => s.categoryId === 'inc')).toBeUndefined()
    expect(stats.find((s) => s.categoryId === 'lm')?.spent).toBe(1000)
  })

  test('zählt nur den angefragten Monat', () => {
    const txs = [tx({ categoryId: 'lm', amount: -1000, date: '2026-05-30' }), tx({ categoryId: 'lm', amount: -2000, date: '2026-06-02' })]
    const stats = monthlyCategoryStats(txs, cats, '2026-06')
    expect(stats.find((s) => s.categoryId === 'lm')?.spent).toBe(2000)
  })

  test('bündelt unkategorisierte Ausgaben separat', () => {
    const txs = [tx({ categoryId: null, amount: -5990 })]
    const stats = monthlyCategoryStats(txs, cats, '2026-06')
    const un = stats.find((s) => s.categoryId === null)
    expect(un?.spent).toBe(5990)
    expect(un?.kind).toBe('uncategorized')
  })

  test('nimmt Kategorien mit Budget auch ohne Ausgaben auf (spent 0)', () => {
    const stats = monthlyCategoryStats([], cats, '2026-06')
    const leer = stats.find((s) => s.categoryId === 'leer')
    expect(leer?.spent).toBe(0)
    expect(leer?.budget).toBe(8000)
  })

  test('sortiert nach Ausgaben absteigend', () => {
    const txs = [tx({ categoryId: 'abo', amount: -1299 }), tx({ categoryId: 'lm', amount: -6495 })]
    const stats = monthlyCategoryStats(txs, cats, '2026-06').filter((s) => s.spent > 0)
    expect(stats[0].categoryId).toBe('lm')
    expect(stats[1].categoryId).toBe('abo')
  })
})
