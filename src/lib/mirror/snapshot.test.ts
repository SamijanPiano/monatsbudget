import { describe, expect, it } from 'vitest'
import { buildSnapshot, type SnapshotInput } from './snapshot'
import type { Transaction } from '../../types/budget'

let n = 0
const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  date: '2026-10-20',
  amount: -1299,
  counterparty: 'REWE Markt',
  purpose: 'Einkauf',
  categoryId: null,
  accountId: 'acc',
  source: 'sync',
  hash: `h${n}`,
  ...over,
})

function input(transactions: Transaction[]): SnapshotInput {
  return {
    today: '2026-10-21',
    transactions,
    categories: [{ id: 'c-inc', label: 'Einkommen', kind: 'income', budget: null, rules: [] }],
    accounts: [{ id: 'acc', name: 'Giro', type: 'checking', balance: 54300 }],
    recurringRules: [],
    contracts: [],
    bankPending: null,
    dismissedDuplicates: [],
    plan: {
      income: [{ id: 'g', label: 'Gehalt', amount: 990, salary: true }],
      fixed: [],
      variable: [{ id: 'v', label: 'Täglicher Verbrauch', amount: 220, catchAll: true }],
      savings: 300,
      balance: 543,
    },
    overrides: {},
    saldo: { people: [{ id: 'p', name: 'Lena' }], products: [], trips: [] },
  }
}

describe('buildSnapshot', () => {
  it('fasst die laufende Periode je Posten zusammen', () => {
    const snap = buildSnapshot(input([tx({ date: '2026-10-15', amount: 99000, categoryId: 'c-inc' }), tx()]))
    expect(snap.version).toBe(1)
    expect(snap.period.label).toBe('15. Okt – 14. Nov')
    const verbrauch = snap.periodSummary.items.find((i) => i.id === 'v')
    expect(verbrauch).toMatchObject({ plannedCents: 22000, actualCents: 1299, count: 1, role: 'catchAll' })
    expect(snap.periodSummary.spentCents).toBe(1299)
    expect(snap.periodSummary.incomeCents).toBe(99000)
  })

  it('liefert Buchungen mit ihrem Posten und zählt offene Duplikate', () => {
    const snap = buildSnapshot(input([tx({ date: '2026-10-19' }), tx({ date: '2026-10-20' })]))
    expect(snap.transactions[0]).toMatchObject({ target: 'v', amount: -1299 })
    expect(snap.openDuplicates).toBe(1)
  })

  it('übernimmt Salden der Schulden-Personen', () => {
    expect(buildSnapshot(input([])).saldo).toEqual([{ name: 'Lena', balanceCents: 0 }])
  })

  it('hält höchstens die letzten Perioden vor', () => {
    expect(buildSnapshot(input([tx({ date: '2025-01-01' })])).recentPeriods.length).toBeLessThanOrEqual(6)
  })
})
