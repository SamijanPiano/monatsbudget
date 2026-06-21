import { describe, expect, test } from 'vitest'
import { buildImportedTransactions } from './ingest'
import { defaultCategories } from './categorizeSeed'
import type { ParsedTransaction } from './import/types'

const p = (over: Partial<ParsedTransaction> = {}): ParsedTransaction => ({
  date: '2026-06-01',
  amount: -1299,
  counterparty: 'REWE Markt',
  purpose: 'Einkauf',
  hash: 'h-rewe',
  ...over,
})

describe('buildImportedTransactions', () => {
  test('reichert geparste Buchungen zu vollwertigen Transaktionen an', () => {
    const out = buildImportedTransactions([p()], {
      accountId: 'acc-1',
      categories: defaultCategories(),
      existing: [],
    })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBeTruthy()
    expect(out[0].accountId).toBe('acc-1')
    expect(out[0].source).toBe('import')
    expect(out[0].amount).toBe(-1299)
    expect(out[0].hash).toBe('h-rewe')
  })

  test('kategorisiert automatisch anhand der Regeln (REWE -> Lebensmittel)', () => {
    const cats = defaultCategories()
    const lebensmittel = cats.find((c) => c.label === 'Lebensmittel')
    const out = buildImportedTransactions([p()], { accountId: 'a', categories: cats, existing: [] })
    expect(out[0].categoryId).toBe(lebensmittel?.id)
  })

  test('unbekannter Empfänger bleibt unkategorisiert (null)', () => {
    const out = buildImportedTransactions([p({ counterparty: 'Zufall GmbH', purpose: 'x', hash: 'h-x' })], {
      accountId: 'a',
      categories: defaultCategories(),
      existing: [],
    })
    expect(out[0].categoryId).toBeNull()
  })

  test('überspringt bereits vorhandene Buchungen (Dedup per hash)', () => {
    const out = buildImportedTransactions([p({ hash: 'dup' }), p({ hash: 'neu', counterparty: 'EDEKA' })], {
      accountId: 'a',
      categories: defaultCategories(),
      existing: [{ hash: 'dup' }],
    })
    expect(out).toHaveLength(1)
    expect(out[0].hash).toBe('neu')
  })

  test('dedupt auch innerhalb desselben Imports', () => {
    const out = buildImportedTransactions([p({ hash: 'same' }), p({ hash: 'same' })], {
      accountId: 'a',
      categories: defaultCategories(),
      existing: [],
    })
    expect(out).toHaveLength(1)
  })

  test('leere Eingabe -> leeres Ergebnis', () => {
    expect(buildImportedTransactions([], { accountId: 'a', categories: [], existing: [] })).toEqual([])
  })
})
