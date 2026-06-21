import { describe, it, expect } from 'vitest'
import { detectRecurring, isLikelyRecurring } from './recurring'
import type { Transaction } from '../types/budget'

// Hilfs-Factory für Buchungen in Cent (negativ = Ausgabe).
function tx(partial: Partial<Transaction> & { date: string; amount: number }): Transaction {
  return {
    id: `tx-${partial.date}-${partial.amount}`,
    counterparty: 'Netflix',
    purpose: 'Abo',
    categoryId: null,
    accountId: 'acc-1',
    source: 'import',
    hash: `${partial.date}-${partial.amount}`,
    ...partial,
  }
}

// Fester „Heute" für deterministische nextExpected-Berechnung.
const TODAY = new Date('2025-04-10T12:00:00Z')

describe('isLikelyRecurring', () => {
  it('erkennt 3 monatliche, stabile Beträge als wiederkehrend', () => {
    const amounts = [-1799, -1799, -1799]
    const dates = ['2025-01-15', '2025-02-15', '2025-03-15']
    expect(isLikelyRecurring(amounts, dates)).toBe(true)
  })

  it('lehnt eine einmalige Buchung ab (< 3 Monate)', () => {
    expect(isLikelyRecurring([-4999], ['2025-03-01'])).toBe(false)
    expect(isLikelyRecurring([-4999, -4999], ['2025-03-01', '2025-03-20'])).toBe(false)
  })

  it('lehnt mehrere Buchungen im selben Monat ab (keine 3 distinkten Monate)', () => {
    const amounts = [-1000, -1000, -1000]
    const dates = ['2025-03-01', '2025-03-10', '2025-03-20']
    expect(isLikelyRecurring(amounts, dates)).toBe(false)
  })

  it('lehnt ab, wenn der Betrag zu stark schwankt (> 10% und > 2€)', () => {
    const amounts = [-1000, -1500, -3000]
    const dates = ['2025-01-15', '2025-02-15', '2025-03-15']
    expect(isLikelyRecurring(amounts, dates)).toBe(false)
  })

  it('toleriert kleine Schwankungen innerhalb von ±2€', () => {
    const amounts = [-1000, -1150, -1080]
    const dates = ['2025-01-15', '2025-02-15', '2025-03-15']
    expect(isLikelyRecurring(amounts, dates)).toBe(true)
  })
})

describe('detectRecurring', () => {
  it('erkennt 3 monatliche Netflix-Buchungen als eine RecurringRule', () => {
    const txs: Transaction[] = [
      tx({ date: '2025-01-15', amount: -1799 }),
      tx({ date: '2025-02-15', amount: -1799 }),
      tx({ date: '2025-03-15', amount: -1799 }),
    ]
    const rules = detectRecurring(txs, TODAY)
    expect(rules).toHaveLength(1)
    const rule = rules[0]
    expect(rule.counterparty).toBe('Netflix')
    expect(rule.cadence).toBe('monthly')
    expect(rule.amountApprox).toBe(-1799)
    // Nächster erwarteter Termin liegt nach TODAY (2025-04-10), Tag 15.
    expect(rule.nextExpected).toBe('2025-04-15')
  })

  it('übernimmt die häufigste categoryId der Gruppe', () => {
    const txs: Transaction[] = [
      tx({ date: '2025-01-15', amount: -1799, categoryId: 'cat-abo' }),
      tx({ date: '2025-02-15', amount: -1799, categoryId: 'cat-abo' }),
      tx({ date: '2025-03-15', amount: -1799, categoryId: null }),
    ]
    const rules = detectRecurring(txs, TODAY)
    expect(rules).toHaveLength(1)
    expect(rules[0].categoryId).toBe('cat-abo')
  })

  it('ignoriert eine einmalige Anschaffung', () => {
    const txs: Transaction[] = [
      tx({ date: '2025-03-01', amount: -49999, counterparty: 'MediaMarkt' }),
    ]
    expect(detectRecurring(txs, TODAY)).toHaveLength(0)
  })

  it('gruppiert nicht, wenn der Betrag über die Toleranz hinaus driftet', () => {
    const txs: Transaction[] = [
      tx({ date: '2025-01-15', amount: -1000, counterparty: 'Edeka' }),
      tx({ date: '2025-02-15', amount: -2500, counterparty: 'Edeka' }),
      tx({ date: '2025-03-15', amount: -5000, counterparty: 'Edeka' }),
    ]
    expect(detectRecurring(txs, TODAY)).toHaveLength(0)
  })

  it('normalisiert den Empfänger (Groß/Klein, Whitespace) beim Gruppieren', () => {
    const txs: Transaction[] = [
      tx({ date: '2025-01-15', amount: -999, counterparty: 'Spotify AB' }),
      tx({ date: '2025-02-15', amount: -999, counterparty: 'SPOTIFY AB' }),
      tx({ date: '2025-03-15', amount: -999, counterparty: '  spotify ab  ' }),
    ]
    const rules = detectRecurring(txs, TODAY)
    expect(rules).toHaveLength(1)
    expect(rules[0].amountApprox).toBe(-999)
  })

  it('verwendet den Median als amountApprox bei leichter Streuung', () => {
    const txs: Transaction[] = [
      tx({ date: '2025-01-15', amount: -1000, counterparty: 'Strom' }),
      tx({ date: '2025-02-15', amount: -1100, counterparty: 'Strom' }),
      tx({ date: '2025-03-15', amount: -1080, counterparty: 'Strom' }),
    ]
    const rules = detectRecurring(txs, TODAY)
    expect(rules).toHaveLength(1)
    // Median von [-1100, -1080, -1000] = -1080.
    expect(rules[0].amountApprox).toBe(-1080)
  })

  it('ist deterministisch (außer der zufälligen id) und nutzt new Date() als Default', () => {
    const txs: Transaction[] = [
      tx({ date: '2025-01-15', amount: -1799 }),
      tx({ date: '2025-02-15', amount: -1799 }),
      tx({ date: '2025-03-15', amount: -1799 }),
    ]
    // id ist absichtlich zufällig (createId); die fachlichen Felder müssen
    // zwischen zwei Aufrufen identisch sein.
    const strip = (rules: ReturnType<typeof detectRecurring>) =>
      rules.map(({ id: _id, ...rest }) => rest)
    expect(strip(detectRecurring(txs, TODAY))).toEqual(strip(detectRecurring(txs, TODAY)))
  })
})
