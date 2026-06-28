import { describe, expect, test } from 'vitest'
import type { BudgetState, Category, Month } from '../types/budget'
import { migrateBudgetState } from './migrate'

const emptyMonth = (id: string): Month => ({
  id, income: [], fixed: [], variable: [],
  savingsKonto: 0, savingsBar: 0, currentKonto: 0, currentBar: 0,
})

describe('migrateBudgetState v1 -> v2', () => {
  test('frischer/leerer Bestand: onboarded false, cash aus', () => {
    const v1 = { months: { '2026-06': emptyMonth('2026-06') }, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 0 } }
    const out = migrateBudgetState(v1, 1)
    expect(out.profile.onboarded).toBe(false)
    expect(out.profile.cashEnabled).toBe(false)
    expect(out.profile.goals).toEqual([])
  })

  test('Bestand mit Werten: onboarded true (kein Wizard für Bestand)', () => {
    const m = { ...emptyMonth('2026-06'), income: [{ id: 'i', label: 'Gehalt', konto: 2000, bar: 0 }] }
    const out = migrateBudgetState({ months: { '2026-06': m }, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 0 } }, 1)
    expect(out.profile.onboarded).toBe(true)
    expect(out.profile.cashEnabled).toBe(false)
  })

  test('Bar-Werte vorhanden: cashEnabled true', () => {
    const m = { ...emptyMonth('2026-06'), income: [{ id: 'i', label: 'Bar', konto: 0, bar: 300 }] }
    const out = migrateBudgetState({ months: { '2026-06': m }, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 0 } }, 1)
    expect(out.profile.cashEnabled).toBe(true)
    expect(out.profile.onboarded).toBe(true)
  })

  test('altes savingsGoal wird zu buffer-Goal', () => {
    const out = migrateBudgetState({ months: { '2026-06': emptyMonth('2026-06') }, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 5000 } }, 1)
    expect(out.profile.goals).toHaveLength(1)
    expect(out.profile.goals[0].type).toBe('buffer')
    expect(out.profile.goals[0].targetAmount).toBe(5000)
  })

  test('v2 mit profile: profile bleibt erhalten (kein Überschreiben)', () => {
    const v2 = { months: {}, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 0 }, profile: { onboarded: true, cashEnabled: true, goals: [] } }
    const out = migrateBudgetState(v2, 2)
    expect(out.profile).toEqual({ onboarded: true, cashEnabled: true, goals: [] })
  })
})

const v2Base = (
  months: Record<string, Month>,
  profilePatch: Record<string, unknown> = {},
) => ({
  months,
  activeMonthId: Object.keys(months)[0] ?? '2026-06',
  settings: { currency: '€', locale: 'de-DE', savingsGoal: 0 },
  profile: { onboarded: true, cashEnabled: false, goals: [], ...profilePatch },
})

