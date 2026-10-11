// Bank-Sync → bestehende Import-Pipeline. Reine Abbildung der vom Backend
// gelieferten Buchungen auf ParsedTransaction (inkl. Dedup-Hash). So fließt der
// Live-Sync durch dieselbe Engine wie der Datei-Import (Dedup, Kategorisierung).
//
// Vorgemerkte Umsätze ('pending') werden bewusst NICHT übernommen: sie sind
// noch keine Geldbewegung und würden beim späteren echten Buchen (anderes
// Datum/anderer Verwendungszweck → anderer Hash) zu Duplikaten führen.
// Sie werden nur summiert und in der App als "steht noch aus" angezeigt.

import type { ParsedTransaction } from './import/types'
import { transactionHash } from './import/dedup'

export interface BankTxn {
  date: string
  /** Betrag in Cent, signed (negativ = Ausgabe). */
  amount: number
  counterparty: string
  purpose: string
  /** 'pending' = vorgemerkt (noch nicht abgebucht). Fehlend = gebucht (ältere Backends). */
  status?: 'booked' | 'pending'
}

/** Anzahl + Summe (signed Cent) der noch nicht abgebuchten Umsätze. */
export interface PendingSummary {
  count: number
  amountCents: number
}

export function toParsed(rows: BankTxn[]): ParsedTransaction[] {
  return rows
    .filter((r) => r.status !== 'pending')
    .map((r) => {
      const base = {
        date: r.date,
        amount: Math.round(r.amount),
        counterparty: r.counterparty ?? '',
        purpose: r.purpose ?? '',
      }
      return { ...base, hash: transactionHash(base) }
    })
}

/** Summiert die vorgemerkten Umsätze eines Sync-Laufs (für die Anzeige). */
export function pendingSummary(rows: BankTxn[]): PendingSummary {
  let count = 0
  let amountCents = 0
  for (const r of rows) {
    if (r.status !== 'pending') continue
    count += 1
    amountCents += Math.round(r.amount)
  }
  return { count, amountCents }
}
