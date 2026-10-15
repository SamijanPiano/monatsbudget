import { describe, expect, it } from 'vitest'
import { emptyChangedAt, isEmptyDoc, mergeDocs, parseDoc, type SyncDoc } from './doc'
import type { Transaction } from '../../types/budget'

const tx = (id: string, over: Partial<Transaction> = {}): Transaction => ({
  id,
  date: '2026-10-01',
  amount: -1000,
  counterparty: 'REWE',
  purpose: 'Einkauf',
  categoryId: null,
  accountId: 'acc',
  source: 'sync',
  hash: `h-${id}`,
  ...over,
})

function doc(over: Partial<SyncDoc> = {}, budget: Partial<SyncDoc['budget']> = {}): SyncDoc {
  return {
    version: 1,
    changedAt: emptyChangedAt(),
    budget: {
      months: { '2026-10': { id: '2026-10', income: [], fixed: [], variable: [], savingsKonto: 0, savingsBar: 0, currentKonto: 0, currentBar: 0 } },
      settings: { currency: 'EUR', locale: 'de-DE', savingsGoal: 0 },
      transactions: [],
      categories: [],
      accounts: [],
      contracts: [],
      bankPending: null,
      dismissedDuplicates: [],
      dismissedRecurring: [],
      deletedTransactionIds: [],
      cashEnabled: false,
      goals: [],
      ...budget,
    },
    plan: { plan: { income: [], fixed: [], variable: [], savings: 0, balance: 0 }, overrides: {} },
    saldo: { people: [], products: [], trips: [] },
    ...over,
  }
}

const T1 = '2026-10-15T10:00:00Z'
const T2 = '2026-10-15T11:00:00Z'

describe('mergeDocs', () => {
  it('vereinigt Buchungen beider Geräte', () => {
    const merged = mergeDocs(doc({}, { transactions: [tx('a')] }), doc({}, { transactions: [tx('b')] }))
    expect(merged.budget.transactions.map((t) => t.id).sort()).toEqual(['a', 'b'])
  })

  it('gelöschte Buchungen bleiben gelöscht, egal auf welchem Gerät gelöscht wurde', () => {
    const local = doc({}, { transactions: [tx('a')], deletedTransactionIds: [] })
    const remote = doc({}, { transactions: [], deletedTransactionIds: ['a'] })
    expect(mergeDocs(local, remote).budget.transactions).toEqual([])
    expect(mergeDocs(local, remote).budget.deletedTransactionIds).toEqual(['a'])
  })

  it('dieselbe Bankbuchung von zwei Geräten zählt nur einmal (gleicher Hash)', () => {
    const local = doc({}, { transactions: [tx('a', { hash: 'same' })] })
    const remote = doc({}, { transactions: [tx('b', { hash: 'same' })] })
    expect(mergeDocs(local, remote).budget.transactions.map((t) => t.id)).toEqual(['b'])
  })

  it('bei gleicher Buchung gewinnt die Kategorie des zuletzt geänderten Geräts', () => {
    const local = doc({ changedAt: { ...emptyChangedAt(), transactions: T2 } }, { transactions: [tx('a', { categoryId: 'neu' })] })
    const remote = doc({ changedAt: { ...emptyChangedAt(), transactions: T1 } }, { transactions: [tx('a', { categoryId: 'alt' })] })
    expect(mergeDocs(local, remote).budget.transactions[0].categoryId).toBe('neu')
  })

  it('Monatsplan und Schulden: neuere Änderung gewinnt, Verschiebungen werden vereinigt', () => {
    const local = doc({
      changedAt: { ...emptyChangedAt(), plan: T1, saldo: T2 },
      plan: { plan: { income: [], fixed: [], variable: [], savings: 100, balance: 0 }, overrides: { a: 'x' } },
      saldo: { people: [{ id: 'p', name: 'Lena' }], products: [], trips: [] },
    })
    const remote = doc({
      changedAt: { ...emptyChangedAt(), plan: T2, saldo: T1 },
      plan: { plan: { income: [], fixed: [], variable: [], savings: 300, balance: 0 }, overrides: { b: 'y' } },
    })
    const m = mergeDocs(local, remote)
    expect(m.plan.plan.savings).toBe(300)
    expect(m.plan.overrides).toEqual({ a: 'x', b: 'y' })
    expect(m.saldo.people).toHaveLength(1)
    expect(m.changedAt).toEqual({ ...emptyChangedAt(), plan: T2, saldo: T2 })
  })
})