describe('migrateBudgetState v2 -> v3 (Transaktions-Schicht)', () => {
  test('ergänzt leere Transaktions-Schicht', () => {
    const out = migrateBudgetState(v2Base({ '2026-06': emptyMonth('2026-06') }), 2)
    expect(out.transactions).toEqual([])
    expect(out.recurringRules).toEqual([])
    expect(Array.isArray(out.categories)).toBe(true)
    expect(Array.isArray(out.accounts)).toBe(true)
  })

  test('legt mindestens ein Giro-Konto an', () => {
    const out = migrateBudgetState(v2Base({ '2026-06': emptyMonth('2026-06') }), 2)
    expect(out.accounts.some((a) => a.type === 'checking')).toBe(true)
  })

  test('cashEnabled -> Bar-Konto vorhanden', () => {
    const out = migrateBudgetState(v2Base({ '2026-06': emptyMonth('2026-06') }, { cashEnabled: true }), 2)
    expect(out.accounts.some((a) => a.type === 'cash')).toBe(true)
  })

  test('ohne Bargeld -> kein Bar-Konto', () => {
    const out = migrateBudgetState(v2Base({ '2026-06': emptyMonth('2026-06') }), 2)
    expect(out.accounts.some((a) => a.type === 'cash')).toBe(false)
  })

  test('Bestands-Posten werden zu Kategorien (richtige Art, Budget in Cent)', () => {
    const m = {
      ...emptyMonth('2026-06'),
      income: [{ id: 'i', label: 'Gehalt', konto: 2000, bar: 0 }],
      fixed: [{ id: 'f', label: 'Handy', konto: 30, bar: 0 }],
      variable: [{ id: 'v', label: 'Lebensmittel', konto: 300, bar: 0 }],
    }
    const out = migrateBudgetState(v2Base({ '2026-06': m }), 2)
    const gehalt = out.categories.find((c) => c.label === 'Gehalt')
    const handy = out.categories.find((c) => c.label === 'Handy')
    const lm = out.categories.find((c) => c.label === 'Lebensmittel')
    expect(gehalt?.kind).toBe('income')
    expect(handy?.kind).toBe('fixed')
    expect(handy?.budget).toBe(3000) // 30 € -> 3000 Cent
    expect(lm?.kind).toBe('variable')
    expect(lm?.budget).toBe(30000)
  })

  test('gleicher Posten in mehreren Monaten: neuester Monat bestimmt das Budget', () => {
    const older = { ...emptyMonth('2026-05'), fixed: [{ id: 'a', label: 'Handy', konto: 30, bar: 0 }] }
    const newer = { ...emptyMonth('2026-06'), fixed: [{ id: 'b', label: 'Handy', konto: 40, bar: 0 }] }
    const out = migrateBudgetState(v2Base({ '2026-05': older, '2026-06': newer }), 2)
    const handy = out.categories.filter((c) => c.label === 'Handy')
    expect(handy).toHaveLength(1)
    expect(handy[0].budget).toBe(4000)
  })

  test('erhält Monate, Profil und Ziele', () => {
    const months = { '2026-06': emptyMonth('2026-06') }
    const goal = { id: 'g', type: 'save', label: 'X', targetAmount: 1000, currentAmount: 0, createdAt: 'now' }
    const out = migrateBudgetState(v2Base(months, { goals: [goal] }), 2)
    expect(out.months).toEqual(months)
    expect(out.profile.goals).toHaveLength(1)
  })

  test('v1 -> v3 in einem Schritt', () => {
    const v1 = { months: { '2026-06': emptyMonth('2026-06') }, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 0 } }
    const out = migrateBudgetState(v1, 1)
    expect(out.profile).toBeDefined()
    expect(out.categories).toBeDefined()
    expect(out.transactions).toEqual([])
  })

  test('v1 -> v3 ergänzt auch die Vertrags-Schicht (v4)', () => {
    const v1 = { months: { '2026-06': emptyMonth('2026-06') }, activeMonthId: '2026-06', settings: { currency: '€', locale: 'de-DE', savingsGoal: 0 } }
    const out = migrateBudgetState(v1, 1)
    expect(out.contracts).toEqual([])
  })
})

const v3Base = () => ({
  ...v2Base({ '2026-06': emptyMonth('2026-06') }),
  transactions: [],
  categories: [],
  accounts: [
    { id: 'a-check', name: 'Konto', type: 'checking' as const, balance: null },
    { id: 'a-cash', name: 'Bargeld', type: 'cash' as const, balance: null },
  ],
  recurringRules: [],
})

describe('migrateBudgetState v3 -> v4 (Vertrags-Schicht)', () => {
  test('ergänzt leere contracts-Liste', () => {
    const out = migrateBudgetState(v3Base(), 3)
    expect(out.contracts).toEqual([])
  })

  test('leitet Account-Felder defensiv ab (manual/isLiability)', () => {
    const out = migrateBudgetState(v3Base(), 3)
    const check = out.accounts.find((a) => a.id === 'a-check')
    const cash = out.accounts.find((a) => a.id === 'a-cash')
    // Giro = gesynct → nicht manuell, keine Schuld.
    expect(check?.manual).toBe(false)
    expect(check?.isLiability).toBe(false)
    // Bargeld = manuell, keine Schuld.
    expect(cash?.manual).toBe(true)
    expect(cash?.isLiability).toBe(false)
  })

  test('Kreditkarte wird als Schuld markiert', () => {
    const state = {
      ...v3Base(),
      accounts: [{ id: 'cc', name: 'Visa', type: 'credit' as const, balance: -5000 }],
    }
    const out = migrateBudgetState(state, 3)
    const cc = out.accounts.find((a) => a.id === 'cc')
    expect(cc?.isLiability).toBe(true)
    expect(cc?.manual).toBe(true)
  })

  test('respektiert bereits gesetzte Account-Felder (kein Überschreiben)', () => {
    const state = {
      ...v3Base(),
      accounts: [{ id: 'x', name: 'Sparkonto', type: 'checking' as const, balance: 100, manual: true, isLiability: false }],
    }
    const out = migrateBudgetState(state, 3)
    const x = out.accounts.find((a) => a.id === 'x')
    expect(x?.manual).toBe(true)
  })

  test('Account-Felder eines v4-Bestands bleiben bei v4 -> v5 erhalten', () => {
    const v4 = {
      ...v3Base(),
      contracts: [],
      accounts: [{ id: 'x', name: 'Konto', type: 'checking' as const, balance: 100, manual: false, isLiability: false }],
    }
    const out = migrateBudgetState(v4, 4)
    expect(out.accounts.find((a) => a.id === 'x')?.manual).toBe(false)
  })
})

