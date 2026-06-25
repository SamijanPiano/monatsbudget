// Budget-Ampel: bewertet die Monats-Ausgaben einer Kategorie gegen ihr Budget.
// Rein funktional, Beträge in CENT (positive Magnitude für Ausgaben/Budget).
// Die Ausgaben pro Kategorie liefert bereits `monthlyCategoryStats` (summary.ts);
// dieses Modul ergänzt nur die Schwellen-Logik (ok / warn / over).

/** Ab diesem Verhältnis (ausgegeben/Budget) wird vor dem Limit gewarnt. */
export const WARN_RATIO = 0.8

export type BudgetHealth = 'ok' | 'warn' | 'over'

export interface BudgetStatus {
  /** Ausgegeben in Cent (positive Magnitude). */
  spent: number
  /** Budget in Cent (positive Magnitude). */
  budget: number
  /** Verhältnis spent/budget (kann > 1 sein). 0, wenn kein Budget. */
  ratio: number
  health: BudgetHealth
}

/**
 * Bewertet Ausgaben gegen ein Budget:
 * - `over`  : ausgegeben > Budget
 * - `warn`  : ausgegeben ≥ WARN_RATIO · Budget (aber ≤ Budget)
 * - `ok`    : darunter (oder kein Budget gesetzt)
 */
export function budgetStatus(spent: number, budget: number): BudgetStatus {
  const safeBudget = Math.max(0, budget)
  const ratio = safeBudget > 0 ? spent / safeBudget : 0
  let health: BudgetHealth = 'ok'
  if (safeBudget > 0) {
    if (spent > safeBudget) health = 'over'
    else if (ratio >= WARN_RATIO) health = 'warn'
  }
  return { spent, budget: safeBudget, ratio, health }
}
