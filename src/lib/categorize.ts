// Auto-Kategorisierung von Buchungen — reine Funktionen, keine Seiteneffekte,
// keine UI. Ordnet Transaktionen anhand der Regeln einer Kategorie zu.
import type { Category, CategoryRule, Transaction } from '../types/budget'

/** Liest das von der Regel adressierte Feld (case-insensitive Vergleich). */
function fieldValue(
  tx: Pick<Transaction, 'counterparty' | 'purpose'>,
  field: CategoryRule['field'],
): string {
  return (field === 'purpose' ? tx.purpose : tx.counterparty).toLowerCase()
}

/**
 * Prüft, ob eine einzelne Regel auf die Buchung passt. Case-insensitive.
 * Ungültige Regex-Werte ergeben false (nie ein Wurf).
 */
export function matchesRule(
  tx: Pick<Transaction, 'counterparty' | 'purpose'>,
  rule: CategoryRule,
): boolean {
  const haystack = fieldValue(tx, rule.field)
  const needle = rule.value.toLowerCase()

  if (rule.match === 'equals') return haystack === needle
  if (rule.match === 'contains') return haystack.includes(needle)

  // regex: case-insensitiv, ungültige Muster fangen wir ab.
  try {
    return new RegExp(rule.value, 'i').test(haystack)
  } catch {
    return false
  }
}

/**
 * Liefert die id der ERSTEN Kategorie, deren irgendeine Regel passt.
 * Reihenfolge = Array-Reihenfolge (deterministisch). null = kein Treffer.
 */
export function categorize(
  tx: Pick<Transaction, 'counterparty' | 'purpose'>,
  categories: Category[],
): string | null {
  for (const category of categories) {
    if (category.rules.some((rule) => matchesRule(tx, rule))) {
      return category.id
    }
  }
  return null
}

/**
 * Füllt categoryId für Buchungen, die noch null sind und für die eine Regel
 * greift. Bestehende (nicht-null) Zuordnungen bleiben unangetastet. Immutabel:
 * gibt ein neues Array mit neuen Objekten zurück, Eingabe bleibt unverändert.
 */
export function categorizeAll(txs: Transaction[], categories: Category[]): Transaction[] {
  return txs.map((tx) => {
    if (tx.categoryId !== null) return { ...tx }
    const categoryId = categorize(tx, categories)
    if (categoryId === null) return { ...tx }
    return { ...tx, categoryId }
  })
}

/** Vereinheitlicht einen Gegenpart-Namen für stabile equals-Regeln. */
function normalizeCounterparty(counterparty: string): string {
  return counterparty.trim().toLowerCase()
}

/**
 * Lernt aus einer manuellen Zuordnung: hängt eine equals-Regel auf den
 * (normalisierten) counterparty an die Zielkategorie an. Identische Regeln
 * werden übersprungen. Immutabel; andere Kategorien bleiben unberührt.
 */
export function learnRule(
  categories: Category[],
  categoryId: string,
  counterparty: string,
): Category[] {
  const value = normalizeCounterparty(counterparty)
  const newRule: CategoryRule = { field: 'counterparty', match: 'equals', value }

  return categories.map((category) => {
    if (category.id !== categoryId) return category

    const exists = category.rules.some(
      (rule) => rule.field === newRule.field && rule.match === newRule.match && rule.value === value,
    )
    if (exists) return category

    return { ...category, rules: [...category.rules, newRule] }
  })
}
