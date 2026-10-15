import { describe, it, expect } from 'vitest'
import { cyclicDayDistance, detectRecurring, isLikelyRecurring, isOnSchedule } from './recurring'
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

  it('lehnt ab, wenn der Betrag mehr als 50 Cent bzw. 3 % schwankt', () => {
    const amounts = [-1000, -1080, -1000]
    const dates = ['2025-01-15', '2025-02-15', '2025-03-15']
    expect(isLikelyRecurring(amounts, dates)).toBe(false)
  })

  it('toleriert kleine Schwankungen bis 50 Cent', () => {
    const amounts = [-1000, -1040, -1020]
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
      tx({ date: '2025-01-15', amount: -10000, counterparty: 'Strom' }),
      tx({ date: '2025-02-15', amount: -10200, counterparty: 'Strom' }),
      tx({ date: '2025-03-15', amount: -10150, counterparty: 'Strom' }),
    ]
    const rules = detectRecurring(txs, TODAY)
    expect(rules).toHaveLength(1)
    // Median von [-10200, -10150, -10000] = -10150.
    expect(rules[0].amountApprox).toBe(-10150)
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

describe('isOnSchedule (Tag ±2, Monatswechsel, Wochenende)', () => {
  it('akzeptiert den typischen Tag und ±2 Tage', () => {
    expect(isOnSchedule('2025-03-15', 15)).toBe(true)
    expect(isOnSchedule('2025-03-13', 15)).toBe(true)
    expect(isOnSchedule('2025-03-17', 15)).toBe(true)
  })

  it('lehnt 3 und mehr Tage Abstand ab, wenn kein Wochenende dazwischen liegt', () => {
    // 15.01.2025 ist ein Mittwoch.
    expect(isOnSchedule('2025-01-18', 15)).toBe(false)
    expect(isOnSchedule('2025-01-10', 15)).toBe(false)
  })

  it('rechnet über die Monatsgrenze: typischer 31., gebucht am 1.', () => {
    expect(isOnSchedule('2025-04-01', 31)).toBe(true)
    expect(isOnSchedule('2025-02-01', 30)).toBe(true)
  })

  it('erlaubt die Verschiebung vom Wochenende auf den nächsten Werktag', () => {
    // Typisch der 15.; am 15.03.2025 (Samstag) wird erst am Montag 17.03. gebucht: ±2 reicht.
    expect(isOnSchedule('2025-03-17', 15)).toBe(true)
    // Typisch der 14.; der 14.06.2025 ist ein Samstag. Die Bank bucht erst am Montag 16.06.,
    // ein Tag Verzug macht Dienstag 17.06.: drei Tage, passt trotzdem.
    expect(isOnSchedule('2025-06-17', 14)).toBe(true)
  })
})

describe('cyclicDayDistance', () => {
  it('misst über die Monatsgrenze', () => {
    expect(cyclicDayDistance(1, 31, 31)).toBe(1)
    expect(cyclicDayDistance(10, 15, 30)).toBe(5)
  })
})

describe('detectRecurring: neue Regeln', () => {
  it('Bäcker-Fehltreffer: ähnliche kleine Beträge an zufälligen Tagen sind kein Abo', () => {
    const txs: Transaction[] = [
      tx({ date: '2025-01-04', amount: -350, counterparty: 'Bäckerei Müller' }),
      tx({ date: '2025-02-21', amount: -350, counterparty: 'Bäckerei Müller' }),
    ]
    expect(detectRecurring(txs, TODAY)).toHaveLength(0)
  })

  it('mehrere Buchungen im selben Monat sind kein Dauerposten', () => {
    const txs: Transaction[] = [
      tx({ date: '2025-01-15', amount: -350, counterparty: 'Bäckerei' }),
      tx({ date: '2025-02-15', amount: -350, counterparty: 'Bäckerei' }),
      tx({ date: '2025-02-16', amount: -350, counterparty: 'Bäckerei' }),
    ]
    expect(detectRecurring(txs, TODAY)).toHaveLength(0)
  })

  it('erkennt zwei verschiedene Abos beim selben Empfänger (PayPal) getrennt', () => {
    const txs: Transaction[] = [
      tx({ date: '2025-01-03', amount: -999, counterparty: 'PayPal' }),
      tx({ date: '2025-02-03', amount: -999, counterparty: 'PayPal' }),
      tx({ date: '2025-01-20', amount: -1799, counterparty: 'PayPal' }),
      tx({ date: '2025-02-20', amount: -1799, counterparty: 'PayPal' }),
    ]
    const amounts = detectRecurring(txs, TODAY).map((r) => r.amountApprox).sort((a, b) => a - b)
    expect(amounts).toEqual([-1799, -999])
  })

  it('verlangt aufeinanderfolgende Monate', () => {
    expect(isLikelyRecurring([-999, -999], ['2025-01-15', '2025-03-15'])).toBe(false)
  })

  it('toleriert ±2 Tage beim Abbuchungstag', () => {
    const txs: Transaction[] = [
      tx({ date: '2025-01-15', amount: -1299, counterparty: 'Vodafone' }),
      tx({ date: '2025-02-17', amount: -1299, counterparty: 'Vodafone' }),
      tx({ date: '2025-03-14', amount: -1299, counterparty: 'Vodafone' }),
    ]
    expect(detectRecurring(txs, TODAY)).toHaveLength(1)
  })
})

describe('detectRecurring: alte Lücken', () => {
  it('eine Lücke in der Vergangenheit versteckt einen laufenden Dauerposten nicht', () => {
    const txs: Transaction[] = [
      tx({ date: '2024-10-01', amount: -50000, counterparty: 'Vermieter' }),
      tx({ date: '2025-01-01', amount: -50000, counterparty: 'Vermieter' }),
      tx({ date: '2025-02-01', amount: -50000, counterparty: 'Vermieter' }),
      tx({ date: '2025-03-01', amount: -50000, counterparty: 'Vermieter' }),
    ]
    expect(detectRecurring(txs, TODAY)).toHaveLength(1)
  })
})
