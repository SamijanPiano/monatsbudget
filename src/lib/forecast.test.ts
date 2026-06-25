import { describe, it, expect } from 'vitest'
import {
  monthKey,
  sumForMonth,
  expectedRemaining,
  disposableThisMonth,
  reichtEs,
  remainingDaysInMonth,
  dailyDisposable,
  averageMonthlyNet,
  projectSavings,
} from './forecast'
import type { Transaction, RecurringRule } from '../types/budget'

function tx(partial: Partial<Transaction> & { date: string; amount: number }): Transaction {
  return {
    id: `tx-${partial.date}-${partial.amount}`,
    counterparty: 'X',
    purpose: '',
    categoryId: null,
    accountId: 'acc-1',
    source: 'import',
    hash: `${partial.date}-${partial.amount}`,
    ...partial,
  }
}

function rule(partial: Partial<RecurringRule> & { counterparty: string; amountApprox: number; nextExpected: string }): RecurringRule {
  return {
    id: `rule-${partial.counterparty}`,
    cadence: 'monthly',
    categoryId: null,
    ...partial,
  }
}

describe('monthKey', () => {
  it('schneidet YYYY-MM aus dem Datum', () => {
    expect(monthKey('2025-04-10')).toBe('2025-04')
    expect(monthKey('2025-12-31')).toBe('2025-12')
  })
})

describe('sumForMonth', () => {
  const txs: Transaction[] = [
    tx({ date: '2025-04-01', amount: 250000 }), // Gehalt (Einnahme)
    tx({ date: '2025-04-05', amount: -1799 }), // Netflix (Ausgabe)
    tx({ date: '2025-04-09', amount: -5000 }), // Edeka (Ausgabe)
    tx({ date: '2025-03-31', amount: -9999 }), // anderer Monat -> ignorieren
  ]

  it('summiert Einnahmen und Ausgaben (Ausgaben als positiver Betrag)', () => {
    const r = sumForMonth(txs, '2025-04')
    expect(r.income).toBe(250000)
    expect(r.expenses).toBe(6799)
    expect(r.net).toBe(250000 - 6799)
  })

  it('ignoriert Buchungen anderer Monate', () => {
    const r = sumForMonth(txs, '2025-03')
    expect(r.income).toBe(0)
    expect(r.expenses).toBe(9999)
    expect(r.net).toBe(-9999)
  })
})

describe('expectedRemaining', () => {
  // Heute = 10. April. Tag-15-Posten stehen noch aus, Tag-5-Posten sind durch.
  const TODAY = new Date('2025-04-10T12:00:00Z')

  it('zählt nur ausstehende Ausflüsse nach heute, die noch nicht gebucht sind', () => {
    const recurring: RecurringRule[] = [
      rule({ counterparty: 'Netflix', amountApprox: -1799, nextExpected: '2025-04-15' }),
      rule({ counterparty: 'Miete', amountApprox: -80000, nextExpected: '2025-04-01' }), // Tag liegt vor heute
    ]
    const txs: Transaction[] = []
    // Netflix (Tag 15) steht noch aus, Miete (Tag 1) liegt vor heute -> nur Netflix zählt.
    expect(expectedRemaining(recurring, txs, '2025-04', TODAY)).toBe(1799)
  })

  it('schließt Posten aus, die diesen Monat bereits gebucht wurden (Match per Empfänger)', () => {
    const recurring: RecurringRule[] = [
      rule({ counterparty: 'Netflix', amountApprox: -1799, nextExpected: '2025-04-15' }),
    ]
    const txs: Transaction[] = [
      tx({ date: '2025-04-08', amount: -1799, counterparty: 'Netflix' }),
    ]
    // Bereits gebucht -> nicht mehr erwartet.
    expect(expectedRemaining(recurring, txs, '2025-04', TODAY)).toBe(0)
  })

  it('ignoriert Einnahmen (positive amountApprox)', () => {
    const recurring: RecurringRule[] = [
      rule({ counterparty: 'Gehalt', amountApprox: 250000, nextExpected: '2025-04-25' }),
      rule({ counterparty: 'Netflix', amountApprox: -1799, nextExpected: '2025-04-15' }),
    ]
    expect(expectedRemaining(recurring, [], '2025-04', TODAY)).toBe(1799)
  })

  it('summiert mehrere ausstehende Ausflüsse als positiven Gesamtbetrag', () => {
    const recurring: RecurringRule[] = [
      rule({ counterparty: 'Netflix', amountApprox: -1799, nextExpected: '2025-04-15' }),
      rule({ counterparty: 'Strom', amountApprox: -6000, nextExpected: '2025-04-20' }),
    ]
    expect(expectedRemaining(recurring, [], '2025-04', TODAY)).toBe(7799)
  })
})

