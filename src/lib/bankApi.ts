// HTTP-Client für das Bank-Sync-Backend (Cloudflare Worker). Spricht den fest
// vereinbarten Vertrag; alle Anfragen tragen das X-App-Token (Einzelnutzer-Schutz).

import type { SyncConfig } from './syncConfig'
import type { BankTxn } from './sync'

export interface Aspsp {
  name: string
  country: string
}

export interface BankAccount {
  id: string
  name: string
  iban: string | null
  /** Saldo in Cent oder null. */
  balance: number | null
}

async function call<T>(config: SyncConfig, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.url}${path}`, {
    ...init,
    headers: { 'X-App-Token': config.token, 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Backend-Fehler ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }
  return res.json() as Promise<T>
}

export function listAspsps(config: SyncConfig, country = 'DE'): Promise<Aspsp[]> {
  return call<Aspsp[]>(config, `/api/aspsps?country=${encodeURIComponent(country)}`)
}

export function startConnect(
  config: SyncConfig,
  aspsp: Aspsp,
  redirectUrl: string,
): Promise<{ authUrl: string }> {
  return call<{ authUrl: string }>(config, '/api/connect', {
    method: 'POST',
    body: JSON.stringify({ aspsp, redirectUrl }),
  })
}

export function fetchAccounts(config: SyncConfig): Promise<BankAccount[]> {
  return call<BankAccount[]>(config, '/api/accounts')
}

export function fetchTransactions(
  config: SyncConfig,
  accountId: string,
  dateFrom: string,
): Promise<BankTxn[]> {
  return call<BankTxn[]>(
    config,
    `/api/transactions?accountId=${encodeURIComponent(accountId)}&dateFrom=${dateFrom}`,
  )
}
