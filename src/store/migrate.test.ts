import { describe, expect, test } from 'vitest'
import { migrateBudgetState } from './migrate'

const emptyMonth = (id: string) => ({
  id, income: [], fixed: [], variable: [],
  savingsKonto: 0, savingsBar: 0, currentKonto: 0, currentBar: 0,
})

describe('migrateBudgetState v1 -> v2', () => {
  test('frischer/leerer Bestand: onboarded false, cash aus', () => {
    const v1 = { months: { '2026-06': emptyMonth('2026-06') }, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 0 } }
    const out = migrateBudgetState(v1, 1)
    expect(out.profile.onboarded).toBe(false)
    expect(out.profile.cashEnabled).toBe(false)
    expect(out.profile.goals).toEqual([])
  })

  test('Bestand mit Werten: onboarded true (kein Wizard für Bestand)', () => {
    const m = { ...emptyMonth('2026-06'), income: [{ id: 'i', label: 'Gehalt', konto: 2000, bar: 0 }] }
    const out = migrateBudgetState({ months: { '2026-06': m }, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 0 } }, 1)
    expect(out.profile.onboarded).toBe(true)
    expect(out.profile.cashEnabled).toBe(false)
  })

  test('Bar-Werte vorhanden: cashEnabled true', () => {
    const m = { ...emptyMonth('2026-06'), income: [{ id: 'i', label: 'Bar', konto: 0, bar: 300 }] }
    const out = migrateBudgetState({ months: { '2026-06': m }, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 0 } }, 1)
    expect(out.profile.cashEnabled).toBe(true)
    expect(out.profile.onboarded).toBe(true)
  })

  test('altes savingsGoal wird zu buffer-Goal', () => {
    const out = migrateBudgetState({ months: { '2026-06': emptyMonth('2026-06') }, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 5000 } }, 1)
    expect(out.profile.goals).toHaveLength(1)
    expect(out.profile.goals[0].type).toBe('buffer')
    expect(out.profile.goals[0].targetAmount).toBe(5000)
  })

  test('bereits v2 (profile vorhanden) bleibt unverändert', () => {
    const v2 = { months: {}, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 0 }, profile: { onboarded: true, cashEnabled: true, goals: [] } }
    expect(migrateBudgetState(v2, 2)).toBe(v2)
  })
})
