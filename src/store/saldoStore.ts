// Zustand-Store für die Schulden-/Auslagen-Verwaltung („Saldo").
// Salden werden NICHT gespeichert, sondern aus den Bestellungen berechnet
// (Single Source of Truth = trips). Persistenz in localStorage.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SaldoItem, SaldoState, SaldoTrip } from '../types/saldo'
import { createId } from '../lib/id'
import { sanitizeSaldoState } from '../lib/saldoBackup'

const STORAGE_KEY = 'saldo-v1'

interface SaldoActions {
  addPerson: (name: string) => string
  renamePerson: (id: string, name: string) => void
  removePerson: (id: string) => void
  addTrip: (dateIso: string) => string
  removeTrip: (id: string) => void
  setTripDate: (id: string, dateIso: string) => void
  addPersonToTrip: (tripId: string, personId: string) => void
  removeOrder: (tripId: string, personId: string) => void
  addItem: (tripId: string, personId: string, name: string, priceCents: number | null, qty?: number) => void
  addFreeItem: (tripId: string, personId: string, label: string, priceCents: number | null, qty?: number) => void
  changeItemQty: (tripId: string, personId: string, itemId: string, delta: number) => void
  setItemPrice: (tripId: string, personId: string, itemId: string, priceCents: number | null) => void
  setPayment: (
    tripId: string,
    personId: string,
    payload: { paid?: boolean; amountPaid?: number | null },
  ) => void
  replaceSaldo: (next: SaldoState) => void
}

export type SaldoStore = SaldoState & SaldoActions

function findOrder(s: SaldoState, tripId: string, personId: string) {
  return s.trips.find((t) => t.id === tripId)?.orders.find((o) => o.personId === personId)
}

export const useSaldoStore = create<SaldoStore>()(
  persist(
    (set) => {
      // Klont die Daten, wendet den Mutator an und setzt neuen State.
      const commit = (mutator: (s: SaldoState) => void) =>
        set((state) => {
          const next: SaldoState = structuredClone({
            people: state.people,
            products: state.products,
            trips: state.trips,
          })
          mutator(next)
          return next
        })

      return {
        people: [],
        products: [],
        trips: [],

        addPerson: (name) => {
          const id = createId()
          commit((s) => {
            s.people.push({ id, name: name.trim() })
          })
          return id
        },

        renamePerson: (id, name) =>
          commit((s) => {
            const p = s.people.find((x) => x.id === id)
            if (p) p.name = name.trim()
          }),

        removePerson: (id) =>
          commit((s) => {
            s.people = s.people.filter((p) => p.id !== id)
            s.trips.forEach((t) => {
              t.orders = t.orders.filter((o) => o.personId !== id)
            })
          }),

        addTrip: (dateIso) => {
          const id = createId()
          commit((s) => {
            s.trips.push({ id, date: dateIso, orders: [] })
          })
          return id
        },

        removeTrip: (id) =>
          commit((s) => {
            s.trips = s.trips.filter((t) => t.id !== id)
          }),

        setTripDate: (id, dateIso) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return
          commit((s) => {
            const t = s.trips.find((x) => x.id === id)
            if (t) t.date = dateIso
          })
        },

        addPersonToTrip: (tripId, personId) =>
          commit((s) => {
            const t = s.trips.find((x) => x.id === tripId)
            if (!t) return
            if (!s.people.some((p) => p.id === personId)) return
            if (t.orders.some((o) => o.personId === personId)) return
            t.orders.push({ personId, items: [], paid: false, amountPaid: null })
          }),

        removeOrder: (tripId, personId) =>
          commit((s) => {
            const t = s.trips.find((x) => x.id === tripId)
            if (t) t.orders = t.orders.filter((o) => o.personId !== personId)
          }),

        addItem: (tripId, personId, name, priceCents, qty = 1) =>
          commit((s) => {
            const order = findOrder(s, tripId, personId)
            if (!order) return
            const norm = name.trim().toLowerCase()
            let prod = s.products.find((p) => p.name.toLowerCase() === norm)
            if (!prod) {
              prod = { id: createId(), name: name.trim(), lastPrice: null }
              s.products.push(prod)
            }
            const price = priceCents ?? prod.lastPrice ?? null
            if (price != null) prod.lastPrice = price
            const item: SaldoItem = { id: createId(), productId: prod.id, label: null, qty, price }
            order.items.push(item)
          }),

        addFreeItem: (tripId, personId, label, priceCents, qty = 1) => {
          const text = label.trim()
          if (!text) return
          commit((s) => {
            const order = findOrder(s, tripId, personId)
            if (!order) return
            order.items.push({
              id: createId(),
              productId: null,
              label: text,
              qty,
              price: priceCents ?? null,
            })
          })
        },

        changeItemQty: (tripId, personId, itemId, delta) =>
          commit((s) => {
            const order = findOrder(s, tripId, personId)
            if (!order) return
            const item = order.items.find((i) => i.id === itemId)
            if (!item) return
            const next = item.qty + delta
            if (next <= 0) order.items = order.items.filter((i) => i.id !== itemId)
            else item.qty = next
          }),

        setItemPrice: (tripId, personId, itemId, priceCents) =>
          commit((s) => {
            const order = findOrder(s, tripId, personId)
            const item = order?.items.find((i) => i.id === itemId)
            if (!item) return
            item.price = priceCents
            if (item.productId && priceCents != null) {
              const prod = s.products.find((p) => p.id === item.productId)
              if (prod) prod.lastPrice = priceCents
            }
          }),

        setPayment: (tripId, personId, { paid, amountPaid }) =>
          commit((s) => {
            const order = findOrder(s, tripId, personId)
            if (!order) return
            if (paid !== undefined) order.paid = paid
            if (amountPaid !== undefined) order.amountPaid = amountPaid
          }),

        replaceSaldo: (next) => {
          const clean = sanitizeSaldoState(next)
          set({ people: clean.people, products: clean.products, trips: clean.trips })
        },
      }
    },
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (s) => ({ people: s.people, products: s.products, trips: s.trips }),
      migrate: (persisted) => sanitizeSaldoState(persisted),
    },
  ),
)

/** Aktuelle reine Daten (für Backup/Export). */
export function saldoSnapshot(): SaldoState {
  const s = useSaldoStore.getState()
  return { people: s.people, products: s.products, trips: s.trips }
}

export function findTrip(trips: SaldoTrip[], id: string): SaldoTrip | undefined {
  return trips.find((t) => t.id === id)
}
