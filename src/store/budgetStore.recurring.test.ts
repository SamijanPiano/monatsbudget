import { beforeEach, describe, expect, it } from 'vitest'
import { useBudgetStore } from './budgetStore'
import type { Contract, RecurringRule } from '../types/budget'

const rule = (counterparty: string, amountApprox: number): RecurringRule => ({
  id: `r-${counterparty}-${amountApprox}`,
  counterparty,
  amountApprox,
  cadence: 'monthly',
  categoryId: null,
  nextExpected: '2026-11-01',
})

const contract = (label: string, source: Contract['source']): Contract => ({
  id: `c-${label}-${source}`,
  label,
  counterparty: label,
  categoryId: null,
  amountApprox: -449,
  cadence: 'monthly',
  nextDue: '2026-11-01',
  status: 'active',
  source,
  linkedCounterpartyKey: label.toLowerCase(),
})

describe('Kein Dauerposten', () => {
  beforeEach(() => {
    useBudgetStore.setState({
      transactions: [],
      dismissedRecurring: [],
      recurringRules: [rule('Amazon EU', -449), rule('Landesbank', -115), rule('Landesbank', -998)],
      contracts: [contract('Amazon EU', 'detected'), contract('Landesbank', 'manual')],
    })
  })

  it('nimmt alle Posten des Empfängers raus und merkt ihn normalisiert', () => {
    useBudgetStore.getState().dismissRecurring('Landesbank')
    const s = useBudgetStore.getState()
    expect(s.recurringRules.map((r) => r.counterparty)).toEqual(['Amazon EU'])
    expect(s.dismissedRecurring).toEqual(['landesbank'])
  })

  it('löscht nur den automatisch erkannten Vertrag, nicht einen selbst angelegten', () => {
    useBudgetStore.getState().dismissRecurring('Amazon EU')
    useBudgetStore.getState().dismissRecurring('Landesbank')
    expect(useBudgetStore.getState().contracts.map((c) => c.id)).toEqual(['c-Landesbank-manual'])
  })

  it('zurückholen leert die Liste', () => {
    useBudgetStore.getState().dismissRecurring('Amazon EU')
    useBudgetStore.getState().restoreDismissedRecurring()
    expect(useBudgetStore.getState().dismissedRecurring).toEqual([])
  })
})
