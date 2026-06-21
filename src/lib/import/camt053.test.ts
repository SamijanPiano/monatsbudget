import { describe, it, expect } from 'vitest'
import { parseCamt053 } from './camt053'

// Minimaler CAMT.053-Auszug: ein DBIT (Ausgabe an REWE) und ein CRDT
// (Gehaltseingang vom Arbeitgeber). Für DBIT ist die Gegenpartei der Cdtr
// (Empfänger des Geldes), für CRDT der Dbtr (Zahler).
const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Ntry>
        <Amt Ccy="EUR">12.50</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-06-01</Dt></BookgDt>
        <ValDt><Dt>2026-06-02</Dt></ValDt>
        <NtryDtls>
          <TxDtls>
            <RltdPties>
              <Cdtr><Nm>REWE Markt GmbH</Nm></Cdtr>
              <Dbtr><Nm>Max Mustermann</Nm></Dbtr>
            </RltdPties>
            <RmtInf>
              <Ustrd>Einkauf Lebensmittel</Ustrd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">2500.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-06-15</Dt></BookgDt>
        <NtryDtls>
          <TxDtls>
            <RltdPties>
              <Cdtr><Nm>Max Mustermann</Nm></Cdtr>
              <Dbtr><Nm>Arbeitgeber AG</Nm></Dbtr>
            </RltdPties>
            <RmtInf>
              <Ustrd>Gehalt</Ustrd>
              <Ustrd>Juni 2026</Ustrd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`

describe('parseCamt053', () => {
  it('parst DBIT- und CRDT-Einträge in vorzeichenbehaftete Cent', () => {
    const result = parseCamt053(SAMPLE)
    expect(result).toHaveLength(2)

    const [ausgabe, einnahme] = result
    expect(ausgabe.amount).toBe(-1250)
    expect(einnahme.amount).toBe(250000)
  })

  it('nutzt das Buchungsdatum (BookgDt)', () => {
    const [ausgabe, einnahme] = parseCamt053(SAMPLE)
    expect(ausgabe.date).toBe('2026-06-01')
    expect(einnahme.date).toBe('2026-06-15')
  })

  it('wählt die Gegenpartei: DBIT → Cdtr-Name, CRDT → Dbtr-Name', () => {
    const [ausgabe, einnahme] = parseCamt053(SAMPLE)
    expect(ausgabe.counterparty).toBe('REWE Markt GmbH')
    expect(einnahme.counterparty).toBe('Arbeitgeber AG')
  })

  it('verbindet mehrere Ustrd-Zeilen zum Verwendungszweck', () => {
    const [ausgabe, einnahme] = parseCamt053(SAMPLE)
    expect(ausgabe.purpose).toBe('Einkauf Lebensmittel')
    expect(einnahme.purpose).toBe('Gehalt Juni 2026')
  })

  it('vergibt einen Hash je Buchung', () => {
    const result = parseCamt053(SAMPLE)
    expect(result[0].hash).toBeTruthy()
    expect(result[0].hash).not.toBe(result[1].hash)
  })

  it('fällt bei fehlendem BookgDt auf ValDt zurück und verträgt fehlendes RmtInf', () => {
    const xml = `<?xml version="1.0"?>
<Document>
  <BkToCstmrStmt><Stmt>
    <Ntry>
      <Amt Ccy="EUR">9.99</Amt>
      <CdtDbtInd>DBIT</CdtDbtInd>
      <ValDt><Dt>2026-07-03</Dt></ValDt>
      <NtryDtls><TxDtls>
        <RltdPties><Cdtr><Nm>Spotify</Nm></Cdtr></RltdPties>
      </TxDtls></NtryDtls>
    </Ntry>
  </Stmt></BkToCstmrStmt>
</Document>`
    const result = parseCamt053(xml)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-07-03')
    expect(result[0].amount).toBe(-999)
    expect(result[0].counterparty).toBe('Spotify')
    expect(result[0].purpose).toBe('')
  })

  it('überspringt Einträge ohne Betrag oder Datum', () => {
    const xml = `<?xml version="1.0"?>
<Document><BkToCstmrStmt><Stmt>
  <Ntry>
    <CdtDbtInd>DBIT</CdtDbtInd>
    <BookgDt><Dt>2026-07-03</Dt></BookgDt>
  </Ntry>
</Stmt></BkToCstmrStmt></Document>`
    expect(parseCamt053(xml)).toHaveLength(0)
  })
})
