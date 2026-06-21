// Verbindet Import → Dedup → Auto-Kategorisierung. Reine Funktion (testbar).
// Wandelt geparste Bank-Buchungen in vollwertige Transaktionen um und überspringt
// dabei bereits vorhandene (idempotenter Re-Import).

import type { Category, Transaction } from '../types/budget'
import type { ParsedTransaction } from './import/types'
import { mergeNew } from './import/dedup'
import { categorize } from './categorize'
import { createId } from './id'

interface IngestOptions {
  accountId: string
  categories: Category[]
  existing: Pick<Transaction, 'hash'>[]
}

/**
 * Reichert neue, noch nicht vorhandene geparste Buchungen zu Transaktionen an:
 * vergibt id/accountId/source, ordnet automatisch eine Kategorie zu.
 */
export function buildImportedTransactions(
  parsed: ParsedTransaction[],
  opts: IngestOptions,
): Transaction[] {
  const existingHashes = new Set(opts.existing.map((t) => t.hash))
  const fresh = mergeNew(existingHashes, parsed)
  return fresh.map((p) => ({
    id: createId(),
    date: p.date,
    amount: p.amount,
    counterparty: p.counterparty,
    purpose: p.purpose,
    categoryId: categorize({ counterparty: p.counterparty, purpose: p.purpose }, opts.categories),
    accountId: opts.accountId,
    source: 'import' as const,
    hash: p.hash,
  }))
}
