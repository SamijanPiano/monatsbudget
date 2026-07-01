import { describe, expect, test } from 'vitest'
import type { Transaction } from '../../types/budget'
import {
  budgetSetEvent,
  categoryAssignedEvent,
  itemCreatedEvent,
  recurringConfirmedEvent,
} from './events'

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    date: '2026-06-01',
    amount: -1000,
    counterparty: '',
    purpose: '',
    categoryId: null,
    accountId: 'a1',
    source: 'import',
    hash: 'h1',
    ...partial,
  }
}

describe('categoryAssignedEvent', () => {
  test('normalisiert Empfänger und tokenisiert den Zweck', () => {
    const event = categoryAssignedEvent(
      tx({ counterparty: '  REWE  Markt ', purpose: 'EC Kartenzahlung Mai' }),
      'cat-food',
    )
    expect(event.type).toBe('category-assigned')
    expect(event.counterpartyKey).toBe('rewe markt')
    expect(event.purposeTokens).toEqual(['ec', 'kartenzahlung', 'mai'])
    expect(event.categoryId).toBe('cat-food')
    expect(event.source).toBe('manual')
  })

  test('Quelle ist überschreibbar (z. B. Vorschlag angenommen)', () => {
    const event = categoryAssignedEvent(tx({ counterparty: 'Netflix' }), 'cat-stream', 'suggestion')
    expect(event.source).toBe('suggestion')
  })
})

describe('itemCreatedEvent', () => {
  test('normalisiert Label und übernimmt Sektion/Betrag/Wiederkehr', () => {
    const event = itemCreatedEvent({ label: ' Lebensmittel ' }, 'variable', 8000, null, false)
    expect(event.type).toBe('item-created')
    expect(event.section).toBe('variable')
    expect(event.labelKey).toBe('lebensmittel')
    expect(event.amountCent).toBe(8000)
    expect(event.recurring).toBe(false)
  })
})

describe('budgetSetEvent', () => {
  test('trägt Kategorie, Betrag (Cent) und Monat', () => {
    const event = budgetSetEvent('cat-food', 30000, '2026-06')
    expect(event.type).toBe('budget-set')
    expect(event.categoryId).toBe('cat-food')
    expect(event.amountCent).toBe(30000)
    expect(event.monthId).toBe('2026-06')
  })
})

describe('recurringConfirmedEvent', () => {
  test('normalisiert Empfänger, trägt Betrag und Tag', () => {
    const event = recurringConfirmedEvent('  Netflix ', -1799, 15)
    expect(event.type).toBe('recurring-confirmed')
    expect(event.counterpartyKey).toBe('netflix')
    expect(event.amountCent).toBe(-1799)
    expect(event.dayOfMonth).toBe(15)
  })
})
