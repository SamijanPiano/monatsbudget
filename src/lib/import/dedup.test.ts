import { describe, it, expect } from 'vitest'
import { transactionHash, mergeNew } from './dedup'
import type { ParsedTransaction } from './types'

// Hilfsfunktion: erzeugt eine ParsedTransaction mit korrektem Hash.
function tx(over: Partial<Omit<ParsedTransaction, 'hash'>> = {}): ParsedTransaction {
  const base = {
    date: '2026-06-01',
    amount: -1250,
    counterparty: 'REWE',
    purpose: 'Einkauf',
    ...over,
  }
  return { ...base, hash: transactionHash(base) }
}

describe('transactionHash', () => {
  it('liefert für gleiche Eingaben denselben Hash (deterministisch)', () => {
    const input = { date: '2026-06-01', amount: -1250, counterparty: 'REWE', purpose: 'Einkauf' }
    expect(transactionHash(input)).toBe(transactionHash({ ...input }))
  })

  it('liefert für unterschiedliche Beträge unterschiedliche Hashes', () => {
    const a = transactionHash({ date: '2026-06-01', amount: -1250, counterparty: 'REWE', purpose: 'X' })
    const b = transactionHash({ date: '2026-06-01', amount: -1251, counterparty: 'REWE', purpose: 'X' })
    expect(a).not.toBe(b)
  })

  it('liefert für unterschiedliche Datümer unterschiedliche Hashes', () => {
    const a = transactionHash({ date: '2026-06-01', amount: -1250, counterparty: 'REWE', purpose: 'X' })
    const b = transactionHash({ date: '2026-06-02', amount: -1250, counterparty: 'REWE', purpose: 'X' })
    expect(a).not.toBe(b)
  })

  it('normalisiert Groß-/Kleinschreibung und Leerraum der Textfelder', () => {
    const a = transactionHash({ date: '2026-06-01', amount: -1250, counterparty: 'REWE ', purpose: ' Einkauf' })
    const b = transactionHash({ date: '2026-06-01', amount: -1250, counterparty: 'rewe', purpose: 'einkauf' })
    expect(a).toBe(b)
  })

  it('ist eine nicht-leere, kompakte Zeichenkette', () => {
    const h = transactionHash({ date: '2026-06-01', amount: -1250, counterparty: 'REWE', purpose: 'X' })
    expect(typeof h).toBe('string')
    expect(h.length).toBeGreaterThan(0)
    expect(h).not.toContain(' ')
  })
})

describe('mergeNew', () => {
  it('gibt nur Buchungen zurück, deren Hash noch nicht existiert', () => {
    const existing = tx({ purpose: 'Alt' })
    const fresh = tx({ purpose: 'Neu' })
    const result = mergeNew(new Set([existing.hash]), [existing, fresh])
    expect(result).toEqual([fresh])
  })

  it('akzeptiert auch ein Array statt eines Sets als Bestand', () => {
    const existing = tx({ purpose: 'Alt' })
    const fresh = tx({ purpose: 'Neu' })
    const result = mergeNew([existing.hash], [existing, fresh])
    expect(result).toEqual([fresh])
  })

  it('entfernt Duplikate innerhalb des eingehenden Batches', () => {
    const a = tx({ purpose: 'Doppelt' })
    const duplicate = tx({ purpose: 'Doppelt' })
    const result = mergeNew(new Set<string>(), [a, duplicate])
    expect(result).toHaveLength(1)
    expect(result[0].hash).toBe(a.hash)
  })

  it('ist idempotent: derselbe Batch zweimal importiert ergibt einmal die Neuen, dann keine', () => {
    const batch = [tx({ purpose: 'A' }), tx({ purpose: 'B' })]
    const known = new Set<string>()

    const first = mergeNew(known, batch)
    expect(first).toHaveLength(2)
    first.forEach((t) => known.add(t.hash))

    const second = mergeNew(known, batch)
    expect(second).toHaveLength(0)
  })
})
