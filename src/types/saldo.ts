// Datenmodell für die Schulden-/Auslagen-Verwaltung („Saldo").
// Alle Beträge in CENT (ganze Zahlen), um Rundungsfehler zu vermeiden.
//
// Saldo-Konvention (pro Person, berechnet aus den Bestellungen):
//   balance < 0  -> die Person schuldet dir
//   balance > 0  -> du schuldest der Person (Guthaben)

export interface SaldoPerson {
  id: string
  name: string
}

export interface SaldoProduct {
  id: string
  name: string
  /** zuletzt gezahlter Stückpreis in Cent (oder null) */
  lastPrice: number | null
}

export interface SaldoItem {
  id: string
  /** gesetzt -> wiederkehrender Artikel (Vorschläge + Preisgedächtnis) */
  productId: string | null
  /** gesetzt -> einmalige Auslage (freier Text, z. B. „Konzertticket") */
  label: string | null
  qty: number
  /** Stückpreis in Cent, null = unbekannt */
  price: number | null
  /**
   * true -> bereits eingekauft. Steuert allein die Einkaufsliste und ist
   * bewusst von der Bezahlung (order.paid/amountPaid) entkoppelt.
   * undefined/false = noch nicht eingekauft.
   */
  bought?: boolean
}

export interface SaldoOrder {
  personId: string
  items: SaldoItem[]
  paid: boolean
  /** tatsächlich erhaltener Betrag in Cent (oder null) */
  amountPaid: number | null
}

export interface SaldoTrip {
  id: string
  /** YYYY-MM-DD */
  date: string
  orders: SaldoOrder[]
}

export interface SaldoState {
  people: SaldoPerson[]
  products: SaldoProduct[]
  trips: SaldoTrip[]
}

/** Detail-Abrechnung einer einzelnen Bestellung (für die Bezahl-Anzeige). */
export interface OrderLedger {
  total: number
  prevBalance: number
  expected: number
  effectivePaid: number
  balanceAfter: number
  received: number | null
  diff: number
}

/** Produktvorschlag beim Tippen. */
export interface ProductSuggestion {
  id: string
  name: string
  lastPrice: number | null
  count: number
}
