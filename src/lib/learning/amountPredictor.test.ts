import { describe, expect, test } from 'vitest'
import type { ItemCreatedSignal, LearningSignal } from './signals'
import { amountPredictor } from './amountPredictor'

const NOW = '2026-06-30T00:00:00.000Z'

function item(
  labelKey: string,
  amountCent: number,
  section: ItemCreatedSignal['section'] = 'fixed',
): ItemCreatedSignal {
  return {
    id: `i-${labelKey}-${amountCent}-${Math.random()}`,
    ts: NOW,
    type: 'item-created',
    section,
    labelKey,
    amountCent,
    categoryId: null,
    recurring: section === 'fixed',
  }
}

describe('amountPredictor', () => {
  test('identische Beträge: Median exakt, hohe Konfidenz', () => {
    const signals: LearningSignal[] = [
      item('miete', -80000),
      item('miete', -80000),
      item('miete', -80000),
    ]
    const out = amountPredictor({ labelKey: 'miete', section: 'fixed', now: NOW }, signals)
    expect(out[0].value).toBe(-80000)
    expect(out[0].confidence).toBeGreaterThan(0.9)
  })

  test('streuende Beträge: Median korrekt, niedrigere Konfidenz', () => {
    const signals: LearningSignal[] = [
      item('essen', -1000),
      item('essen', -2000),
      item('essen', -9000),
    ]
    const out = amountPredictor({ labelKey: 'essen', section: 'fixed', now: NOW }, signals)
    expect(out[0].value).toBe(-2000)
    expect(out[0].confidence).toBeLessThan(0.5)
  })

  test('filtert nach Sektion', () => {
    const signals: LearningSignal[] = [
      item('bonus', 50000, 'income'),
      item('bonus', -300, 'variable'),
    ]
    const out = amountPredictor({ labelKey: 'bonus', section: 'income', now: NOW }, signals)
    expect(out[0].value).toBe(50000)
  })

  test('ohne passende Signale: leeres Ergebnis', () => {
    const out = amountPredictor({ labelKey: 'unbekannt', section: 'fixed', now: NOW }, [])
    expect(out).toEqual([])
  })

  test('einzelnes Signal: moderate Konfidenz', () => {
    const signals: LearningSignal[] = [item('netflix', -1799)]
    const out = amountPredictor({ labelKey: 'netflix', section: 'fixed', now: NOW }, signals)
    expect(out[0].value).toBe(-1799)
    expect(out[0].confidence).toBeGreaterThan(0)
    expect(out[0].confidence).toBeLessThan(0.8)
  })
})
