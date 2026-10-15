import { describe, expect, test } from 'vitest'
import { findDuplicateCandidates, pairKey } from './duplicates'
import type { Transaction } from '../types/budget'

let n = 0
const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  date: '2026-10-01',
  amount: -1299,
  counterparty: 'REWE Markt',
  purpose: 'Einkauf',
  categoryId: null,
  accountId: 'acc',
  source: 'sync',
  hash: `h${n}`,
  ...over,
})

describe('findDuplicateCandidates', () => {
  test('findet Vormerkung + spätere Buchung (gleicher Betrag/Empfänger, 2 Tage später)', () => {
    const pending = tx({ date: '2026-10-01', purpose: 'Vormerkung' })
    const booked = tx({ date: '2026-10-03', purpose: 'Kartenzahlung' })
    const pairs = findDuplicateCandidates([pending, booked])
    expect(pairs).toHaveLength(1)
    // Die ältere Fassung (zuerst importiert) wird zum Löschen vorgeschlagen.
    expect(pairs[0].remove.id).toBe(pending.id)
    expect(pairs[0].keep.id).toBe(booked.id)
  })

  test('ignoriert verschiedene Beträge, Empfänger oder mehr als 5 Tage Abstand', () => {
    const a = tx()
    expect(findDuplicateCandidates([a, tx({ amount: -1300 })])).toEqual([])
    expect(findDuplicateCandidates([a, tx({ counterparty: 'Lidl' })])).toEqual([])
    expect(findDuplicateCandidates([a, tx({ date: '2026-10-07' })])).toEqual([])
  })

  test('gleiche Bank-Referenz ist immer ein Duplikat, verschiedene nie', () => {
    const a = tx({ bankRef: 'R1' })
    expect(findDuplicateCandidates([a, tx({ bankRef: 'R1', date: '2026-10-20' })])).toHaveLength(1)
    expect(findDuplicateCandidates([a, tx({ bankRef: 'R2' })])).toEqual([])
  })

  test('manuelle Einträge werden nie vorgeschlagen', () => {
    expect(findDuplicateCandidates([tx({ source: 'manual' }), tx()])).toEqual([])
  })

  test('jede Buchung steckt höchstens in einem Paar', () => {
    const pairs = findDuplicateCandidates([tx(), tx(), tx()])
    expect(pairs).toHaveLength(1)
  })

  test('als „kein Duplikat" markierte Paare tauchen nicht mehr auf', () => {
    const a = tx()
    const b = tx()
    expect(findDuplicateCandidates([a, b], [pairKey(a.id, b.id)])).toEqual([])
  })

  test('pairKey ist unabhängig von der Reihenfolge', () => {
    expect(pairKey('x', 'y')).toBe(pairKey('y', 'x'))
  })
})
