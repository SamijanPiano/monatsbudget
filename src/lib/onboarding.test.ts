import { describe, expect, test } from 'vitest'
import {
  initialOnboardingState, onboardingReducer, visibleSteps, canGoNext, buildResult,
} from './onboarding'

describe('Onboarding-Navigation', () => {
  test('Startzustand: Schritt 0, keine Ziele', () => {
    const s = initialOnboardingState()
    expect(s.stepIndex).toBe(0)
    expect(s.goalChoices).toEqual([])
  })

  test('Goals-Schritt erst weiter mit mindestens einem Ziel', () => {
    let s = initialOnboardingState()
    s = onboardingReducer(s, { kind: 'next' }) // -> goals
    expect(canGoNext(s)).toBe(false)
    s = onboardingReducer(s, { kind: 'toggleGoal', goal: 'save' })
    expect(canGoNext(s)).toBe(true)
  })

  test('ohne ziel-tragende Ziele wird goalsetup übersprungen', () => {
    let s = initialOnboardingState()
    s = onboardingReducer(s, { kind: 'toggleGoal', goal: 'overview' })
    expect(visibleSteps(s)).not.toContain('goalsetup')
  })

  test('mit Sparziel erscheint goalsetup', () => {
    let s = initialOnboardingState()
    s = onboardingReducer(s, { kind: 'toggleGoal', goal: 'save' })
    expect(visibleSteps(s)).toContain('goalsetup')
  })

  test('toggleGoal legt/entfernt passenden Draft an', () => {
    let s = initialOnboardingState()
    s = onboardingReducer(s, { kind: 'toggleGoal', goal: 'save' })
    expect(s.goalDrafts).toHaveLength(1)
    s = onboardingReducer(s, { kind: 'toggleGoal', goal: 'save' })
    expect(s.goalDrafts).toHaveLength(0)
  })
})

describe('buildResult', () => {
  test('mappt Drafts auf Goals und übernimmt cash + Schnellstart', () => {
    let s = initialOnboardingState()
    s = onboardingReducer(s, { kind: 'setCash', value: true })
    s = onboardingReducer(s, { kind: 'setIncome', value: 2400 })
    s = onboardingReducer(s, { kind: 'toggleGoal', goal: 'save' })
    s = onboardingReducer(s, { kind: 'setGoalDraft', index: 0, patch: { label: 'Japan', targetAmount: 5000, currentAmount: 1750, deadline: '2026-12' } })
    const r = buildResult(s, new Date('2026-06-15'))
    expect(r.cashEnabled).toBe(true)
    expect(r.income).toBe(2400)
    expect(r.goals).toHaveLength(1)
    expect(r.goals[0]).toMatchObject({ type: 'save', label: 'Japan', targetAmount: 5000, currentAmount: 1750, deadline: '2026-12' })
    expect(r.goals[0].id).toBeTruthy()
  })

  test('debt-Draft: target = current (Fortschritt startet bei 0)', () => {
    let s = initialOnboardingState()
    s = onboardingReducer(s, { kind: 'toggleGoal', goal: 'debt' })
    s = onboardingReducer(s, { kind: 'setGoalDraft', index: 0, patch: { label: 'Kredit', currentAmount: 800 } })
    const r = buildResult(s)
    expect(r.goals[0]).toMatchObject({ type: 'debt', targetAmount: 800, currentAmount: 800 })
  })
})
