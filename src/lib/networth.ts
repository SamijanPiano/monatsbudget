// Gesamtvermögen über alle Konten. Rein funktional, Beträge in CENT.
// Vermögenswerte (Giro, Bargeld, PayPal, Krypto, Depot) zählen positiv,
// Schulden (Kreditkarte/Kredit, isLiability) als positive Magnitude negativ.
// Konten mit unbekanntem Saldo (balance === null) werden ignoriert.

import type { Account } from '../types/budget'

export interface NetWorth {
  /** Summe der Vermögenswerte in Cent. */
  assets: number
  /** Summe der Schulden als positive Magnitude in Cent. */
  liabilities: number
  /** Reinvermögen: assets − liabilities. */
  total: number
}

export function netWorth(accounts: readonly Account[]): NetWorth {
  let assets = 0
  let liabilities = 0
  for (const account of accounts) {
    if (account.balance == null) continue
    if (account.isLiability) {
      // Schuldhöhe unabhängig vom Vorzeichen der Eingabe (−500 oder 500 = 500 Schuld).
      liabilities += Math.abs(account.balance)
    } else {
      assets += account.balance
    }
  }
  return { assets, liabilities, total: assets - liabilities }
}
