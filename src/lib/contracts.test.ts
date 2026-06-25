import { describe, it, expect } from 'vitest'
import { contractsFromRecurring, dueReminders, noticeDeadline } from './contracts'
import type { Contract, RecurringRule } from '../types/budget'

function rule(partial: Partial<RecurringRule> & { counterparty: string; amountApprox: number }): RecurringRule {
  return {
    id: `r-${partial.counterparty}`,
    cadence: 'monthly',
    categoryId: null,
    nextExpected: '2026-07-15',
    ...partial,
  }
}

function contract(partial: Partial<Contract> & { id: string }): Contract {
  return {
    label: 'Test',
    counterparty: 'Test',
    categoryId: null,
    amountApprox: -1000,
    cadence: 'monthly',
    nextDue: '2026-07-15',
    status: 'active',
    source: 'manual',
    ...partial,
  }
}

describe('contractsFromRecurring', () => {
  it('leitet aus einem wiederkehrenden Ausfluss einen Vertrag ab', () => {
    // Arrange
    const recurring = [rule({ counterparty: 'Netflix', amountApprox: -1799, categoryId: 'cat-abo' })]

    // Act
    const result = contractsFromRecurring(recurring, [])

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Netflix')
    expect(result[0].amountApprox).toBe(-1799)
    expect(result[0].categoryId).toBe('cat-abo')
    expect(result[0].source).toBe('detected')
    expect(result[0].status).toBe('active')
    expect(result[0].linkedCounterpartyKey).toBe('netflix')
  })

  it('ignoriert Einnahmen (positive Beträge wie Gehalt)', () => {
    const recurring = [rule({ counterparty: 'Arbeitgeber', amountApprox: 250000 })]
    expect(contractsFromRecurring(recurring, [])).toHaveLength(0)
  })

  it('dupliziert keinen bereits verknüpften Vertrag', () => {
    // Arrange
    const existing = [contract({ id: 'c1', linkedCounterpartyKey: 'netflix', source: 'detected' })]
    const recurring = [rule({ counterparty: 'NETFLIX', amountApprox: -1799 })]

    // Act
    const result = contractsFromRecurring(recurring, existing)

    // Assert: bestehender bleibt, kein zweiter dazu.
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
  })

  it('erhält manuelle Verträge und ergänzt neu erkannte', () => {
    const existing = [contract({ id: 'manual-1', counterparty: 'Fitnessstudio' })]
    const recurring = [rule({ counterparty: 'Spotify', amountApprox: -999 })]
    const result = contractsFromRecurring(recurring, existing)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('manual-1')
    expect(result[1].counterparty).toBe('Spotify')
  })
})

describe('noticeDeadline', () => {
  it('rechnet Vertragsende minus Kündigungsfrist', () => {
    const c = contract({ id: 'c', contractEnd: '2026-12-31', noticePeriodDays: 30 })
    expect(noticeDeadline(c)).toBe('2026-12-01')
  })

  it('gibt null ohne Vertragsende oder Frist', () => {
    expect(noticeDeadline(contract({ id: 'c', noticePeriodDays: 30 }))).toBeNull()
    expect(noticeDeadline(contract({ id: 'c', contractEnd: '2026-12-31' }))).toBeNull()
  })

  it('rechnet über Monatsgrenzen korrekt', () => {
    const c = contract({ id: 'c', contractEnd: '2026-03-05', noticePeriodDays: 10 })
    expect(noticeDeadline(c)).toBe('2026-02-23')
  })
})

describe('dueReminders', () => {
  const TODAY = new Date('2026-11-15T12:00:00Z')

  it('meldet einen Vertrag, dessen Stichtag in den nächsten 30 Tagen liegt', () => {
    // Vertragsende 2026-12-31, Frist 30 Tage -> Stichtag 2026-12-01, in 16 Tagen.
    const contracts = [contract({ id: 'c', contractEnd: '2026-12-31', noticePeriodDays: 30 })]
    const reminders = dueReminders(contracts, TODAY, 30)
    expect(reminders).toHaveLength(1)
    expect(reminders[0].deadline).toBe('2026-12-01')
    expect(reminders[0].daysLeft).toBe(16)
  })

  it('ignoriert Verträge mit Stichtag außerhalb des Fensters', () => {
    const contracts = [contract({ id: 'c', contractEnd: '2027-06-30', noticePeriodDays: 30 })]
    expect(dueReminders(contracts, TODAY, 30)).toHaveLength(0)
  })

  it('ignoriert bereits vergangene Stichtage', () => {
    const contracts = [contract({ id: 'c', contractEnd: '2026-11-01', noticePeriodDays: 30 })]
    expect(dueReminders(contracts, TODAY, 30)).toHaveLength(0)
  })

  it('ignoriert gekündigte Verträge', () => {
    const contracts = [
      contract({ id: 'c', contractEnd: '2026-12-31', noticePeriodDays: 30, status: 'canceled' }),
    ]
    expect(dueReminders(contracts, TODAY, 30)).toHaveLength(0)
  })

  it('sortiert nach Dringlichkeit (wenigste Tage zuerst)', () => {
    const contracts = [
      contract({ id: 'far', contractEnd: '2026-12-31', noticePeriodDays: 20 }), // Stichtag 2026-12-11 -> 26 Tage
      contract({ id: 'near', contractEnd: '2026-12-31', noticePeriodDays: 40 }), // Stichtag 2026-11-21 -> 6 Tage
    ]
    const reminders = dueReminders(contracts, TODAY, 30)
    expect(reminders.map((r) => r.contract.id)).toEqual(['near', 'far'])
  })
})
