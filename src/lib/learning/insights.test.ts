import { describe, expect, test } from 'vitest'
import type { LearningSignal } from './signals'
import { learningStats, shouldUseAiFallback } from './insights'

const NOW = '2026-06-30T00:00:00.000Z'

function feedback(
  surface: 'category' | 'item' | 'budget' | 'recurring',
  accepted: boolean,
): LearningSignal {
  return {
    id: `f-${Math.random()}`,
    ts: NOW,
    type: 'suggestion-feedback',
    surface,
    predicted: 'x',
    chosen: accepted ? 'x' : 'y',
    accepted,
  }
}

describe('learningStats', () => {
  test('zählt Gesamtsignale und Trefferquote je Fläche', () => {
    const signals: LearningSignal[] = [
      feedback('category', true),
      feedback('category', false),
      feedback('budget', true),
      { id: 'd1', ts: NOW, type: 'budget-set', categoryId: 'c', amountCent: 100, monthId: '2026-06' },
    ]
    const stats = learningStats(signals)
    expect(stats.total).toBe(4)
    expect(stats.surfaces.category).toEqual({ accepted: 1, total: 2, rate: 0.5 })
    expect(stats.surfaces.budget).toEqual({ accepted: 1, total: 1, rate: 1 })
  })

  test('Fläche ohne Feedback fehlt in surfaces', () => {
    const stats = learningStats([feedback('category', true)])
    expect(stats.surfaces.recurring).toBeUndefined()
  })

  test('leeres Log: total 0, keine Flächen', () => {
    const stats = learningStats([])
    expect(stats.total).toBe(0)
    expect(Object.keys(stats.surfaces)).toHaveLength(0)
  })
})

describe('shouldUseAiFallback', () => {
  test('nur wenn aktiviert, online und lokale Konfidenz unter Schwellwert', () => {
    expect(shouldUseAiFallback(0.2, { aiSuggestions: true, suggestThreshold: 0.4 }, true)).toBe(true)
  })

  test('aus, wenn opt-in fehlt', () => {
    expect(shouldUseAiFallback(0.1, { aiSuggestions: false, suggestThreshold: 0.4 }, true)).toBe(false)
  })

  test('aus, wenn offline', () => {
    expect(shouldUseAiFallback(0.1, { aiSuggestions: true, suggestThreshold: 0.4 }, false)).toBe(false)
  })

  test('aus, wenn lokale Konfidenz bereits ausreicht', () => {
    expect(shouldUseAiFallback(0.9, { aiSuggestions: true, suggestThreshold: 0.4 }, true)).toBe(false)
  })
})