describe('disposableThisMonth', () => {
  const TODAY = new Date('2025-04-10T12:00:00Z')

  it('berechnet balance − erwartete Restausgaben − geplantes Sparen', () => {
    const recurring: RecurringRule[] = [
      rule({ counterparty: 'Netflix', amountApprox: -1799, nextExpected: '2025-04-15' }),
    ]
    const result = disposableThisMonth({
      balance: 100000,
      recurring,
      txs: [],
      plannedSavings: 20000,
      monthKey: '2025-04',
      today: TODAY,
    })
    // 100000 − 1799 (erwartet) − 20000 (Sparen) = 78201
    expect(result).toBe(78201)
  })

  it('behandelt fehlendes plannedSavings als 0', () => {
    const result = disposableThisMonth({
      balance: 50000,
      recurring: [],
      txs: [],
      monthKey: '2025-04',
      today: TODAY,
    })
    expect(result).toBe(50000)
  })
})

describe('reichtEs', () => {
  const TODAY = new Date('2025-04-10T12:00:00Z')

  it('ok=true, wenn balance erwartete Restausgaben deckt (vor Sparen)', () => {
    const recurring: RecurringRule[] = [
      rule({ counterparty: 'Netflix', amountApprox: -1799, nextExpected: '2025-04-15' }),
    ]
    const r = reichtEs({
      balance: 100000,
      recurring,
      txs: [],
      plannedSavings: 99999, // Sparen darf das Ergebnis NICHT beeinflussen.
      monthKey: '2025-04',
      today: TODAY,
    })
    expect(r.ok).toBe(true)
    // diff = balance − expectedRemaining = 100000 − 1799 = 98201 (signed, positiv = Puffer)
    expect(r.diff).toBe(98201)
  })

  it('ok=false mit negativem diff, wenn die Restausgaben die balance übersteigen', () => {
    const recurring: RecurringRule[] = [
      rule({ counterparty: 'Miete', amountApprox: -80000, nextExpected: '2025-04-28' }),
      rule({ counterparty: 'Strom', amountApprox: -6000, nextExpected: '2025-04-20' }),
    ]
    const r = reichtEs({
      balance: 50000,
      recurring,
      txs: [],
      monthKey: '2025-04',
      today: TODAY,
    })
    expect(r.ok).toBe(false)
    // diff = 50000 − 86000 = -36000
    expect(r.diff).toBe(-36000)
  })
})

describe('remainingDaysInMonth', () => {
  it('zählt heute mit (15. eines 30-Tage-Monats -> 16)', () => {
    expect(remainingDaysInMonth(new Date('2025-04-15T12:00:00Z'))).toBe(16)
  })

  it('gibt 1 am letzten Tag des Monats', () => {
    expect(remainingDaysInMonth(new Date('2025-04-30T12:00:00Z'))).toBe(1)
  })

  it('berücksichtigt unterschiedliche Monatslängen (Januar -> 31)', () => {
    expect(remainingDaysInMonth(new Date('2025-01-01T12:00:00Z'))).toBe(31)
  })

  it('berücksichtigt Februar (28 Tage 2025)', () => {
    expect(remainingDaysInMonth(new Date('2025-02-20T12:00:00Z'))).toBe(9)
  })
})

describe('dailyDisposable', () => {
  it('verteilt das Verfügbare gleichmäßig auf die Resttage', () => {
    // balance 100000, keine Rest-Ausgaben, am 21. April (30 Tage) -> 10 Resttage.
    const result = dailyDisposable({
      balance: 100000,
      recurring: [],
      txs: [],
      monthKey: '2025-04',
      today: new Date('2025-04-21T12:00:00Z'),
    })
    expect(result).toBe(10000) // 100000 / 10
  })

  it('rundet auf ganze Cent', () => {
    // 10000 / 3 Resttage (29. April) = 3333.33 -> 3333
    const result = dailyDisposable({
      balance: 10000,
      recurring: [],
      txs: [],
      monthKey: '2025-04',
      today: new Date('2025-04-28T12:00:00Z'),
    })
    expect(result).toBe(3333)
  })

  it('gibt ein negatives Tagesbudget bei negativem Verfügbar', () => {
    const result = dailyDisposable({
      balance: -3000,
      recurring: [],
      txs: [],
      monthKey: '2025-04',
      today: new Date('2025-04-29T12:00:00Z'),
    })
    // -3000 / 2 Resttage = -1500
    expect(result).toBe(-1500)
  })
})

describe('averageMonthlyNet', () => {
  it('mittelt das Monats-Netto über den Verlauf', () => {
    expect(averageMonthlyNet([{ net: 20000 }, { net: 10000 }, { net: 0 }])).toBe(10000)
  })

  it('rundet auf ganze Cent', () => {
    expect(averageMonthlyNet([{ net: 10000 }, { net: 10001 }])).toBe(10001) // 10000.5 -> 10001
  })

  it('leerer Verlauf ergibt 0', () => {
    expect(averageMonthlyNet([])).toBe(0)
  })
})

describe('projectSavings', () => {
  it('projiziert die Gesamtersparnis bei gleichbleibendem Netto', () => {
    expect(projectSavings(15000, 6)).toBe(90000)
  })

  it('kann negativ sein (mehr Ausgaben als Einnahmen)', () => {
    expect(projectSavings(-5000, 3)).toBe(-15000)
  })

  it('0 oder negative Monate ergeben 0', () => {
    expect(projectSavings(15000, 0)).toBe(0)
    expect(projectSavings(15000, -2)).toBe(0)
  })
})
