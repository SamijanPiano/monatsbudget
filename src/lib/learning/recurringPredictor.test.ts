import { describe, expect, test } from 'vitest'
import type { Transaction } from '../../types/budget'
import type { LearningSignal, RecurringConfirmedSignal } from './signals'
import { recurringPredictor } from './recurringPredictor'

function tx(date: string, amount: number, counterparty: string): Transaction {
  return {
    id: `t-${date}-${Math.random()}`,
    date,
    amount,
    counterparty,
    purpose: '',
    categoryId: null,
    accountId: 'a1',
    source: 'import',
    hash: `h-${Math.random()}`,
  }
}

function confirmed(counterpartyKey: string, amountCent: number, dayOfMonth: number): RecurringConfirmedSignal {
  return {
    id: `c-${Math.random()}`,
    ts: '2026-06-01T00:00:00.000Z',
    type: 'recurring-confirmed',
    counterpartyKey,
    amountCent,
    dayOfMonth,
  }
}

describe('recurringPredictor', () => {
  test('regelmäßige Buchung: Tag, Betrag und nächste Fälligkeit', () => {
    const txs = [
      tx('2026-04-15', -1799, 'Netflix'),
      tx('2026-05-15', -1799, 'Netflix'),
      tx('2026-06-15', -1799, 'Netflix'),
    ]
    const out = recurringPredictor(
      { counterpartyKey: 'netflix', transactions: txs, now: '2026-06-20T00:00:00.000Z' },
      [],
    )
    expect(out[0].value.dayOfMonth).toBe(15)
    expect(out[0].value.amountCent).toBe(-1799)
    expect(out[0].value.nextDue).toBe('2026-07-15')
    expect(out[0].confidence).toBeGreaterThan(0.7)
  })

  test('nächste Fälligkeit bleibt im selben Monat, wenn der Tag noch kommt', () => {
    const txs = [tx('2026-04-15', -1000, 'X'), tx('2026-05-15', -1000, 'X')]
    const out = recurringPredictor(
      { counterpartyKey: 'x', transactions: txs, now: '2026-06-10T00:00:00.000Z' },
      [],
    )
    expect(out[0].value.nextDue).toBe('2026-06-15')
  })

  test('weniger als zwei Vorkommen: leeres Ergebnis', () => {
    const txs = [tx('2026-06-15', -1000, 'Solo')]
    const out = recurringPredictor(
      { counterpartyKey: 'solo', transactions: txs, now: '2026-06-20T00:00:00.000Z' },
      [],
    )
    expect(out).toEqual([])
  })

  test('bezieht recurring-confirmed-Signale als Datenpunkte ein', () => {
    const txs = [tx('2026-05-15', -1799, 'Netflix')]
    const signals: LearningSignal[] = [confirmed('netflix', -1799, 15)]
    const out = recurringPredictor(
      { counterpartyKey: 'netflix', transactions: txs, now: '2026-06-20T00:00:00.000Z' },
      signals,
    )
    expect(out[0].value.dayOfMonth).toBe(15)
    expect(out[0].value.nextDue).toBe('2026-07-15')
  })
})
