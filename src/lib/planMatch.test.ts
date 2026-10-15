import { describe, expect, test } from 'vitest'
import { actualsForPeriod, assignToPlan, salaryDates, type MatchInput } from './planMatch'
import type { Plan } from './plan'
import type { Category, RecurringRule, Transaction } from '../types/budget'

let n = 0
const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  date: '2026-10-20',
  amount: -1299,
  counterparty: 'REWE Markt',
  purpose: 'Einkauf',
  categoryId: null,
  accountId: 'acc',
  source: 'sync',
  hash: `h${n}`,
  ...over,
})

const cat = (id: string, label: string, kind: Category['kind']): Category => ({
  id,
  label,
  kind,
  budget: null,
  rules: [],
})

const plan = (): Plan => ({
  income: [{ id: 'gehalt', label: 'Gehalt', amount: 990, salary: true }],
  fixed: [
    { id: 'spotify', label: 'Spotify', amount: 10.99 },
    { id: 'handy', label: 'Handy', amount: 19.99 },
  ],
  variable: [
    { id: 'tanken', label: 'Tanken', amount: 80 },
    { id: 'taeglich', label: 'Täglicher Verbrauch', amount: 220, catchAll: true },
  ],
  savings: 300,
  balance: 0,
})

const categories = [
  cat('c-inc', 'Einkommen', 'income'),
  cat('c-tank', 'Tanken', 'variable'),
  cat('c-spar', 'Sparen', 'savings'),
  cat('c-umb', 'Umbuchung', 'transfer'),
]

function input(transactions: Transaction[], over: Partial<MatchInput> = {}): MatchInput {
  return { transactions, plan: plan(), categories, overrides: {}, recurring: [], ...over }
}

describe('assignToPlan', () => {
  test('feste Abzüge: Name im Empfänger und passender Betrag', () => {
    const t = tx({ counterparty: 'Spotify AB', amount: -1099 })
    expect(assignToPlan(input([t])).get(t.id)).toBe('spotify')
  })

  test('feste Abzüge: erkannter Dauerposten mit gleichem Betrag, auch ohne Namen', () => {
    const t = tx({ counterparty: 'Vodafone GmbH', amount: -1999 })
    const recurring: RecurringRule[] = [
      { id: 'r', counterparty: 'Vodafone GmbH', amountApprox: -1999, cadence: 'monthly', categoryId: null, nextExpected: '2026-11-20' },
    ]
    expect(assignToPlan(input([t], { recurring })).get(t.id)).toBe('handy')
  })

  test('gleicher Betrag ohne Dauerposten und ohne Namen ist kein fester Abzug', () => {
    const t = tx({ counterparty: 'Kiosk', amount: -1999 })
    expect(assignToPlan(input([t])).get(t.id)).toBe('taeglich')
  })

  test('variable Posten über den Kategorienamen', () => {
    const t = tx({ counterparty: 'Aral', amount: -6000, categoryId: 'c-tank' })
    expect(assignToPlan(input([t])).get(t.id)).toBe('tanken')
  })

  test('Einnahmen: Gehalt per Kategorie, sonstige Eingänge getrennt', () => {
    const lohn = tx({ counterparty: 'Arbeitgeber AG', amount: 99000, categoryId: 'c-inc' })
    const erstattung = tx({ counterparty: 'Amazon', amount: 1500 })
    const map = assignToPlan(input([lohn, erstattung]))
    expect(map.get(lohn.id)).toBe('gehalt')
    expect(map.get(erstattung.id)).toBe('other-income')
  })

  test('Sparen und Umbuchungen', () => {
    const spar = tx({ amount: -30000, categoryId: 'c-spar' })
    const umb = tx({ amount: -5000, categoryId: 'c-umb' })
    const map = assignToPlan(input([spar, umb]))
    expect(map.get(spar.id)).toBe('savings')
    expect(map.get(umb.id)).toBe('excluded')
  })

  test('Rest landet im Sammelposten', () => {
    const t = tx()
    expect(assignToPlan(input([t])).get(t.id)).toBe('taeglich')
  })

  test('ohne Sammelposten: nicht zugeordnet', () => {
    const p = plan()
    const t = tx()
    const withoutCatchAll = { ...p, variable: p.variable.filter((i) => !i.catchAll) }
    expect(assignToPlan(input([t], { plan: withoutCatchAll })).get(t.id)).toBe('unassigned')
  })

  test('gelernter Empfänger schlägt alle Automatik-Regeln', () => {
    const p = plan()
    const learned = { ...p, variable: p.variable.map((i) => (i.id === 'tanken' ? { ...i, counterparties: ['rewe markt'] } : i)) }
    const t = tx()
    expect(assignToPlan(input([t], { plan: learned })).get(t.id)).toBe('tanken')
  })

  test('manuelle Verschiebung schlägt alles, verwaiste Verschiebung wird ignoriert', () => {
    const a = tx({ counterparty: 'Spotify AB', amount: -1099 })
    const b = tx()
    const map = assignToPlan(input([a, b], { overrides: { [a.id]: 'excluded', [b.id]: 'geloeschter-posten' } }))
    expect(map.get(a.id)).toBe('excluded')
    expect(map.get(b.id)).toBe('taeglich')
  })
})

