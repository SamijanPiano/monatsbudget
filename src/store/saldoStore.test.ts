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
