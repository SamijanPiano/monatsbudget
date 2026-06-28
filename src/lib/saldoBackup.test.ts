import { describe, expect, test } from 'vitest'
import { sanitizeSaldoState } from './saldoBackup'

describe('sanitizeSaldoState — bought-Flag', () => {
  const base = {
    people: [{ id: 'p1', name: 'Alex' }],
    products: [{ id: 'pr1', name: 'Milch', lastPrice: 99 }],
  }

  test('erhält bought=true beim Bereinigen', () => {
    const clean = sanitizeSaldoState({
      ...base,
      trips: [
        {
          id: 't1',
          date: '2026-06-01',
          orders: [
            {
              personId: 'p1',
              paid: false,
              amountPaid: null,
              items: [{ id: 'i1', productId: 'pr1', label: null, qty: 1, price: 99, bought: true }],
            },
          ],
        },
      ],
    })
    expect(clean.trips[0].orders[0].items[0].bought).toBe(true)
  })

  test('setzt bought auf false, wenn nicht gesetzt', () => {
    const clean = sanitizeSaldoState({
      ...base,
      trips: [
        {
          id: 't1',
          date: '2026-06-01',
          orders: [
            {
              personId: 'p1',
              paid: false,
              amountPaid: null,
              items: [{ id: 'i1', productId: 'pr1', label: null, qty: 1, price: 99 }],
            },
          ],
        },
      ],
    })
    expect(clean.trips[0].orders[0].items[0].bought).toBe(false)
  })
})
