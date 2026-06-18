import { describe, it, expect } from 'vitest'
import { orderTotal, computeBalances, orderLedger, suggestProducts } from './saldo'
import { parseEuroCents, euroCents } from './euro'
import { sanitizeSaldoState } from './saldoBackup'
import type { SaldoState } from '../types/saldo'

function state(partial: Partial<SaldoState> = {}): SaldoState {
  return { people: [], products: [], trips: [], ...partial }
}

describe('orderTotal', () => {
  it('summiert Stückpreis × Menge, null = 0', () => {
    const order = {
      personId: 'p1',
      paid: false,
      amountPaid: null,
      items: [
        { id: 'a', productId: 'a', label: null, qty: 2, price: 149 },
        { id: 'b', productId: 'b', label: null, qty: 1, price: null },
        { id: 'c', productId: 'c', label: null, qty: 3, price: 100 },
      ],
    }
    expect(orderTotal(order)).toBe(149 * 2 + 0 + 100 * 3)
  })
})

describe('computeBalances', () => {
  it('offene Bestellung: Saldo = -Summe (Person schuldet)', () => {
    const s = state({
      people: [{ id: 'p1', name: 'A' }],
      trips: [
        {
          id: 't1',
          date: '2026-06-01',
          orders: [
            {
              personId: 'p1',
              items: [{ id: 'x', productId: 'x', label: null, qty: 1, price: 1000 }],
              paid: false,
              amountPaid: null,
            },
          ],
        },
      ],
    })
    expect(computeBalances(s).p1).toBe(-1000)
  })

  it("'bezahlt' angehakt gleicht exakt aus (Saldo 0)", () => {
    const s = state({
      people: [{ id: 'p1', name: 'A' }],
      trips: [
        {
          id: 't1',
          date: '2026-06-01',
          orders: [
            {
              personId: 'p1',
              items: [{ id: 'x', productId: 'x', label: null, qty: 1, price: 1000 }],
              paid: true,
              amountPaid: null,
            },
          ],
        },
      ],
    })
    expect(computeBalances(s).p1).toBe(0)
  })

  it('Überzahlung erzeugt Guthaben', () => {
    const s = state({
      people: [{ id: 'p1', name: 'A' }],
      trips: [
        {
          id: 't1',
          date: '2026-06-01',
          orders: [
            {
              personId: 'p1',
              items: [{ id: 'x', productId: 'x', label: null, qty: 1, price: 1000 }],
              paid: true,
              amountPaid: 1200,
            },
          ],
        },
      ],
    })
    expect(computeBalances(s).p1).toBe(200)
    expect(orderLedger(s, 't1', 'p1').diff).toBe(200)
  })

  it('Guthaben wird beim nächsten Einkauf verrechnet', () => {
    const s = state({
      people: [{ id: 'p1', name: 'A' }],
      trips: [
        {
          id: 't1',
          date: '2026-06-01',
          orders: [
            {
              personId: 'p1',
              items: [{ id: 'x', productId: 'x', label: null, qty: 1, price: 1000 }],
              paid: true,
              amountPaid: 1200,
            },
          ],
        },
        {
          id: 't2',
          date: '2026-06-08',
          orders: [
            {
              personId: 'p1',
              items: [{ id: 'y', productId: 'y', label: null, qty: 1, price: 800 }],
              paid: true,
              amountPaid: null,
            },
          ],
        },
      ],
    })
    expect(computeBalances(s).p1).toBe(0)
    const l2 = orderLedger(s, 't2', 'p1')
    expect(l2.prevBalance).toBe(200)
    expect(l2.expected).toBe(600)
  })

  it('Unterzahlung mit vorhandenem Guthaben', () => {
    const s = state({
      people: [{ id: 'p1', name: 'A' }],
      trips: [
        {
          id: 't1',
          date: '2026-06-01',
          orders: [
            {
              personId: 'p1',
              items: [{ id: 'x', productId: 'x', label: null, qty: 1, price: 1000 }],
              paid: true,
              amountPaid: 1200,
            },
          ],
        },
        {
          id: 't2',
          date: '2026-06-08',
          orders: [
            {
              personId: 'p1',
              items: [{ id: 'y', productId: 'y', label: null, qty: 1, price: 800 }],
              paid: false,
              amountPaid: 500,
            },
          ],
        },
      ],
    })
    expect(computeBalances(s).p1).toBe(-100)
    const l2 = orderLedger(s, 't2', 'p1')
    expect(l2.expected).toBe(600)
    expect(l2.diff).toBe(-100)
  })

  it('Reihenfolge folgt dem Datum, nicht der Array-Position', () => {
    const s = state({
      people: [{ id: 'p1', name: 'A' }],
      trips: [
        {
          id: 'tLate',
          date: '2026-06-20',
          orders: [
            {
              personId: 'p1',
              items: [{ id: 'y', productId: 'y', label: null, qty: 1, price: 500 }],
              paid: false,
              amountPaid: null,
            },
          ],
        },
        {
          id: 'tEarly',
          date: '2026-06-01',
          orders: [
            {
              personId: 'p1',
              items: [{ id: 'x', productId: 'x', label: null, qty: 1, price: 1000 }],
              paid: true,
              amountPaid: 1200,
            },
          ],
        },
      ],
    })
    expect(computeBalances(s).p1).toBe(-300)
    expect(orderLedger(s, 'tLate', 'p1').prevBalance).toBe(200)
  })
})

