import { describe, expect, test } from 'vitest'
import type { Category } from '../../types/budget'
import type { CategoryAssignedSignal, LearningSignal } from './signals'
import { categoryPredictor } from './categoryPredictor'

const NOW = '2026-06-30T00:00:00.000Z'

function cat(id: string, label: string, rules: Category['rules'] = []): Category {
  return { id, label, kind: 'variable', budget: null, rules }
}

function assigned(
  counterpartyKey: string,
  categoryId: string,
  purposeTokens: string[] = [],
): CategoryAssignedSignal {
  return {
    id: `s-${counterpartyKey}-${categoryId}-${Math.random()}`,
    ts: NOW,
    type: 'category-assigned',
    counterpartyKey,
    purposeTokens,
    categoryId,
    source: 'manual',
  }
}

const CATS = [cat('a', 'Lebensmittel'), cat('b', 'Drogerie'), cat('c', 'Streaming')]

describe('categoryPredictor — Regel-Treffer', () => {
  test('harte Regel ergibt Konfidenz 1.0', () => {
    const cats = [
      cat('a', 'Lebensmittel'),
      cat('c', 'Streaming', [{ field: 'counterparty', match: 'contains', value: 'netflix' }]),
    ]
    const out = categoryPredictor(
      { counterparty: 'Netflix', purpose: '', categories: cats, now: NOW },
      [],
    )
    expect(out[0].value).toBe('c')
    expect(out[0].confidence).toBe(1)
  })
})

describe('categoryPredictor — Empfänger-Häufigkeit', () => {
  test('häufigste Kategorie steht oben, Konfidenz laplace-geglättet', () => {
    const signals: LearningSignal[] = [
      assigned('rewe markt', 'a'),
      assigned('rewe markt', 'a'),
      assigned('rewe markt', 'b'),
    ]
    const out = categoryPredictor(
      { counterparty: 'REWE Markt', purpose: '', categories: CATS, now: NOW },
      signals,
    )
    expect(out).toHaveLength(2)
    expect(out[0].value).toBe('a')
    // (2 + 1) / (3 + 1*2) = 0.6
    expect(out[0].confidence).toBeCloseTo(0.6, 5)
    expect(out[1].value).toBe('b')
    expect(out[1].confidence).toBeCloseTo(0.4, 5)
  })
})

describe('categoryPredictor — Verwendungszweck-Fallback', () => {
  test('unbekannter Empfänger: Tokens des Zwecks führen zur Kategorie', () => {
    const signals: LearningSignal[] = [assigned('spotify ab', 'c', ['spotify', 'abo'])]
    const out = categoryPredictor(
      { counterparty: 'Neuer Anbieter GmbH', purpose: 'Monats Abo', categories: CATS, now: NOW },
      signals,
    )
    expect(out[0].value).toBe('c')
  })
})

describe('categoryPredictor — keine Daten', () => {
  test('ohne Regel und ohne Signale: leeres Ergebnis', () => {
    const out = categoryPredictor(
      { counterparty: 'Unbekannt', purpose: '', categories: CATS, now: NOW },
      [],
    )
    expect(out).toEqual([])
  })

  test('ignoriert Signale für gelöschte Kategorien', () => {
    const signals: LearningSignal[] = [assigned('edeka', 'geloescht')]
    const out = categoryPredictor(
      { counterparty: 'Edeka', purpose: '', categories: CATS, now: NOW },
      signals,
    )
    expect(out).toEqual([])
  })
})
