import { describe, it, expect } from 'vitest'
import { serializeBackup, parseBackup, parseUnifiedBackup } from './backup'
import { DEFAULT_SETTINGS } from './seed'
import { makeSampleMonth } from './sampleMonth'
import type { SaldoState } from '../types/saldo'

const state = {
  months: { '2099-01': makeSampleMonth('2099-01') },
  activeMonthId: '2099-01',
  settings: { ...DEFAULT_SETTINGS },
}

describe('Backup Roundtrip', () => {
  it('serialisiert und liest denselben Zustand wieder ein', () => {
    const json = serializeBackup(state)
    const parsed = parseBackup(json)
    expect(parsed.activeMonthId).toBe('2099-01')
    expect(Object.keys(parsed.months)).toEqual(['2099-01'])
    expect(parsed.months['2099-01'].income).toHaveLength(3)
    expect(parsed.months['2099-01'].savingsKonto).toBe(600)
  })

  it('wirft bei ungültigem JSON', () => {
    expect(() => parseBackup('nicht json {')).toThrow()
  })

  it('wirft, wenn keine Monate enthalten sind', () => {
    expect(() => parseBackup('{"months":{}}')).toThrow()
  })

  it('repariert fehlende Felder mit Defaults', () => {
    const partial = JSON.stringify({
      months: { '2026-07': { income: [{ label: 'X' }] } },
    })
    const parsed = parseBackup(partial)
    expect(parsed.months['2026-07'].income[0].konto).toBe(0)
    expect(parsed.months['2026-07'].fixed).toEqual([])
    expect(parsed.activeMonthId).toBe('2026-07')
  })

  it('lehnt fremde app-Kennung ab', () => {
    expect(() => parseBackup('{"app":"andere","months":{"2026-06":{}}}')).toThrow()
  })

  it('lehnt neuere Backup-Version ab', () => {
    expect(() => parseBackup('{"version":99,"months":{"2026-06":{}}}')).toThrow()
  })

  it('filtert ungültige Monats-IDs heraus', () => {
    expect(() => parseBackup('{"months":{"foo":{},"bar":{}}}')).toThrow()
  })

  it('klemmt negative Beträge auf 0', () => {
    const json = JSON.stringify({
      months: { '2026-06': { income: [{ label: 'X', konto: -50 }], savingsKonto: -10 } },
    })
    const parsed = parseBackup(json)
    expect(parsed.months['2026-06'].income[0].konto).toBe(0)
    expect(parsed.months['2026-06'].savingsKonto).toBe(0)
  })

  it('lehnt nicht-Objekt JSON ab', () => {
    expect(() => parseBackup('[]')).toThrow()
    expect(() => parseBackup('42')).toThrow()
  })
})

describe('parseUnifiedBackup', () => {
  const saldo: SaldoState = {
    people: [{ id: 'p1', name: 'Anna' }],
    products: [{ id: 'a1', name: 'Milch', lastPrice: 109 }],
    trips: [
      {
        id: 't1',
        date: '2026-06-01',
        orders: [
          {
            personId: 'p1',
            items: [{ id: 'i1', productId: 'a1', label: null, qty: 1, price: 109 }],
            paid: false,
            amountPaid: null,
          },
        ],
      },
    ],
  }

  it('roundtrip: Budget + Schulden in einer Datei', () => {
    const json = serializeBackup(state, saldo)
    const parsed = parseUnifiedBackup(json)
    expect(parsed.budget?.activeMonthId).toBe('2099-01')
    expect(parsed.saldo?.people).toHaveLength(1)
    expect(parsed.saldo?.trips[0].orders[0].items[0].price).toBe(109)
  })

  it('erkennt ein reines Budget-Backup', () => {
    const json = JSON.stringify({ months: { '2026-06': { income: [] } } })
    const parsed = parseUnifiedBackup(json)
    expect(parsed.budget).toBeTruthy()
    expect(parsed.saldo).toBeUndefined()
  })

  it('erkennt ein altes Saldo-Backup (trips/people, keine months)', () => {
    const legacy = JSON.stringify({ version: 1, people: [{ id: 'p1', name: 'Bo' }], products: [], trips: [] })
    const parsed = parseUnifiedBackup(legacy)
    expect(parsed.saldo?.people[0].name).toBe('Bo')
    expect(parsed.budget).toBeUndefined()
  })

  it('lehnt unbekannte Dateien ab', () => {
    expect(() => parseUnifiedBackup('{"foo":1}')).toThrow()
  })
})

describe('Backup mit Transaktions-Schicht', () => {
  const rich = {
    ...state,
    transactions: [
      { id: 't1', date: '2026-06-01', amount: -1299, counterparty: 'REWE', purpose: 'Einkauf', categoryId: 'c1', accountId: 'a1', source: 'import' as const, hash: 'h1' },
      { id: 't2', date: '2026-06-02', amount: 250000, counterparty: 'AG', purpose: 'Lohn', categoryId: null, accountId: 'a1', source: 'import' as const, hash: 'h2' },
    ],
    categories: [{ id: 'c1', label: 'Lebensmittel', kind: 'variable' as const, budget: 30000, rules: [] }],
    accounts: [{ id: 'a1', name: 'Konto', type: 'checking' as const, balance: 100000 }],
    recurringRules: [],
  }

  it('roundtrip erhält Transaktionen, Kategorien und Konten', () => {
    const parsed = parseBackup(serializeBackup(rich))
    expect(parsed.transactions).toHaveLength(2)
    expect(parsed.transactions?.[0].amount).toBe(-1299)
    expect(parsed.categories?.[0].label).toBe('Lebensmittel')
    expect(parsed.categories?.[0].budget).toBe(30000)
    expect(parsed.accounts?.[0].balance).toBe(100000)
  })

  it('behält negative (vorzeichenbehaftete) Beträge bei Transaktionen', () => {
    const parsed = parseBackup(serializeBackup(rich))
    expect(parsed.transactions?.[0].amount).toBeLessThan(0)
    expect(parsed.transactions?.[1].amount).toBe(250000)
  })

  it('altes Backup ohne Transaktionsschicht: Felder bleiben undefined', () => {
    const parsed = parseBackup('{"months":{"2026-06":{"income":[]}}}')
    expect(parsed.transactions).toBeUndefined()
    expect(parsed.categories).toBeUndefined()
    expect(parsed.accounts).toBeUndefined()
  })
})
