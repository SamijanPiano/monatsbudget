import { describe, it, expect } from 'vitest'
import {
  isPlus,
  maxBudgets,
  maxHistoryMonths,
  MAX_FREE_BUDGETS,
  MAX_FREE_HISTORY_MONTHS,
} from './entitlements'

describe('entitlements', () => {
  it('Gratis (kein plus): Limits greifen', () => {
    expect(isPlus({})).toBe(false)
    expect(isPlus({ plus: false })).toBe(false)
    expect(maxHistoryMonths({})).toBe(MAX_FREE_HISTORY_MONTHS)
    expect(maxBudgets({})).toBe(MAX_FREE_BUDGETS)
  })

  it('Plus: Limits aufgehoben (unendlich)', () => {
    expect(isPlus({ plus: true })).toBe(true)
    expect(maxHistoryMonths({ plus: true })).toBe(Number.POSITIVE_INFINITY)
    expect(maxBudgets({ plus: true })).toBe(Number.POSITIVE_INFINITY)
  })
})
