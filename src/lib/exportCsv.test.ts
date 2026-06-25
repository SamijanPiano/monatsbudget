import { describe, it, expect } from 'vitest'
import { transactionsToCsv } from './exportCsv'
import type { Account, Category, Transaction } from '../types/budget'

const categories: Category[] = [
  { id: 'c1', label: 'Lebensmittel', kind: 'variable', budget: null, rules: [] },
]
const accounts: Account[] = [{ id: 'a1', name: 'Girokonto', type: 'checking', balance: null }]

function tx(partial: Partial<Transaction> & { date: string; amount: number }): Transaction {
  return {
    id: `tx-${partial.date}`,
    counterparty: 'Edeka',
    purpose: 'Einkauf',
    categoryId: 'c1',
    accountId: 'a1',
    source: 'import',
    hash: 'h',
    ...partial,
  }
}

describe('transactionsToCsv', () => {
  it('schreibt eine Kopfzeile', () => {
    const csv = transactionsToCsv([], categories, accounts)
    expect(csv).toBe('Datum;Betrag;Empfänger;Verwendungszweck;Kategorie;Konto;Quelle')
  })

  it('formatiert Beträge in Euro mit Komma und Vorzeichen', () => {
    const csv = transactionsToCsv([tx({ date: '2026-01-05', amount: -1799 })], categories, accounts)
    const [, row] = csv.split('\r\n')
    expect(row).toBe('2026-01-05;-17,99;Edeka;Einkauf;Lebensmittel;Girokonto;import')
  })

  it('löst Kategorie- und Konto-IDs zu Namen auf', () => {
    const csv = transactionsToCsv([tx({ date: '2026-01-05', amount: 5000 })], categories, accounts)
    expect(csv).toContain('Lebensmittel')
    expect(csv).toContain('Girokonto')
  })

  it('lässt unbekannte Kategorie leer', () => {
    const csv = transactionsToCsv(
      [tx({ date: '2026-01-05', amount: -100, categoryId: null })],
      categories,
      accounts,
    )
    const [, row] = csv.split('\r\n')
    // Kategorie-Spalte (Index 4) ist leer.
    expect(row.split(';')[4]).toBe('')
  })

  it('escaped Felder mit Semikolon oder Anführungszeichen', () => {
    const csv = transactionsToCsv(
      [tx({ date: '2026-01-05', amount: -100, purpose: 'Rewe; "Markt"' })],
      categories,
      accounts,
    )
    expect(csv).toContain('"Rewe; ""Markt"""')
  })

  it('trennt Zeilen mit CRLF', () => {
    const csv = transactionsToCsv(
      [tx({ date: '2026-01-05', amount: -100 }), tx({ date: '2026-01-06', amount: -200 })],
      categories,
      accounts,
    )
    expect(csv.split('\r\n')).toHaveLength(3) // Header + 2 Zeilen
  })
})
