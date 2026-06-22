import { describe, expect, test } from 'vitest'
import { toParsed, type BankTxn } from './sync'

const row = (over: Partial<BankTxn> = {}): BankTxn => ({
  date: '2026-06-01',
  amount: -1299,
  counterparty: 'REWE',
  purpose: 'Einkauf',
  ...over,
})

describe('toParsed (Bank-Sync → Import-Pipeline)', () => {
  test('übernimmt Felder und vergibt einen Dedup-Hash', () => {
    const out = toParsed([row()])
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-06-01')
    expect(out[0].amount).toBe(-1299)
    expect(out[0].counterparty).toBe('REWE')
    expect(out[0].hash).toBeTruthy()
  })

  test('gleiche Buchung → gleicher Hash (idempotenter Sync)', () => {
    const [a] = toParsed([row()])
    const [b] = toParsed([row()])
    expect(a.hash).toBe(b.hash)
  })

  test('rundet Beträge auf ganze Cent', () => {
    expect(toParsed([row({ amount: -1299.4 })])[0].amount).toBe(-1299)
  })

  test('fehlende Texte → leere Strings', () => {
    const out = toParsed([{ date: '2026-06-02', amount: 100, counterparty: undefined as unknown as string, purpose: undefined as unknown as string }])
    expect(out[0].counterparty).toBe('')
    expect(out[0].purpose).toBe('')
  })

  test('leere Eingabe → leeres Ergebnis', () => {
    expect(toParsed([])).toEqual([])
  })
})
