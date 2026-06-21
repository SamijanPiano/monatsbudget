// CSV-Parser für deutsche Bank-Exporte. Wandelt Zeilen in ParsedTransaction
// (Cent, signed, YYYY-MM-DD). Robust gegen Anführungszeichen, eingebettete
// Trennzeichen und das deutsche Zahlenformat ("1.234,56", Minuszeichen U+2212).

import type { ParsedTransaction } from './types'
import { transactionHash } from './dedup'

/** Unterstützte Datumsformate der Spalten-Eingabe. */
export type CsvDateFormat = 'DD.MM.YYYY' | 'YYYY-MM-DD'

/** Zuordnung logischer Felder auf CSV-Spaltenüberschriften. */
export interface CsvColumns {
  date: string
  /** Eine vorzeichenbehaftete Betragsspalte … */
  amount?: string
  /** … oder getrennte Soll-/Haben-Spalten. */
  debit?: string
  credit?: string
  counterparty: string
  purpose: string
}

/** Vollständiges Mapping inkl. Parsing-Optionen. */
export interface CsvMapping {
  /** Spaltentrenner (DE-Standard: ';'). */
  delimiter: string
  /** true = deutsches Format "1.234,56"; false = "1234.56". */
  decimalComma: boolean
  /** Datumsformat der Eingabespalte. */
  dateFormat: CsvDateFormat
  columns: CsvColumns
}

// Zerlegt eine einzelne CSV-Zeile unter Beachtung von Anführungszeichen.
// Eingebettete Trennzeichen innerhalb von "…" bleiben erhalten, doppelte
// Anführungszeichen ("") werden zu einem literalen ".
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields.map((f) => f.trim())
}

// Wandelt einen Betrags-String in ganze Cent. Berücksichtigt deutsches Format
// (Punkt = Tausender, Komma = Dezimal) und das Unicode-Minus (U+2212).
function amountToCents(raw: string, decimalComma: boolean): number | null {
  if (raw === undefined || raw === null) return null
  let s = raw.trim().replace(/−/g, '-')
  if (s === '') return null
  // Nur Ziffern, Trenner und Vorzeichen behalten.
  s = s.replace(/[^\d.,-]/g, '')
  if (decimalComma) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    // Im Punkt-Format ggf. vorhandene Tausenderkommata entfernen.
    s = s.replace(/,/g, '')
  }
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

