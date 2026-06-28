import { describe, expect, test } from 'vitest'
import type { Category, CategoryRule, Transaction } from '../types/budget'
import {
  matchesRule,
  categorize,
  categorizeAll,
  recategorizeAll,
  learnRule,
  fallbackCategoryId,
} from './categorize'

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    date: '2026-06-01',
    amount: -1000,
    counterparty: '',
    purpose: '',
    categoryId: null,
    accountId: 'a1',
    source: 'import',
    hash: 'h1',
    ...partial,
  }
}

function cat(partial: Partial<Category>): Category {
  return {
    id: 'c1',
    label: 'Test',
    kind: 'variable',
    budget: null,
    rules: [],
    ...partial,
  }
}

function rule(partial: Partial<CategoryRule>): CategoryRule {
  return { field: 'counterparty', match: 'contains', value: '', ...partial }
}

describe('matchesRule', () => {
  test('contains trifft Teilstring im counterparty (case-insensitive)', () => {
    const t = tx({ counterparty: 'REWE Markt GmbH' })
    expect(matchesRule(t, rule({ match: 'contains', value: 'rewe' }))).toBe(true)
  })
  test('contains trifft nicht, wenn Teilstring fehlt', () => {
    const t = tx({ counterparty: 'EDEKA' })
    expect(matchesRule(t, rule({ match: 'contains', value: 'rewe' }))).toBe(false)
  })
  test('equals trifft nur bei voller Gleichheit (case-insensitive)', () => {
    const t = tx({ counterparty: 'Netflix' })
    expect(matchesRule(t, rule({ match: 'equals', value: 'netflix' }))).toBe(true)
    expect(matchesRule(t, rule({ match: 'equals', value: 'net' }))).toBe(false)
  })
  test('field-Auswahl: purpose statt counterparty', () => {
    const t = tx({ counterparty: 'Sparkasse', purpose: 'Miete Juni' })
    expect(matchesRule(t, rule({ field: 'purpose', match: 'contains', value: 'miete' }))).toBe(true)
    expect(
      matchesRule(t, rule({ field: 'counterparty', match: 'contains', value: 'miete' })),
    ).toBe(false)
  })
  test('regex kompiliert value und matcht case-insensitive', () => {
    const t = tx({ counterparty: 'Aral Tankstelle' })
    expect(matchesRule(t, rule({ match: 'regex', value: 'aral|shell' }))).toBe(true)
  })
  test('ungültige regex ergibt false statt Fehler', () => {
    const t = tx({ counterparty: 'irgendwas' })
    expect(matchesRule(t, rule({ match: 'regex', value: '([' }))).toBe(false)
  })
})

describe('categorize', () => {
  const lebensmittel = cat({
    id: 'lm',
    label: 'Lebensmittel',
    rules: [rule({ match: 'contains', value: 'rewe' })],
  })
  const mobilitaet = cat({
    id: 'mob',
    label: 'Mobilität',
    rules: [rule({ match: 'contains', value: 'aral' })],
  })

  test('REWE-counterparty wird Lebensmittel zugeordnet', () => {
    const t = tx({ counterparty: 'REWE Markt' })
    expect(categorize(t, [lebensmittel, mobilitaet])).toBe('lm')
  })
  test('first-match wins in Array-Reihenfolge', () => {
    const both = cat({ id: 'both', rules: [rule({ match: 'contains', value: 'markt' })] })
    const t = tx({ counterparty: 'REWE Markt' })
    // both steht vorne → gewinnt, obwohl lebensmittel auch matchen würde
    expect(categorize(t, [both, lebensmittel])).toBe('both')
  })
  test('kein Treffer ergibt null', () => {
    const t = tx({ counterparty: 'Unbekannt' })
    expect(categorize(t, [lebensmittel, mobilitaet])).toBeNull()
  })
})

describe('categorizeAll', () => {
  const lebensmittel = cat({
    id: 'lm',
    rules: [rule({ match: 'contains', value: 'rewe' })],
  })

  test('füllt nur null-categoryId, behält bestehende Zuordnung', () => {
    const txs = [
      tx({ id: 'a', counterparty: 'REWE', categoryId: null }),
      tx({ id: 'b', counterparty: 'REWE', categoryId: 'manuell' }),
      tx({ id: 'c', counterparty: 'Unbekannt', categoryId: null }),
    ]
    const result = categorizeAll(txs, [lebensmittel])
    expect(result[0].categoryId).toBe('lm')
    expect(result[1].categoryId).toBe('manuell')
    expect(result[2].categoryId).toBeNull()
  })
  test('ist immutabel: Eingabe bleibt unverändert', () => {
    const txs = [tx({ id: 'a', counterparty: 'REWE', categoryId: null })]
    const snapshot = JSON.stringify(txs)
    const result = categorizeAll(txs, [lebensmittel])
    expect(JSON.stringify(txs)).toBe(snapshot)
    expect(result).not.toBe(txs)
    expect(result[0]).not.toBe(txs[0])
  })

  test('mit fallbackId bekommt jede sonst unzugeordnete Buchung die Fallback-Kategorie', () => {
    const txs = [
      tx({ id: 'a', counterparty: 'REWE', categoryId: null }),
      tx({ id: 'b', counterparty: 'Unbekannt', categoryId: null }),
      tx({ id: 'c', counterparty: 'Egal', categoryId: 'manuell' }),
    ]
    const result = categorizeAll(txs, [lebensmittel], 'sonst')
    expect(result[0].categoryId).toBe('lm') // Regel-Treffer schlägt Fallback
    expect(result[1].categoryId).toBe('sonst') // kein Treffer → Fallback
    expect(result[2].categoryId).toBe('manuell') // bestehende Zuordnung bleibt
  })
})

