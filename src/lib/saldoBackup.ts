// Bereinigt beliebige (auch importierte/manipulierte) Saldo-Daten auf bekannte,
// skalare Felder. Schützt vor Prototype-Pollution und kaputten Backups.

import type {
  SaldoItem,
  SaldoOrder,
  SaldoPerson,
  SaldoProduct,
  SaldoState,
  SaldoTrip,
} from '../types/saldo'
import { createId } from './id'
import { todayIso } from './euro'

const MAX_ENTITIES = 20000

function str(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}
function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null
}

function sanitizePerson(p: unknown): SaldoPerson | null {
  if (!p || typeof p !== 'object') return null
  const r = p as Record<string, unknown>
  const name = str(r.name).trim()
  if (!name) return null
  return { id: str(r.id) || createId(), name }
}

function sanitizeProduct(p: unknown): SaldoProduct | null {
  if (!p || typeof p !== 'object') return null
  const r = p as Record<string, unknown>
  const name = str(r.name).trim()
  if (!name) return null
  return { id: str(r.id) || createId(), name, lastPrice: int(r.lastPrice) }
}

function sanitizeItem(it: unknown): SaldoItem | null {
  if (!it || typeof it !== 'object') return null
  const r = it as Record<string, unknown>
  const productId = str(r.productId)
  const label = str(r.label).trim()
  if (!productId && !label) return null
  const qty = int(r.qty)
  return {
    id: str(r.id) || createId(),
    productId: productId || null,
    label: label || null,
    qty: qty && qty > 0 ? qty : 1,
    price: int(r.price),
    bought: r.bought === true,
  }
}

function sanitizeOrder(o: unknown): SaldoOrder | null {
  if (!o || typeof o !== 'object') return null
  const r = o as Record<string, unknown>
  const personId = str(r.personId)
  if (!personId) return null
  return {
    personId,
    items: Array.isArray(r.items)
      ? (r.items.map(sanitizeItem).filter(Boolean) as SaldoItem[])
      : [],
    paid: r.paid === true,
    amountPaid: r.amountPaid == null ? null : int(r.amountPaid),
  }
}

function sanitizeTrip(t: unknown): SaldoTrip | null {
  if (!t || typeof t !== 'object') return null
  const r = t as Record<string, unknown>
  const date = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : todayIso()
  return {
    id: str(r.id) || createId(),
    date,
    orders: Array.isArray(r.orders)
      ? (r.orders.map(sanitizeOrder).filter(Boolean) as SaldoOrder[])
      : [],
  }
}

function arr<T>(v: unknown, fn: (x: unknown) => T | null): T[] {
  return Array.isArray(v) ? (v.slice(0, MAX_ENTITIES).map(fn).filter(Boolean) as T[]) : []
}

/** Validiert/repariert einen beliebigen Saldo-Datenstand. */
export function sanitizeSaldoState(data: unknown): SaldoState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { people: [], products: [], trips: [] }
  }
  const r = data as Record<string, unknown>
  const people = arr(r.people, sanitizePerson)
  const products = arr(r.products, sanitizeProduct)
  const personIds = new Set(people.map((p) => p.id))
  const productIds = new Set(products.map((p) => p.id))

  // Verwaiste Bestellungen (unbekannte Person) und Artikel (unbekanntes
  // Produkt) entfernen, damit keine unsichtbaren Datensätze entstehen.
  const trips = arr(r.trips, sanitizeTrip).map((t) => ({
    ...t,
    orders: t.orders
      .filter((o) => personIds.has(o.personId))
      .map((o) => ({
        ...o,
        items: o.items.filter((it) => it.productId == null || productIds.has(it.productId)),
      })),
  }))

  return { people, products, trips }
}

/** Erkennt ein altes „Saldo"/„Aldi"-Backup (reines {people,products,trips}). */
export function isSaldoBackup(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const r = data as Record<string, unknown>
  return Array.isArray(r.trips) && Array.isArray(r.people)
}
