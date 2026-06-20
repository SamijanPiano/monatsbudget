import { describe, expect, test } from 'vitest'
import type { Goal } from '../types/budget'
import { progressRatio, monthsUntil, recommendedMonthlyRate } from './goals'

function goal(partial: Partial<Goal>): Goal {
  return {
    id: 'g1',
    type: 'save',
    label: 'Test',
    targetAmount: 1000,
    currentAmount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('progressRatio', () => {
  test('save: Anteil von currentAmount am Ziel', () => {
    expect(progressRatio(goal({ currentAmount: 250, targetAmount: 1000 }))).toBe(0.25)
  })
  test('save: über 100% wird auf 1 begrenzt', () => {
    expect(progressRatio(goal({ currentAmount: 2000, targetAmount: 1000 }))).toBe(1)
  })
  test('debt: Fortschritt = abgebauter Anteil', () => {
    expect(progressRatio(goal({ type: 'debt', targetAmount: 1000, currentAmount: 400 }))).toBe(0.6)
  })
  test('overview hat keinen Fortschritt', () => {
    expect(progressRatio(goal({ type: 'overview', targetAmount: 0 }))).toBe(0)
  })
  test('targetAmount 0 ergibt 0 (kein NaN)', () => {
    expect(progressRatio(goal({ targetAmount: 0, currentAmount: 50 }))).toBe(0)
  })
})

describe('monthsUntil', () => {
  test('Differenz in Monaten', () => {
    expect(monthsUntil('2026-09', new Date('2026-06-15'))).toBe(3)
  })
  test('Vergangenheit ergibt 0', () => {
    expect(monthsUntil('2026-01', new Date('2026-06-15'))).toBe(0)
  })
})

describe('recommendedMonthlyRate', () => {
  test('save mit Frist: Restbetrag / Restmonate', () => {
    const g = goal({ targetAmount: 1200, currentAmount: 0, deadline: '2026-12' })
    expect(recommendedMonthlyRate(g, new Date('2026-06-15'))).toBe(200)
  })
  test('ohne Frist: 0', () => {
    expect(recommendedMonthlyRate(goal({ deadline: undefined }))).toBe(0)
  })
  test('Ziel erreicht: 0', () => {
    expect(recommendedMonthlyRate(goal({ currentAmount: 1000, targetAmount: 1000, deadline: '2026-12' }))).toBe(0)
  })
})
