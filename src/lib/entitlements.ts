// Plus-Tier-Nähte. Vorerst OHNE echte Bezahlung: `settings.plus` ist ein lokaler
// Schalter zum Testen. Die Konstanten begrenzen die Gratis-Version; mit Plus
// werden die Limits aufgehoben. Rein funktional, damit überall einfach testbar.

export const MAX_FREE_HISTORY_MONTHS = 3
export const MAX_FREE_BUDGETS = 5

export interface PlusFlag {
  plus?: boolean
}

export function isPlus(settings: PlusFlag): boolean {
  return settings.plus === true
}

/** Wie viele Monate Verlauf dürfen ausgewertet werden? (∞ mit Plus) */
export function maxHistoryMonths(settings: PlusFlag): number {
  return isPlus(settings) ? Number.POSITIVE_INFINITY : MAX_FREE_HISTORY_MONTHS
}

/** Wie viele Kategorie-Budgets dürfen gesetzt werden? (∞ mit Plus) */
export function maxBudgets(settings: PlusFlag): number {
  return isPlus(settings) ? Number.POSITIVE_INFINITY : MAX_FREE_BUDGETS
}