describe('recategorizeAll', () => {
  const lebensmittel = cat({
    id: 'lm',
    rules: [rule({ match: 'contains', value: 'rewe' })],
  })

  test('überschreibt bestehende (auch manuelle) Zuordnungen anhand der Regeln', () => {
    const txs = [
      tx({ id: 'a', counterparty: 'REWE', categoryId: 'falsch' }),
      tx({ id: 'b', counterparty: 'Unbekannt', categoryId: 'alt' }),
    ]
    const result = recategorizeAll(txs, [lebensmittel], 'sonst')
    expect(result[0].categoryId).toBe('lm') // neu per Regel, alte „falsch" weg
    expect(result[1].categoryId).toBe('sonst') // kein Treffer → Fallback
  })
  test('ohne fallbackId bleiben Buchungen ohne Treffer unzugeordnet', () => {
    const txs = [tx({ id: 'a', counterparty: 'Unbekannt', categoryId: 'alt' })]
    const result = recategorizeAll(txs, [lebensmittel])
    expect(result[0].categoryId).toBeNull()
  })
  test('ist immutabel: Eingabe bleibt unverändert', () => {
    const txs = [tx({ id: 'a', counterparty: 'REWE', categoryId: 'falsch' })]
    const snapshot = JSON.stringify(txs)
    const result = recategorizeAll(txs, [lebensmittel], 'sonst')
    expect(JSON.stringify(txs)).toBe(snapshot)
    expect(result).not.toBe(txs)
  })
})

describe('fallbackCategoryId', () => {
  test('findet die Kategorie „Sonstiges" per Label (case-insensitive)', () => {
    const cats = [
      cat({ id: 'lm', label: 'Lebensmittel' }),
      cat({ id: 'sonst', label: 'Sonstiges', rules: [] }),
    ]
    expect(fallbackCategoryId(cats)).toBe('sonst')
  })
  test('fällt auf regellose variable Kategorie zurück', () => {
    const cats = [
      cat({ id: 'lm', label: 'Lebensmittel', rules: [rule({ value: 'rewe' })] }),
      cat({ id: 'frei', label: 'Freitopf', kind: 'variable', rules: [] }),
    ]
    expect(fallbackCategoryId(cats)).toBe('frei')
  })
  test('ohne Kategorien null', () => {
    expect(fallbackCategoryId([])).toBeNull()
  })
})

describe('Aral wird „Mobilität" zugeordnet (Tanken)', () => {
  test('counterparty Aral matcht die Mobilitäts-Regel', () => {
    const mobilitaet = cat({
      id: 'mob',
      label: 'Mobilität',
      rules: [rule({ match: 'contains', value: 'aral' })],
    })
    const sonst = cat({ id: 'sonst', label: 'Sonstiges', rules: [] })
    const result = categorizeAll(
      [tx({ counterparty: 'ARAL Tankstelle Berlin' })],
      [mobilitaet, sonst],
      fallbackCategoryId([mobilitaet, sonst]),
    )
    expect(result[0].categoryId).toBe('mob')
  })
})

describe('learnRule', () => {
  const lebensmittel = cat({ id: 'lm', rules: [] })
  const sonstiges = cat({ id: 'son', rules: [] })

  test('hängt equals-Regel an die richtige Kategorie', () => {
    const result = learnRule([lebensmittel, sonstiges], 'lm', 'Bäckerei Müller')
    const target = result.find((c) => c.id === 'lm')!
    expect(target.rules).toContainEqual({
      field: 'counterparty',
      match: 'equals',
      value: 'bäckerei müller',
    })
    // andere Kategorie unberührt
    expect(result.find((c) => c.id === 'son')!.rules).toEqual([])
  })
  test('dedupliziert identische Regel', () => {
    const withRule = cat({
      id: 'lm',
      rules: [rule({ field: 'counterparty', match: 'equals', value: 'rewe' })],
    })
    const result = learnRule([withRule], 'lm', 'REWE')
    expect(result[0].rules).toHaveLength(1)
  })
  test('ist immutabel: Eingabe bleibt unverändert', () => {
    const cats = [lebensmittel, sonstiges]
    const snapshot = JSON.stringify(cats)
    const result = learnRule(cats, 'lm', 'Test')
    expect(JSON.stringify(cats)).toBe(snapshot)
    expect(result).not.toBe(cats)
  })
})
