import { describe, it, expect } from 'vitest'
import { parseCsv, detectPreset, DE_BANK_PRESETS } from './csv'

describe('parseCsv (Sparkasse-Stil)', () => {
  // Realistischer Sparkasse-CSV-CAMT-Export: ';'-getrennt, Komma-Dezimal,
  // DD.MM.YYYY, Felder in Anführungszeichen. Betrag bereits signed.
  const sample = [
    '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Betrag";"Waehrung"',
    '"DE12";"01.06.2026";"01.06.2026";"LASTSCHRIFT";"Einkauf Lebensmittel";"REWE Markt GmbH";"-12,50";"EUR"',
    '"DE12";"15.06.2026";"15.06.2026";"GUTSCHRIFT";"Gehalt Juni";"Arbeitgeber AG";"2.500,00";"EUR"',
  ].join('\n')

  it('parst Beträge in vorzeichenbehaftete Cent (deutsches Zahlenformat)', () => {
    const result = parseCsv(sample, DE_BANK_PRESETS.sparkasse)
    expect(result).toHaveLength(2)
    expect(result[0].amount).toBe(-1250)
    expect(result[1].amount).toBe(250000)
  })

  it('wandelt DD.MM.YYYY in YYYY-MM-DD', () => {
    const result = parseCsv(sample, DE_BANK_PRESETS.sparkasse)
    expect(result[0].date).toBe('2026-06-01')
    expect(result[1].date).toBe('2026-06-15')
  })

  it('übernimmt Gegenpartei und Verwendungszweck', () => {
    const result = parseCsv(sample, DE_BANK_PRESETS.sparkasse)
    expect(result[0].counterparty).toBe('REWE Markt GmbH')
    expect(result[0].purpose).toBe('Einkauf Lebensmittel')
  })

  it('vergibt einen Hash je Zeile', () => {
    const result = parseCsv(sample, DE_BANK_PRESETS.sparkasse)
    expect(result[0].hash).toBeTruthy()
    expect(result[0].hash).not.toBe(result[1].hash)
  })
})

describe('parseCsv — deutsches Zahlenformat', () => {
  const mapping = DE_BANK_PRESETS.generic

  it('liest "1.234,56" als 123456 Cent', () => {
    const csv = 'Datum;Betrag;Empfänger;Verwendungszweck\n03.07.2026;1.234,56;Foo;Bar'
    expect(parseCsv(csv, mapping)[0].amount).toBe(123456)
  })

  it('liest "-12,50" als -1250 Cent', () => {
    const csv = 'Datum;Betrag;Empfänger;Verwendungszweck\n03.07.2026;-12,50;Foo;Bar'
    expect(parseCsv(csv, mapping)[0].amount).toBe(-1250)
  })

  it('liest "−12,50" (Minuszeichen U+2212) als -1250 Cent', () => {
    const csv = 'Datum;Betrag;Empfänger;Verwendungszweck\n03.07.2026;−12,50;Foo;Bar'
    expect(parseCsv(csv, mapping)[0].amount).toBe(-1250)
  })
})

describe('parseCsv — getrennte Soll/Haben-Spalten', () => {
  it('kombiniert Debit (negativ) und Credit (positiv) zu signed Cent', () => {
    const mapping = {
      delimiter: ';',
      decimalComma: true,
      dateFormat: 'DD.MM.YYYY' as const,
      columns: {
        date: 'Datum',
        debit: 'Soll',
        credit: 'Haben',
        counterparty: 'Name',
        purpose: 'Zweck',
      },
    }
    const csv = [
      'Datum;Soll;Haben;Name;Zweck',
      '01.06.2026;12,50;;REWE;Einkauf',
      '15.06.2026;;2.500,00;Arbeitgeber;Gehalt',
    ].join('\n')
    const result = parseCsv(csv, mapping)
    expect(result[0].amount).toBe(-1250)
    expect(result[1].amount).toBe(250000)
  })
})

describe('parseCsv — Robustheit', () => {
  it('respektiert in Anführungszeichen eingebettete Trennzeichen', () => {
    const csv = [
      'Datum;Betrag;Empfänger;Verwendungszweck',
      '03.07.2026;-9,99;"Müller; Meier GmbH";"Rechnung 1; Pos 2"',
    ].join('\n')
    const result = parseCsv(csv, DE_BANK_PRESETS.generic)
    expect(result[0].counterparty).toBe('Müller; Meier GmbH')
    expect(result[0].purpose).toBe('Rechnung 1; Pos 2')
  })

  it('ignoriert leere Zeilen', () => {
    const csv = 'Datum;Betrag;Empfänger;Verwendungszweck\n\n03.07.2026;-1,00;Foo;Bar\n\n'
    expect(parseCsv(csv, DE_BANK_PRESETS.generic)).toHaveLength(1)
  })
})

describe('detectPreset', () => {
  it('erkennt eine Sparkasse-Kopfzeile', () => {
    const header =
      '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Betrag";"Waehrung"'
    expect(detectPreset(header)).toBe('sparkasse')
  })

  it('erkennt eine DKB-Kopfzeile', () => {
    const header = 'Buchungsdatum;Wertstellung;Status;Zahlungspflichtige*r;Zahlungsempfänger*in;Verwendungszweck;Umsatztyp;Betrag (€)'
    expect(detectPreset(header)).toBe('dkb')
  })

  it('gibt null zurück, wenn nichts passt', () => {
    expect(detectPreset('foo;bar;baz')).toBeNull()
  })
})

describe('DE_BANK_PRESETS', () => {
  it('enthält die erwarteten Presets', () => {
    expect(Object.keys(DE_BANK_PRESETS)).toEqual(
      expect.arrayContaining(['sparkasse', 'dkb', 'ing', 'comdirect', 'generic']),
    )
  })
})
