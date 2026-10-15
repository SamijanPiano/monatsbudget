import { describe, expect, test } from 'vitest'
import { toParsed, pendingSummary, type BankTxn } from './sync'

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

  test('übernimmt die Bank-Referenz, wenn vorhanden', () => {
    expect(toParsed([row({ bankRef: 'REF-7' })])[0].bankRef).toBe('REF-7')
    expect(toParsed([row()])[0]).not.toHaveProperty('bankRef')
  })

  test('leere Eingabe → leeres Ergebnis', () => {
    expect(toParsed([])).toEqual([])
  })

  test('vorgemerkte Umsätze (pending) werden NICHT übernommen', () => {
    const out = toParsed([
      row({ status: 'booked' }),
      row({ status: 'pending', amount: -3000 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].amount).toBe(-1299)
  })

  test('fehlender Status zählt als gebucht (ältere Backends)', () => {
    expect(toParsed([row()])).toHaveLength(1)
  })
})

describe('pendingSummary (noch nicht abgebuchte Umsätze)', () => {
  test('summiert Anzahl und Betrag der vorgemerkten Umsätze', () => {
    const summary = pendingSummary([
      row({ status: 'booked' }),
      row({ status: 'pending', amount: -3000 }),
      row({ status: 'pending', amount: -999 }),
    ])
    expect(summary).toEqual({ count: 2, amountCents: -3999 })
  })

  test('ohne vorgemerkte Umsätze → 0/0', () => {
    expect(pendingSummary([row(), row({ status: 'booked' })])).toEqual({
      count: 0,
      amountCents: 0,
    })
  })
})