const v4Base = (categories: Category[] = [], extra: Partial<BudgetState> = {}) => ({
  ...v3Base(),
  contracts: [],
  categories,
  ...extra,
})

const ruleless = (id: string, label: string, budget: number | null = null): Category => ({
  id, label, kind: 'variable', budget, rules: [],
})

describe('migrateBudgetState v4 -> v5 (Ausgaben-Kategorien)', () => {
  test('leerer Kategorien-Bestand bekommt das Standard-Set mit Regeln', () => {
    const out = migrateBudgetState(v4Base([]), 4)
    expect(out.categories.length).toBeGreaterThan(5)
    // mindestens eine Kategorie hat jetzt Auto-Regeln
    expect(out.categories.some((c) => c.rules.length > 0)).toBe(true)
    expect(out.categories.some((c) => c.label === 'Einkauf')).toBe(true)
    expect(out.categories.some((c) => c.label.toLowerCase() === 'sonstiges')).toBe(true)
  })

  test('regellose, budgetlose, unreferenzierte Alt-Kategorien werden entfernt', () => {
    const out = migrateBudgetState(v4Base([ruleless('old', 'Netflix')]), 4)
    expect(out.categories.some((c) => c.id === 'old')).toBe(false)
  })

  test('Kategorie mit Budget bleibt erhalten (kein Datenverlust)', () => {
    const out = migrateBudgetState(v4Base([ruleless('keepme', 'iCloud', 1000)]), 4)
    const kept = out.categories.find((c) => c.id === 'keepme')
    expect(kept?.budget).toBe(1000)
  })

  test('von einer Buchung referenzierte Kategorie bleibt erhalten', () => {
    const tx = {
      id: 't', date: '2026-06-01', amount: -500, counterparty: 'X', purpose: '',
      categoryId: 'used', accountId: 'a', source: 'import' as const, hash: 'h',
    }
    const out = migrateBudgetState(v4Base([ruleless('used', 'Spotify')], { transactions: [tx] }), 4)
    expect(out.categories.some((c) => c.id === 'used')).toBe(true)
  })

  test('kuratierte Kategorie (mit Regel) bleibt erhalten und wird nicht dupliziert', () => {
    const curated: Category = {
      id: 'cur', label: 'Einkauf', kind: 'variable', budget: null,
      rules: [{ field: 'counterparty', match: 'contains', value: 'biomarkt' }],
    }
    const out = migrateBudgetState(v4Base([curated]), 4)
    const einkauf = out.categories.filter((c) => c.label.toLowerCase() === 'einkauf')
    expect(einkauf).toHaveLength(1)
    expect(einkauf[0].id).toBe('cur')
  })

  test('unkategorisierte Buchung bekommt per Regel eine Kategorie (REWE -> Einkauf)', () => {
    const tx = {
      id: 't', date: '2026-06-01', amount: -2000, counterparty: 'REWE Markt', purpose: '',
      categoryId: null, accountId: 'a', source: 'import' as const, hash: 'h',
    }
    const out = migrateBudgetState(v4Base([], { transactions: [tx] }), 4)
    const assigned = out.categories.find((c) => c.id === out.transactions[0].categoryId)
    expect(assigned?.label).toBe('Einkauf')
  })

  test('bereits v5 bleibt unverändert (idempotent)', () => {
    const v5 = { ...v4Base([]), categories: [ruleless('a', 'X', 100)] }
    const out = migrateBudgetState(v5, 5)
    expect(out).toBe(v5)
  })
})