// Normalisiert ein Datum auf YYYY-MM-DD. Defensiv: bei unbekanntem Format ''.
function normalizeDate(raw: string, format: CsvDateFormat): string {
  const s = raw.trim()
  if (s === '') return ''
  if (format === 'DD.MM.YYYY') {
    const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
    if (!m) return ''
    const [, d, mo, y] = m
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // YYYY-MM-DD: bereits im Zielformat (führende Nullen sicherstellen).
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return ''
  const [, y, mo, d] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// Liest den signierten Betrag: entweder aus einer Betragsspalte oder aus
// getrennten Soll-(debit, negativ) / Haben-(credit, positiv) Spalten.
function readAmount(
  row: Record<string, string>,
  cols: CsvColumns,
  decimalComma: boolean,
): number | null {
  if (cols.amount) {
    return amountToCents(row[cols.amount] ?? '', decimalComma)
  }
  const debit = amountToCents(row[cols.debit ?? ''] ?? '', decimalComma)
  const credit = amountToCents(row[cols.credit ?? ''] ?? '', decimalComma)
  if (debit !== null && debit !== 0) return -Math.abs(debit)
  if (credit !== null && credit !== 0) return Math.abs(credit)
  return null
}

/**
 * Parst einen CSV-Text gemäß `mapping` zu ParsedTransaction[]. Die erste
 * nicht-leere Zeile gilt als Kopfzeile. Zeilen ohne gültigen Betrag oder ohne
 * Datum werden übersprungen.
 */
export function parseCsv(text: string, mapping: CsvMapping): ParsedTransaction[] {
  const { delimiter, decimalComma, dateFormat, columns } = mapping
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []

  const header = splitLine(lines[0], delimiter)
  const result: ParsedTransaction[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter)
    // Spaltennamen → Werte zuordnen.
    const row: Record<string, string> = {}
    header.forEach((name, idx) => {
      row[name] = cells[idx] ?? ''
    })

    const amount = readAmount(row, columns, decimalComma)
    const date = normalizeDate(row[columns.date] ?? '', dateFormat)
    if (amount === null || date === '') continue

    const base = {
      date,
      amount,
      counterparty: (row[columns.counterparty] ?? '').trim(),
      purpose: (row[columns.purpose] ?? '').trim(),
    }
    result.push({ ...base, hash: transactionHash(base) })
  }

  return result
}

// ─── Bank-Presets ────────────────────────────────────────────────────────────
// Spaltennamen aus typischen deutschen CSV-Exporten. Reihenfolge spielt keine
// Rolle — zugeordnet wird über die Kopfzeile.

export const DE_BANK_PRESETS: Record<string, CsvMapping> = {
  // Sparkasse CSV-CAMT: ';', Komma-Dezimal, DD.MM.YYYY, eine Betragsspalte.
  sparkasse: {
    delimiter: ';',
    decimalComma: true,
    dateFormat: 'DD.MM.YYYY',
    columns: {
      date: 'Buchungstag',
      amount: 'Betrag',
      counterparty: 'Beguenstigter/Zahlungspflichtiger',
      purpose: 'Verwendungszweck',
    },
  },
  // DKB (neuer Export): ';', Komma-Dezimal, DD.MM.YY, eine Betragsspalte (€).
  dkb: {
    delimiter: ';',
    decimalComma: true,
    dateFormat: 'DD.MM.YYYY',
    columns: {
      date: 'Buchungsdatum',
      amount: 'Betrag (€)',
      counterparty: 'Zahlungsempfänger*in',
      purpose: 'Verwendungszweck',
    },
  },
  // ING (Girokonto-Umsatzanzeige): ';', Komma-Dezimal, DD.MM.YYYY.
  ing: {
    delimiter: ';',
    decimalComma: true,
    dateFormat: 'DD.MM.YYYY',
    columns: {
      date: 'Buchung',
      amount: 'Betrag',
      counterparty: 'Auftraggeber/Empfänger',
      purpose: 'Verwendungszweck',
    },
  },
  // comdirect (Umsätze): ';', Komma-Dezimal, DD.MM.YYYY.
  comdirect: {
    delimiter: ';',
    decimalComma: true,
    dateFormat: 'DD.MM.YYYY',
    columns: {
      date: 'Buchungstag',
      amount: 'Umsatz in EUR',
      counterparty: 'Buchungstext',
      purpose: 'Vorgang',
    },
  },
  // Generisch: schlichte deutsche Spaltennamen als Fallback.
  generic: {
    delimiter: ';',
    decimalComma: true,
    dateFormat: 'DD.MM.YYYY',
    columns: {
      date: 'Datum',
      amount: 'Betrag',
      counterparty: 'Empfänger',
      purpose: 'Verwendungszweck',
    },
  },
}

// Charakteristische Kopfzeilen-Marker je Preset (alle müssen vorkommen).
const PRESET_SIGNATURES: Array<{ preset: string; markers: string[] }> = [
  {
    preset: 'sparkasse',
    markers: ['Auftragskonto', 'Beguenstigter/Zahlungspflichtiger', 'Buchungstag'],
  },
  {
    preset: 'dkb',
    markers: ['Buchungsdatum', 'Zahlungsempfänger*in', 'Betrag (€)'],
  },
  {
    preset: 'ing',
    markers: ['Buchung', 'Auftraggeber/Empfänger', 'Verwendungszweck'],
  },
  {
    preset: 'comdirect',
    markers: ['Umsatz in EUR', 'Buchungstag', 'Vorgang'],
  },
]

/**
 * Versucht, eine CSV-Kopfzeile einem bekannten Preset zuzuordnen. Liefert den
 * Preset-Schlüssel oder null, wenn keine Signatur passt.
 */
export function detectPreset(headerLine: string): string | null {
  // Anführungszeichen entfernen, damit Marker auch in "…" gefunden werden.
  const normalized = headerLine.replace(/"/g, '')
  for (const { preset, markers } of PRESET_SIGNATURES) {
    if (markers.every((m) => normalized.includes(m))) return preset
  }
  return null
}
