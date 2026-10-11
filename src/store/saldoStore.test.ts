import { beforeEach, describe, expect, test, vi } from 'vitest'

// In-Memory-localStorage-Shim für die node-Umgebung, damit das persist-Middleware
// nicht auf ein fehlendes localStorage trifft.
const mem = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
})

const { useSaldoStore } = await import('./saldoStore')
const { balanceOf } = await import('../lib/saldo')

/** Legt eine Person mit einer Bestellung samt einem Artikel an. Gibt IDs zurück. */
function seedOrderWithItem(): { personId: string; tripId: string; itemId: string } {
  const s = useSaldoStore.getState()
  const personId = s.addPerson('Alex')
  const tripId = s.addTrip('2026-06-01')
  useSaldoStore.getState().addPersonToTrip(tripId, personId)
  useSaldoStore.getState().addItem(tripId, personId, 'Milch', 99, 1)
  const order = useSaldoStore.getState().trips.find((t) => t.id === tripId)!.orders[0]
  return { personId, tripId, itemId: order.items[0].id }
}

beforeEach(() => {
  useSaldoStore.setState({ people: [], products: [], trips: [], shoppingChecked: [] })
})

describe('Einkaufsliste — bought & Häkchen', () => {
  test('setItemBought markiert einen Artikel als eingekauft', () => {
    const { tripId, personId, itemId } = seedOrderWithItem()
    useSaldoStore.getState().setItemBought(tripId, personId, itemId, true)
    const item = useSaldoStore.getState().trips[0].orders[0].items[0]
    expect(item.id).toBe(itemId)
    expect(item.bought).toBe(true)
  })

  test('completeShopping markiert alle übergebenen Artikel als bought', () => {
    const { itemId } = seedOrderWithItem()
    useSaldoStore.getState().completeShopping([itemId])
    expect(useSaldoStore.getState().trips[0].orders[0].items[0].bought).toBe(true)
  })

  test('completeShopping ignoriert leere Liste', () => {
    seedOrderWithItem()
    useSaldoStore.getState().completeShopping([])
    expect(useSaldoStore.getState().trips[0].orders[0].items[0].bought).toBeFalsy()
  })

  test('bought ist von der Bezahlung entkoppelt — Order bleibt unbezahlt', () => {
    const { itemId } = seedOrderWithItem()
    useSaldoStore.getState().completeShopping([itemId])
    const order = useSaldoStore.getState().trips[0].orders[0]
    expect(order.items[0].bought).toBe(true)
    expect(order.paid).toBe(false)
    expect(order.amountPaid).toBeNull()
  })

  test('toggleShoppingChecked schaltet Item-IDs um (persistierter Zwischenstand)', () => {
    useSaldoStore.getState().toggleShoppingChecked('i1')
    expect(useSaldoStore.getState().shoppingChecked).toContain('i1')
    useSaldoStore.getState().toggleShoppingChecked('i1')
    expect(useSaldoStore.getState().shoppingChecked).not.toContain('i1')
  })

  test('clearShoppingChecked leert die Häkchen', () => {
    useSaldoStore.getState().toggleShoppingChecked('i1')
    useSaldoStore.getState().toggleShoppingChecked('i2')
    useSaldoStore.getState().clearShoppingChecked()
    expect(useSaldoStore.getState().shoppingChecked).toEqual([])
  })
})

describe('Produkte-Editor', () => {
  test('renameProduct und setProductPrice ändern das Produkt', () => {
    seedOrderWithItem()
    const product = useSaldoStore.getState().products[0]
    useSaldoStore.getState().renameProduct(product.id, 'Vollmilch')
    useSaldoStore.getState().setProductPrice(product.id, 129)
    const updated = useSaldoStore.getState().products[0]
    expect(updated.name).toBe('Vollmilch')
    expect(updated.lastPrice).toBe(129)
  })

  test('removeProduct entfernt das Produkt und verwaiste Item-Verweise', () => {
    seedOrderWithItem()
    const product = useSaldoStore.getState().products[0]
    useSaldoStore.getState().removeProduct(product.id)
    expect(useSaldoStore.getState().products).toHaveLength(0)
    // Reiner Produkt-Verweis ohne Label wird entfernt.
    expect(useSaldoStore.getState().trips[0].orders[0].items).toHaveLength(0)
  })
})

describe('settleBalance — Schuld/Guthaben abschließen', () => {
  const snapshot = () => {
    const s = useSaldoStore.getState()
    return { people: s.people, products: s.products, trips: s.trips }
  }

  test('gleicht ein Guthaben (Überzahlung) auf 0 aus', () => {
    const { personId, tripId } = seedOrderWithItem() // Bestellung über 0,99 €
    useSaldoStore.getState().setPayment(tripId, personId, { amountPaid: 500 }) // 5,00 € erhalten
    expect(balanceOf(snapshot(), personId)).toBe(401) // 4,01 € Guthaben

    useSaldoStore.getState().settleBalance(personId)

    expect(balanceOf(snapshot(), personId)).toBe(0)
    const trips = useSaldoStore.getState().trips
    expect(trips).toHaveLength(2)
    const settle = trips[1].orders[0]
    expect(settle.personId).toBe(personId)
    expect(settle.paid).toBe(true)
    expect(settle.items).toHaveLength(0)
  })

  test('gleicht auch eine offene Schuld auf 0 aus', () => {
    const { personId } = seedOrderWithItem() // 0,99 € offen -> balance -99
    expect(balanceOf(snapshot(), personId)).toBe(-99)
    useSaldoStore.getState().settleBalance(personId)
    expect(balanceOf(snapshot(), personId)).toBe(0)
  })

  test('bei ausgeglichenem Saldo passiert nichts (kein leerer Trip)', () => {
    const { personId, tripId } = seedOrderWithItem()
    useSaldoStore.getState().setPayment(tripId, personId, { paid: true }) // exakt ausgeglichen
    expect(balanceOf(snapshot(), personId)).toBe(0)
    useSaldoStore.getState().settleBalance(personId)
    expect(useSaldoStore.getState().trips).toHaveLength(1)
  })

  test('unbekannte Person → kein Effekt', () => {
    seedOrderWithItem()
    useSaldoStore.getState().settleBalance('gibt-es-nicht')
    expect(useSaldoStore.getState().trips).toHaveLength(1)
  })

  test('gleicht auch bei zukünftig datiertem Trip auf 0 aus', () => {
    const { personId } = seedOrderWithItem() // 0,99 € offen -> balance -99
    // Zukünftiger Trip mit fixer Zahlung: läge der Ausgleich davor, wäre der Endsaldo ≠ 0.
    const futureTrip = useSaldoStore.getState().addTrip('2099-01-01')
    useSaldoStore.getState().addPersonToTrip(futureTrip, personId)
    useSaldoStore.getState().setPayment(futureTrip, personId, { amountPaid: 1500 })

    useSaldoStore.getState().settleBalance(personId)
    expect(balanceOf(snapshot(), personId)).toBe(0)
  })
})
