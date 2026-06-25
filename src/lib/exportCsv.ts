// Transaktionen als CSV (für Excel/Numbers). Rein funktional. Deutsches Format:
// Semikolon-getrennt, Komma als Dezimaltrenner (Excel-DE-freundlich). Beträge in
// Euro mit Vorzeichen (negativ = Ausgabe). Felder mit Sonderzeichen werden
// RFC-4180-konform mit doppelten Anführungszeichen escaped.

import type { Account, Category, Transaction } from '../types/budget'

const HEADER = [
  'Datum',
  'Betrag',
  'Empfänger',
  'Verwendungszweck',
  'Kategorie',
  'Konto',
  'Quelle',
]

/** Cent -> "-17,99" (Euro mit deutschem Dezimalkomma, mit Vorzeichen). */
function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/** RFC-4180: quoten, wenn das Feld Trenner, Quote oder Zeilenumbruch enthält. */
function csvEscape(value: string): string {
  if (/[";\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Baut eine CSV über alle Buchungen. Kategorie und Konto werden über ihre IDs
 * zu lesbaren Namen aufgelöst; unbekannte/leere Werte bleiben leer.
 */
export function transactionsToCsv(
  txs: readonly Transaction[],
  categories: readonly Category[],
  accounts: readonly Account[],
): string {
  const catLabel = new Map(categories.map((c) => [c.id, c.label]))
  const accName = new Map(accounts.map((a) => [a.id, a.name]))

  const rows = txs.map((t) => [
    t.date,
    centsToEuroString(t.amount),
    t.counterparty,
    t.purpose,
    t.categoryId ? (catLabel.get(t.categoryId) ?? '') : '',
    accName.get(t.accountId) ?? '',
    t.source,
  ])

  return [HEADER, ...rows].map((row) => row.map(csvEscape).join(';')).join('\r\n')
}
