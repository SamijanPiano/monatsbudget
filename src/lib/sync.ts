// Bank-Sync → bestehende Import-Pipeline. Reine Abbildung der vom Backend
// gelieferten Buchungen auf ParsedTransaction (inkl. Dedup-Hash). So fließt der
// Live-Sync durch dieselbe Engine wie der Datei-Import (Dedup, Kategorisierung).

import type { ParsedTransaction } from './import/types'
import { transactionHash } from './import/dedup'

export interface BankTxn {
  date: string
  /** Betrag in Cent, signed (negativ = Ausgabe). */
  amount: number
  counterparty: string
  purpose: string
}

export function toParsed(rows: BankTxn[]): ParsedTransaction[] {
  return rows.map((r) => {
    const base = {
      date: r.date,
      amount: Math.round(r.amount),
      counterparty: r.counterparty ?? '',
      purpose: r.purpose ?? '',
    }
    return { ...base, hash: transactionHash(base) }
  })
}
