// Parser für ISO-20022-CAMT.053-Kontoauszüge (Bank-to-Customer-Statement).
// Liest die Buchungs-Einträge (Ntry) und normalisiert sie auf
// ParsedTransaction (Cent, signed, YYYY-MM-DD). Defensiv: fehlende Felder
// werden zu '' bzw. der Eintrag wird nur bei fehlendem Betrag/Datum übersprungen.

import { XMLParser } from 'fast-xml-parser'
import type { ParsedTransaction } from './types'
import { transactionHash } from './dedup'

// fast-xml-parser liefert für ein einzelnes Kind ein Objekt, für mehrere ein
// Array. Diese Hilfe normalisiert beides auf ein Array (leer bei undefined).
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

// Liest verschachtelte Felder defensiv: gibt undefined zurück, sobald ein
// Zwischenschritt fehlt, statt zu werfen.
function get(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

// Wandelt einen Euro-Dezimalwert (z. B. "12.50") in ganze Cent. Der CAMT-Betrag
// ist immer unsigned mit '.' als Dezimaltrenner; das Vorzeichen kommt aus
// CdtDbtInd. Math.round vermeidet Float-Drift (12.50 * 100 = 1249.9999…).
function euroToCents(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null
  const n = Number.parseFloat(String(raw))
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

// Holt den Wert eines Amt-Knotens. fast-xml-parser legt den Textinhalt bei
// vorhandenem Attribut (Ccy) unter '#text' ab, sonst direkt als Primitive.
function readAmount(amt: unknown): number | null {
  if (amt !== null && typeof amt === 'object') {
    return euroToCents((amt as Record<string, unknown>)['#text'])
  }
  return euroToCents(amt)
}

// Setzt einen String zusammen (für Ustrd, das ein- oder mehrfach vorkommt).
function joinStrings(value: unknown): string {
  return toArray(value)
    .map((v) => (v === undefined || v === null ? '' : String(v).trim()))
    .filter((s) => s.length > 0)
    .join(' ')
}

// Liest den Namen der Gegenpartei. Bei DBIT (Geld geht raus) ist die
// Gegenpartei der Cdtr (Empfänger); bei CRDT (Geld kommt rein) der Dbtr (Zahler).
function readCounterparty(txDtls: unknown, isDebit: boolean): string {
  const party = isDebit
    ? get(txDtls, 'RltdPties', 'Cdtr')
    : get(txDtls, 'RltdPties', 'Dbtr')
  const name = get(party, 'Nm')
  return name === undefined || name === null ? '' : String(name).trim()
}

/**
 * Parst einen CAMT.053-XML-String zu ParsedTransaction[]. Iteriert über
 * Document > BkToCstmrStmt > Stmt > Ntry. Beträge in Cent (signed), Datum als
 * YYYY-MM-DD. Einträge ohne Betrag oder Datum werden ausgelassen.
 */
export function parseCamt053(xml: string): ParsedTransaction[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    // Namespaces (z. B. <ns:Ntry>) tolerieren, indem das Präfix entfernt wird.
    transformTagName: (tag) => tag.replace(/^.*:/, ''),
    trimValues: true,
  })

  let doc: unknown
  try {
    doc = parser.parse(xml)
  } catch {
    // Ungültiges XML → leeres Ergebnis statt Ausnahme an die UI.
    return []
  }

  const stmts = toArray(get(doc, 'Document', 'BkToCstmrStmt', 'Stmt'))
  const result: ParsedTransaction[] = []

  for (const stmt of stmts) {
    for (const entry of toArray(get(stmt, 'Ntry'))) {
      const amountCents = readAmount(get(entry, 'Amt'))
      // Datum: bevorzugt Buchungsdatum (BookgDt), sonst Wertstellung (ValDt).
      const dateRaw =
        get(entry, 'BookgDt', 'Dt') ?? get(entry, 'ValDt', 'Dt')
      const date = dateRaw === undefined || dateRaw === null ? '' : String(dateRaw).trim()

      // Betrag oder Datum fehlt → Eintrag überspringen.
      if (amountCents === null || date === '') continue

      const isDebit = String(get(entry, 'CdtDbtInd') ?? '').toUpperCase() === 'DBIT'
      const amount = isDebit ? -amountCents : amountCents

      // Detail-Knoten kann fehlen oder ein-/mehrfach vorkommen; ersten nehmen.
      const txDtls = toArray(get(entry, 'NtryDtls', 'TxDtls'))[0]
      const counterparty = txDtls ? readCounterparty(txDtls, isDebit) : ''
      const purpose = joinStrings(get(txDtls, 'RmtInf', 'Ustrd'))

      const base = { date, amount, counterparty, purpose }
      result.push({ ...base, hash: transactionHash(base) })
    }
  }

  return result
}