describe('„Kein Dauerposten" im Abgleich', () => {
  it('neuere Liste gewinnt, damit „zurückholen" auch auf anderen Geräten gilt', () => {
    const local = doc({ changedAt: { ...emptyChangedAt(), misc: T2 } }, { dismissedRecurring: [] })
    const remote = doc({ changedAt: { ...emptyChangedAt(), misc: T1 } }, { dismissedRecurring: ['amazon eu'] })
    expect(mergeDocs(local, remote).budget.dismissedRecurring).toEqual([])
    expect(mergeDocs(remote, local).budget.dismissedRecurring).toEqual([])
  })

  it('ein alter Stand ohne das Feld ergibt eine leere Liste', () => {
    const old = JSON.parse(JSON.stringify(doc()))
    delete old.budget.dismissedRecurring
    expect(parseDoc(old)?.budget.dismissedRecurring).toEqual([])
  })
})

describe('parseDoc', () => {
  it('liest ein gültiges Dokument und lehnt Unsinn ab', () => {
    const d = doc({}, { transactions: [tx('a', { bankRef: 'R1' })] })
    const parsed = parseDoc(JSON.parse(JSON.stringify(d)))
    expect(parsed?.budget.transactions[0].bankRef).toBe('R1')
    expect(parseDoc(null)).toBeNull()
    expect(parseDoc({ version: 2 })).toBeNull()
    expect(parseDoc({ version: 1, budget: { months: {} } })).toBeNull()
  })
})

describe('isEmptyDoc', () => {
  it('erkennt ein frisches Gerät', () => {
    expect(isEmptyDoc(doc())).toBe(true)
    expect(isEmptyDoc(doc({}, { transactions: [tx("a")] }))).toBe(false)
  })
})

describe('Review-Fälle', () => {
  const month = (id: string, konto: number) => ({
    id,
    income: konto ? [{ id: 'i', label: 'Gehalt', konto, bar: 0 }] : [],
    fixed: [],
    variable: [],
    savingsKonto: 0,
    savingsBar: 0,
    currentKonto: -120,
    currentBar: 0,
  })

  it('Prüfung ändert keine Werte (negativer Kontostand bleibt negativ, Einstellungen bleiben)', () => {
    const d = doc({}, {
      months: { '2026-10': month('2026-10', 990) },
      settings: { currency: 'EUR', locale: 'de-DE', savingsGoal: 0, autofillThreshold: 0.9 },
    })
    const parsed = parseDoc(JSON.parse(JSON.stringify(d)))!
    expect(parsed.budget.months['2026-10'].currentKonto).toBe(-120)
    expect(parsed.budget.settings.autofillThreshold).toBe(0.9)
  })

  it('Monate werden einzeln vereinigt, ein leerer Monat überschreibt keinen gefüllten', () => {
    const local = doc({ changedAt: { ...emptyChangedAt(), months: T2 } }, {
      months: { '2026-10': { ...month('2026-10', 0), currentKonto: 0 }, '2026-11': month('2026-11', 50) },
    })
    const remote = doc({ changedAt: { ...emptyChangedAt(), months: T1 } }, {
      months: { '2026-10': month('2026-10', 990) },
    })
    const m = mergeDocs(local, remote).budget.months
    expect(m['2026-10'].income[0].konto).toBe(990)
    expect(m['2026-11'].income[0].konto).toBe(50)
  })

  it('Ein Bereich, den nur das andere Gerät geändert hat, bleibt dessen Stand', () => {
    const local = doc({ changedAt: { ...emptyChangedAt(), transactions: T2 } }, { contracts: [] })
    const remote = doc({ changedAt: { ...emptyChangedAt(), contracts: T1 } }, {
      contracts: [{ id: 'c', label: 'Handy', counterparty: 'Vodafone', categoryId: null, amountApprox: -1999, cadence: 'monthly', nextDue: '2026-11-01', status: 'active', source: 'manual' }],
    })
    expect(mergeDocs(local, remote).budget.contracts).toHaveLength(1)
  })

  it('isEmptyDoc sieht auch Monate, Verträge und Ziele', () => {
    expect(isEmptyDoc(doc({}, { months: { '2026-10': month('2026-10', 990) } }))).toBe(false)
  })

  it('verschiedene Buchungen mit zufällig gleichem Hash bleiben beide erhalten', () => {
    const local = doc({}, { transactions: [tx('a', { hash: 'x', amount: -100 })] })
    const remote = doc({}, { transactions: [tx('b', { hash: 'x', amount: -200 })] })
    expect(mergeDocs(local, remote).budget.transactions).toHaveLength(2)
  })
})

describe('Abgleich behält gelernte Sonderziele', () => {
  it('parseDoc übernimmt learnedSpecial', () => {
    const d = doc({ plan: { plan: { income: [], fixed: [], variable: [], savings: 0, balance: 0, learnedSpecial: { 'sempf samuel': 'savings' } }, overrides: {} } })
    expect(parseDoc(JSON.parse(JSON.stringify(d)))?.plan.plan.learnedSpecial).toEqual({ 'sempf samuel': 'savings' })
  })
})

