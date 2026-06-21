// Typen für den Bank-Import (CAMT.053 + CSV). Beträge in CENT (ganze Zahlen,
// signed: negativ = Ausgabe, positiv = Einnahme). Datümer als 'YYYY-MM-DD'.
// Die Struktur entspricht dem Kern der Transaction aus types/budget.ts; die
// Store-Schicht reichert ParsedTransaction später um id/accountId/categoryId an.

export interface ParsedTransaction {
  /** Buchungsdatum im Format YYYY-MM-DD. */
  date: string
  /** Betrag in Cent, signed (negativ = Ausgabe, positiv = Einnahme). */
  amount: number
  /** Empfänger/Zahler (Gegenpartei). */
  counterparty: string
  /** Verwendungszweck. */
  purpose: string
  /** Stabiler Dedup-Schlüssel für idempotenten (Re-)Import. */
  hash: string
}
