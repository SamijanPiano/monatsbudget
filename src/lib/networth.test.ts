import { describe, it, expect } from 'vitest'
import { netWorth } from './networth'
import type { Account } from '../types/budget'

function acc(partial: Partial<Account> & { id: string }): Account {
  return {
    name: 'Konto',
    type: 'checking',
    balance: 0,
    ...partial,
  }
}

describe('netWorth', () => {
  it('summiert Vermögenswerte', () => {
    const accounts = [
      acc({ id: '1', type: 'checking', balance: 120000 }),
      acc({ id: '2', type: 'cash', balance: 5000 }),
      acc({ id: '3', type: 'paypal', balance: 3000 }),
    ]
    const r = netWorth(accounts)
    expect(r.assets).toBe(128000)
    expect(r.liabilities).toBe(0)
    expect(r.total).toBe(128000)
  })

  it('zieht Schulden (isLiability) ab — unabhängig vom Vorzeichen', () => {
    const accounts = [
      acc({ id: '1', type: 'checking', balance: 100000 }),
      acc({ id: '2', type: 'credit', balance: -25000, isLiability: true }),
      acc({ id: '3', type: 'credit', balance: 10000, isLiability: true }),
    ]
    const r = netWorth(accounts)
    expect(r.assets).toBe(100000)
    expect(r.liabilities).toBe(35000) // |−25000| + |10000|
    expect(r.total).toBe(65000)
  })

  it('ignoriert Konten mit unbekanntem Saldo (null)', () => {
    const accounts = [
      acc({ id: '1', type: 'checking', balance: null }),
      acc({ id: '2', type: 'cash', balance: 5000 }),
    ]
    const r = netWorth(accounts)
    expect(r.assets).toBe(5000)
    expect(r.total).toBe(5000)
  })

  it('ein überzogenes (negatives) Vermögenskonto reduziert die Summe', () => {
    const accounts = [
      acc({ id: '1', type: 'checking', balance: -2000 }),
      acc({ id: '2', type: 'cash', balance: 5000 }),
    ]
    const r = netWorth(accounts)
    expect(r.assets).toBe(3000)
    expect(r.total).toBe(3000)
  })

  it('leere Kontoliste ergibt 0', () => {
    expect(netWorth([])).toEqual({ assets: 0, liabilities: 0, total: 0 })
  })
})
