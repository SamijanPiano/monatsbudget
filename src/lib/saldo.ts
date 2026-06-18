// saldo.ts — das Herzstück: laufender Saldo (Verrechnung von Über-/Unterzahlungen),
// Häufigkeits-Vorschläge und Preis-Gedächtnis. Reine Funktionen, vollständig getestet.
//
// Saldo-Konvention: balance > 0 => Guthaben der Person (du schuldest ihr),
//                   balance < 0 => die Person schuldet dir.

import type {
  OrderLedger,
  ProductSuggestion,
  SaldoOrder,
  SaldoState,
} from '../types/saldo'

/** Summe einer Bestellung in Cent (fehlende Preise zählen als 0). */
export function orderTotal(order: SaldoOrder): number {
  return order.items.reduce((sum, it) => sum + (it.price ?? 0) * it.qty, 0)
}

/** Anzeigename eines Items: Produktname oder freier Auslagen-Text. */
export function itemName(state: SaldoState, item: { productId: string | null; label: string | null }): string {
  if (item.productId) return state.products.find((p) => p.id === item.productId)?.name ?? '—'
  return item.label || '—'
}

interface ChronoRow {
  trip: SaldoState['trips'][number]
  order: SaldoOrder
  tripIndex: number
  orderIndex: number
}

/** Alle Bestellungen einer Person in chronologischer Reihenfolge. */
function personOrdersChrono(state: SaldoState, personId: string): ChronoRow[] {
  const rows: ChronoRow[] = []
  state.trips.forEach((trip, tripIndex) => {
    trip.orders.forEach((order, orderIndex) => {
      if (order.personId === personId) rows.push({ trip, order, tripIndex, orderIndex })
    })
  })
  rows.sort(
    (a, b) =>
      a.trip.date.localeCompare(b.trip.date) ||
      a.tripIndex - b.tripIndex ||
      a.orderIndex - b.orderIndex,
  )
  return rows
}

/** Netto-Beitrag einer Bestellung zum Saldo (balanceAfter − prevBalance). */
function ledgerStep(
  order: SaldoOrder,
  total: number,
  prevBalance: number,
): { effectivePaid: number; balanceAfter: number } {
  let effectivePaid: number
  if (order.amountPaid != null) {
    effectivePaid = order.amountPaid
  } else if (order.paid) {
    effectivePaid = total - prevBalance // gleicht exakt aus
  } else {
    effectivePaid = 0
  }
  return { effectivePaid, balanceAfter: prevBalance - total + effectivePaid }
}

/** Berechnet den Saldo jeder Person aus den Bestellungen. */
export function computeBalances(state: SaldoState): Record<string, number> {
  const result: Record<string, number> = {}
  for (const person of state.people) {
    let balance = 0
    for (const { order } of personOrdersChrono(state, person.id)) {
      balance = ledgerStep(order, orderTotal(order), balance).balanceAfter
    }
    result[person.id] = balance
  }
  return result
}

/** Saldo einer einzelnen Person. */
export function balanceOf(state: SaldoState, personId: string): number {
  let balance = 0
  for (const { order } of personOrdersChrono(state, personId)) {
    balance = ledgerStep(order, orderTotal(order), balance).balanceAfter
  }
  return balance
}

/** Detaillierte Abrechnung EINER Bestellung – für die Bezahl-Anzeige. */
export function orderLedger(
  state: SaldoState,
  tripId: string,
  personId: string,
): OrderLedger {
  const rows = personOrdersChrono(state, personId)
  let prevBalance = 0
  let target: ChronoRow | null = null
  for (const row of rows) {
    if (row.trip.id === tripId) {
      target = row
      break
    }
    prevBalance = ledgerStep(row.order, orderTotal(row.order), prevBalance).balanceAfter
  }
  const order = target ? target.order : null
  const total = order ? orderTotal(order) : 0
  const expected = total - prevBalance
  const { effectivePaid, balanceAfter } = order
    ? ledgerStep(order, total, prevBalance)
    : { effectivePaid: 0, balanceAfter: prevBalance }
  const received = order && order.amountPaid != null ? order.amountPaid : null
  const diff = received == null ? 0 : received - expected
  return { total, prevBalance, expected, effectivePaid, balanceAfter, received, diff }
}

/** productId -> { count, lastSeen } für eine Person. */
function personFrequency(
  state: SaldoState,
  personId: string,
): Map<string, { count: number; lastSeen: string }> {
  const freq = new Map<string, { count: number; lastSeen: string }>()
  for (const trip of state.trips) {
    for (const order of trip.orders) {
      if (order.personId !== personId) continue
      for (const item of order.items) {
        if (!item.productId) continue
        const cur = freq.get(item.productId) ?? { count: 0, lastSeen: '' }
        freq.set(item.productId, {
          count: cur.count + 1,
          lastSeen: trip.date > cur.lastSeen ? trip.date : cur.lastSeen,
        })
      }
    }
  }
  return freq
}

/** Vorschläge beim Tippen: Produkte der Person nach Häufigkeit, gefiltert nach query. */
export function suggestProducts(
  state: SaldoState,
  personId: string,
  query: string,
  limit = 6,
): ProductSuggestion[] {
  const q = query.trim().toLowerCase()
  const freq = personFrequency(state, personId)
  const scored = state.products
    .map((prod) => {
      const f = freq.get(prod.id)
      return {
        prod,
        count: f?.count || 0,
        lastSeen: f?.lastSeen || '',
        matches: q === '' || prod.name.toLowerCase().includes(q),
      }
    })
    .filter((x) => x.matches)

  scored.sort(
    (a, b) =>
      b.count - a.count ||
      b.lastSeen.localeCompare(a.lastSeen) ||
      a.prod.name.localeCompare(b.prod.name, 'de'),
  )

  return scored.slice(0, limit).map((x) => ({
    id: x.prod.id,
    name: x.prod.name,
    lastPrice: x.prod.lastPrice,
    count: x.count,
  }))
}

/** Typische Artikel einer Person (für die Detailansicht). */
export function typicalProducts(
  state: SaldoState,
  personId: string,
  limit = 8,
): ProductSuggestion[] {
  return suggestProducts(state, personId, '', limit).filter((p) => p.count > 0)
}