describe('suggestProducts', () => {
  const s = state({
    people: [{ id: 'p1', name: 'A' }],
    products: [
      { id: 'milk', name: 'Milch', lastPrice: 109 },
      { id: 'bread', name: 'Brot', lastPrice: 159 },
      { id: 'eggs', name: 'Eier', lastPrice: 199 },
    ],
    trips: [
      {
        id: 't1',
        date: '2026-06-01',
        orders: [
          {
            personId: 'p1',
            items: [
              { id: 'i1', productId: 'milk', label: null, qty: 1, price: 109 },
              { id: 'i2', productId: 'bread', label: null, qty: 1, price: 159 },
            ],
            paid: true,
            amountPaid: null,
          },
        ],
      },
      {
        id: 't2',
        date: '2026-06-08',
        orders: [
          {
            personId: 'p1',
            items: [{ id: 'i3', productId: 'milk', label: null, qty: 1, price: 109 }],
            paid: true,
            amountPaid: null,
          },
        ],
      },
    ],
  })

  it('sortiert nach Häufigkeit pro Person', () => {
    const sugg = suggestProducts(s, 'p1', '')
    expect(sugg[0].name).toBe('Milch')
    expect(sugg[0].count).toBe(2)
    expect(sugg[1].name).toBe('Brot')
  })

  it('filtert nach Tippen', () => {
    const filtered = suggestProducts(s, 'p1', 'ei')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('Eier')
  })

  it('freie Auslagen erscheinen nicht als Vorschlag, zählen aber zur Summe', () => {
    const s2 = state({
      people: [{ id: 'p1', name: 'A' }],
      products: [{ id: 'milk', name: 'Milch', lastPrice: 109 }],
      trips: [
        {
          id: 't1',
          date: '2026-06-01',
          orders: [
            {
              personId: 'p1',
              items: [
                { id: 'i1', productId: 'milk', label: null, qty: 1, price: 109 },
                { id: 'i2', productId: null, label: 'Konzertticket', qty: 1, price: 1800 },
              ],
              paid: false,
              amountPaid: null,
            },
          ],
        },
      ],
    })
    expect(computeBalances(s2).p1).toBe(-(109 + 1800))
    const sugg = suggestProducts(s2, 'p1', '')
    expect(sugg).toHaveLength(1)
    expect(sugg[0].name).toBe('Milch')
  })
})

describe('parseEuroCents / euroCents', () => {
  it('versteht Komma, Punkt und Teilangaben', () => {
    expect(parseEuroCents('1,49')).toBe(149)
    expect(parseEuroCents('1.49')).toBe(149)
    expect(parseEuroCents('2')).toBe(200)
    expect(parseEuroCents('1,5')).toBe(150)
    expect(parseEuroCents('0,99 €')).toBe(99)
    expect(parseEuroCents('')).toBeNull()
    expect(parseEuroCents('abc')).toBeNull()
  })
  it('behandelt deutsche Tausendertrenner', () => {
    expect(parseEuroCents('1.000,49')).toBe(100049)
    expect(parseEuroCents('1.000')).toBe(100000)
  })
  it('euroCents formatiert deutsche Währung', () => {
    expect(euroCents(149)).toMatch(/1,49/)
    expect(euroCents(0)).toMatch(/0,00/)
  })
  it('liest negative Beträge und vermeidet -0', () => {
    expect(parseEuroCents('-7,20')).toBe(-720)
    expect(Object.is(parseEuroCents('-0'), 0)).toBe(true)
  })
  it('Punkt als Tausendertrenner bei 3er-Gruppen / mehreren Punkten', () => {
    expect(parseEuroCents('10.500')).toBe(1050000) // 10.500 € -> Cent
    expect(parseEuroCents('1.2.3')).toBe(12300) // alle Punkte als Tausender -> 123 €
  })
})

describe('sanitizeSaldoState', () => {
  it('entfernt verwaiste Bestellungen (unbekannte Person)', () => {
    const dirty = {
      people: [{ id: 'p1', name: 'A' }],
      products: [],
      trips: [
        {
          id: 't1',
          date: '2026-06-01',
          orders: [
            { personId: 'p1', items: [], paid: false, amountPaid: null },
            { personId: 'ghost', items: [], paid: false, amountPaid: null },
          ],
        },
      ],
    }
    const clean = sanitizeSaldoState(dirty)
    expect(clean.trips[0].orders).toHaveLength(1)
    expect(clean.trips[0].orders[0].personId).toBe('p1')
  })

  it('entfernt Artikel mit unbekanntem Produkt', () => {
    const dirty = {
      people: [{ id: 'p1', name: 'A' }],
      products: [{ id: 'a1', name: 'Milch', lastPrice: 100 }],
      trips: [
        {
          id: 't1',
          date: '2026-06-01',
          orders: [
            {
              personId: 'p1',
              items: [
                { id: 'i1', productId: 'a1', label: null, qty: 1, price: 100 },
                { id: 'i2', productId: 'ghost', label: null, qty: 1, price: 50 },
                { id: 'i3', productId: null, label: 'Ticket', qty: 1, price: 500 },
              ],
              paid: false,
              amountPaid: null,
            },
          ],
        },
      ],
    }
    const clean = sanitizeSaldoState(dirty)
    const items = clean.trips[0].orders[0].items
    expect(items).toHaveLength(2) // Milch + freie Auslage, Geist-Produkt raus
    expect(items.some((i) => i.productId === 'ghost')).toBe(false)
  })

  it('ignoriert nicht-Objekte sicher', () => {
    expect(sanitizeSaldoState(null)).toEqual({ people: [], products: [], trips: [] })
    expect(sanitizeSaldoState([])).toEqual({ people: [], products: [], trips: [] })
  })
})
