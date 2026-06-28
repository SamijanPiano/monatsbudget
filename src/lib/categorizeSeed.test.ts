import { describe, expect, test } from 'vitest'
import type { CategoryKind } from '../types/budget'
import { defaultCategories } from './categorizeSeed'
import { categorize } from './categorize'

describe('defaultCategories', () => {
  const cats = defaultCategories()

  function labelFor(cp: string, purpose = ''): string | undefined {
    const id = categorize({ counterparty: cp, purpose } as never, cats)
    return cats.find((c) => c.id === id)?.label
  }

  test('liefert ein nicht-leeres Starter-Set', () => {
    expect(cats.length).toBeGreaterThan(5)
  })
  test('jede Kategorie hat eindeutige id und budget null', () => {
    const ids = cats.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(cats.every((c) => c.budget === null)).toBe(true)
  })
  test('Labels sind eindeutig', () => {
    const labels = cats.map((c) => c.label.toLowerCase())
    expect(new Set(labels).size).toBe(labels.length)
  })
  test('deckt die erwarteten kinds ab', () => {
    const kinds = new Set<CategoryKind>(cats.map((c) => c.kind))
    expect(kinds.has('income')).toBe(true)
    expect(kinds.has('fixed')).toBe(true)
    expect(kinds.has('variable')).toBe(true)
    expect(kinds.has('savings')).toBe(true)
  })
  test('Supermärkte landen in „Einkauf"', () => {
    for (const cp of ['REWE Markt GmbH', 'EDEKA', 'ALDI SÜD', 'Lidl', 'Kaufland', 'PENNY', 'Netto Marken-Discount']) {
      expect(labelFor(cp)).toBe('Einkauf')
    }
  })
  test('Tankstellen & Bahn landen in „Tanken & Mobilität"', () => {
    for (const cp of ['Aral Tankstelle', 'Shell', 'ESSO Station', 'DB Vertrieb GmbH']) {
      expect(labelFor(cp)).toBe('Tanken & Mobilität')
    }
  })
  test('Restaurants & Kino landen in „Freizeit"', () => {
    for (const cp of ['McDonalds', 'Restaurant Roma', 'CinemaxX Kino']) {
      expect(labelFor(cp)).toBe('Freizeit')
    }
  })
  test('Netflix/Spotify/iCloud landen in „Abos & Streaming" (nicht Freizeit/Einkauf)', () => {
    expect(labelFor('Netflix International')).toBe('Abos & Streaming')
    expect(labelFor('Spotify AB')).toBe('Abos & Streaming')
    expect(labelFor('Apple iCloud')).toBe('Abos & Streaming')
  })
  test('Mobilfunk landet in „Handy & Internet"', () => {
    expect(labelFor('Telekom Deutschland')).toBe('Handy & Internet')
    expect(labelFor('ALDI TALK Aufladung')).toBe('Handy & Internet')
  })
  test('Gehalt landet in „Einkommen"', () => {
    expect(labelFor('Arbeitgeber XY', 'Gehalt Juni')).toBe('Einkommen')
  })
  test('hat einen regellosen Sonstiges-Fallback-Bucket', () => {
    const fallback = cats.find((c) => c.rules.length === 0 && c.kind === 'variable')
    expect(fallback?.label).toBe('Sonstiges')
  })
})