describe('actualsForPeriod und salaryDates', () => {
  test('summiert je Posten nur Buchungen der Periode, Ausgaben positiv', () => {
    const inside = tx({ date: '2026-10-20', amount: -1000 })
    const refund = tx({ date: '2026-10-21', amount: 200, counterparty: 'REWE Markt' })
    const outside = tx({ date: '2026-10-10', amount: -5000 })
    const p = plan()
    const learned = { ...p, variable: p.variable.map((i) => (i.catchAll ? { ...i, counterparties: ['rewe markt'] } : i)) }
    const data = input([inside, refund, outside], { plan: learned })
    const actuals = actualsForPeriod(data, assignToPlan(data), { start: '2026-10-15', end: '2026-11-14' })
    expect(actuals.byTarget.taeglich.cents).toBe(800)
    expect(actuals.byTarget.taeglich.transactions.map((t) => t.id)).toEqual([refund.id, inside.id])
  })

  test('Einnahmen zählen positiv', () => {
    const lohn = tx({ date: '2026-10-15', amount: 99000, categoryId: 'c-inc' })
    const data = input([lohn])
    const actuals = actualsForPeriod(data, assignToPlan(data), { start: '2026-10-15', end: '2026-11-14' })
    expect(actuals.byTarget.gehalt.cents).toBe(99000)
  })

  test('salaryDates: Eingänge des Gehaltspostens', () => {
    const lohn = tx({ date: '2026-10-13', amount: 99000, categoryId: 'c-inc' })
    const data = input([lohn, tx()])
    expect(salaryDates(data, assignToPlan(data))).toEqual(['2026-10-13'])
  })

  test('kleine Gehalts-Eingänge verschieben den Periodenstart nicht', () => {
    const erstattung = tx({ date: '2026-10-10', amount: 500, categoryId: 'c-inc' })
    const lohn = tx({ date: '2026-10-15', amount: 99000, categoryId: 'c-inc' })
    const data = input([erstattung, lohn])
    expect(salaryDates(data, assignToPlan(data))).toEqual(['2026-10-15'])
  })

  test('Erstattung mit Ausgaben-Kategorie wird mit dem Posten verrechnet', () => {
    const tanken = tx({ date: '2026-10-20', amount: -6000, categoryId: 'c-tank' })
    const erstattung = tx({ date: '2026-10-21', amount: 1000, categoryId: 'c-tank' })
    const data = input([tanken, erstattung])
    const actuals = actualsForPeriod(data, assignToPlan(data), { start: '2026-10-15', end: '2026-11-14' })
    expect(actuals.byTarget.tanken.cents).toBe(5000)
  })

  test('leerer gelernter Empfänger bindet keine Buchungen', () => {
    const p = plan()
    const broken = { ...p, variable: p.variable.map((i) => (i.id === 'tanken' ? { ...i, counterparties: [''] } : i)) }
    const t = tx({ counterparty: '' })
    expect(assignToPlan(input([t], { plan: broken })).get(t.id)).toBe('taeglich')
  })

  test('Nebenjob-Lohn am 10. verschiebt den Periodenstart nicht, der größte Eingang zählt', () => {
    const nebenjob = tx({ date: '2026-07-10', amount: 65781, categoryId: 'c-inc', counterparty: 'flaschenpost' })
    const lohn = tx({ date: '2026-07-15', amount: 113734, categoryId: 'c-inc', counterparty: 'One Solution' })
    const data = input([nebenjob, lohn])
    expect(salaryDates(data, assignToPlan(data))).toEqual(['2026-07-15'])
  })

  test('gelerntes Sparen: Überweisungen an sich selbst landen künftig bei Sparen', () => {
    const t = tx({ counterparty: 'Sempf Samuel', amount: -35000, categoryId: null })
    const learned = { ...plan(), learnedSpecial: { 'sempf samuel': 'savings' } }
    expect(assignToPlan(input([t], { plan: learned })).get(t.id)).toBe('savings')
  })
})

