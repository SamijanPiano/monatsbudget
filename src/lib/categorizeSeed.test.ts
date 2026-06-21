import { describe, expect, test } from 'vitest'
import type { CategoryKind } from '../types/budget'
import { defaultCategories } from './categorizeSeed'
import { categorize } from './categorize'

describe('defaultCategories', () => {
  const cats = defaultCategories()

  test('liefert ein nicht-leeres Starter-Set', () => {
    expect(cats.length).toBeGreaterThan(5)
  })
  test('jede Kategorie hat eindeutige id und budget null', () => {
    const ids = cats.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(cats.every((c) => c.budget === null)).toBe(true)
  })
  test('deckt die erwarteten kinds ab', () => {
    const kinds = new Set<CategoryKind>(cats.map((c) => c.kind))
    expect(kinds.has('income')).toBe(true)
    expect(kinds.has('fixed')).toBe(true)
    expect(kinds.has('variable')).toBe(true)
    expect(kinds.has('savings')).toBe(true)
  })
  test('REWE-Buchung landet in einer variable-Lebensmittel-Kategorie', () => {
    const id = categorize({ counterparty: 'REWE Markt GmbH', purpose: '' } as never, cats)
    expect(id).not.toBeNull()
    const matched = cats.find((c) => c.id === id)!
    expect(matched.kind).toBe('variable')
    expect(matched.label.toLowerCase()).toContain('lebensmittel')
  })
  test('weitere Supermärkte matchen ebenfalls Lebensmittel', () => {
    for (const cp of ['EDEKA', 'ALDI SÜD', 'Lidl', 'Kaufland', 'PENNY', 'Netto Marken-Discount']) {
      const id = categorize({ counterparty: cp, purpose: '' } as never, cats)
      const matched = cats.find((c) => c.id === id)
      expect(matched?.label.toLowerCase()).toContain('lebensmittel')
    }
  })
  test('Netflix matcht eine Abo-/Streaming-Kategorie', () => {
    const id = categorize({ counterparty: 'Netflix International', purpose: '' } as never, cats)
    expect(id).not.toBeNull()
  })
  test('hat einen regellosen Sonstiges-Fallback-Bucket', () => {
    const fallback = cats.find((c) => c.rules.length === 0 && c.kind === 'variable')
    expect(fallback).toBeDefined()
  })
})
