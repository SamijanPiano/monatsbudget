// Reine Monats-Auswertung über Transaktionen: Ausgaben je Kategorie inkl.
// Budget-Vergleich. Keine Seiteneffekte. Beträge in Cent.

import type { Category, CategoryKind, Transaction } from '../types/budget'
import { monthKey } from './forecast'

export interface CategorySpend {
  categoryId: string | null
  label: string
  kind: CategoryKind | 'uncategorized'
  /** Summe der Ausgaben (Beträge < 0) im Monat als positive Größe. */
  spent: number
  budget: number | null
}

/**
 * Liefert pro Kategorie die Monats-Ausgaben und das Budget. Kategorien ohne
 * Ausgaben, aber mit Budget bleiben enthalten (für Budget-Balken). Unkategorisierte
 * Ausgaben werden in einem eigenen Eintrag (categoryId = null) gebündelt.
 * Sortiert nach Ausgaben absteigend.
 */
export function monthlyCategoryStats(
  txs: Transaction[],
  categories: Category[],
  key: string,
): CategorySpend[] {
  const monthExpenses = txs.filter((t) => t.amount < 0 && monthKey(t.date) === key)

  const spentByCat = new Map<string | null, number>()
  for (const t of monthExpenses) {
    const prev = spentByCat.get(t.categoryId) ?? 0
    spentByCat.set(t.categoryId, prev + Math.abs(t.amount))
  }

  const result: CategorySpend[] = categories.map((c) => ({
    categoryId: c.id,
    label: c.label,
    kind: c.kind,
    spent: spentByCat.get(c.id) ?? 0,
    budget: c.budget,
  }))

  const uncategorized = spentByCat.get(null) ?? 0
  if (uncategorized > 0) {
    result.push({
      categoryId: null,
      label: 'Unkategorisiert',
      kind: 'uncategorized',
      spent: uncategorized,
      budget: null,
    })
  }

  // Nur Kategorien mit Ausgaben oder Budget sind relevant.
  return result
    .filter((s) => s.spent > 0 || (s.budget !== null && s.budget > 0))
    .sort((a, b) => b.spent - a.spent)
}
