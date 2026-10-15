// Verbindet Import → Dedup → Auto-Kategorisierung. Reine Funktion (testbar).
// Wandelt geparste Bank-Buchungen in vollwertige Transaktionen um und überspringt
// dabei bereits vorhandene (idempotenter Re-Import).

import type { Category, Transaction, TransactionSource } from '../types/budget'
import type { ParsedTransaction } from './import/types'
import { mergeNew } from './import/dedup'
import { categorize } from './categorize'
import { createId } from './id'

interface IngestOptions {
  accountId: string
  categories: Category[]
  existing: (Pick<Transaction, 'hash' | 'bankRef'> & { accountId?: string })[]
  /** Herkunft der neuen Buchungen (Standard: Datei-Import). */
  source?: TransactionSource
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
  // Referenzen nur innerhalb desselben Kontos vergleichen: manche Banken
  // vergeben Zähler, die sich zwischen Konten wiederholen.
  const scoped = (ref: string) => `${opts.accountId}:${ref}`
  const existingRefs = opts.existing.flatMap((t) =>
    t.bankRef && (t.accountId === undefined || t.accountId === opts.accountId) ? [scoped(t.bankRef)] : [],
  )
  const incoming = parsed.map((p) => (p.bankRef ? { ...p, bankRef: scoped(p.bankRef) } : p))
  const kept = new Set(mergeNew(existingHashes, incoming, existingRefs))
  const fresh = parsed.filter((_, i) => kept.has(incoming[i]))
  return fresh.map((p) => ({
    id: createId(),
    date: p.date,
    amount: p.amount,
    counterparty: p.counterparty,
    purpose: p.purpose,
    categoryId: categorize({ counterparty: p.counterparty, purpose: p.purpose }, opts.categories),
    accountId: opts.accountId,
    source: opts.source ?? 'import',
    hash: p.hash,
    ...(p.bankRef ? { bankRef: p.bankRef } : {}),
  }))
}
