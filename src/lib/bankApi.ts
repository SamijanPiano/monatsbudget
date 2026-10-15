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

/** Erlaubt nur HTTPS als Transport; HTTP nur für lokale Entwicklung (localhost). */
function assertSecureUrl(url: string): void {
  if (url.startsWith('https://')) return
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url)) return
  throw new Error('Backend-URL muss https:// verwenden (Finanzdaten nie unverschlüsselt senden).')
}

async function call<T>(config: SyncConfig, path: string, init?: RequestInit): Promise<T> {
  assertSecureUrl(config.url)
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

export interface CategoryAssignment {
  id: string
  categoryId: string | null
}

export function aiCategorize(
  config: SyncConfig,
  transactions: Array<{ id: string; counterparty: string; purpose?: string; amount: number }>,
  categories: Array<{ id: string; label: string }>,
): Promise<CategoryAssignment[]> {
  return call<CategoryAssignment[]>(config, '/api/categorize', {
    method: 'POST',
    body: JSON.stringify({ transactions, categories }),
  })
}

export function aiChat(
  config: SyncConfig,
  message: string,
  context: unknown,
): Promise<{ reply: string }> {
  return call<{ reply: string }>(config, '/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, context }),
  })
}

const MIRROR_TIMEOUT_MS = 20_000
const STATE_TIMEOUT_MS = 20_000

/** Schickt Schnappschuss und neue Protokolleinträge an den Worker (Spiegel für Claude). */
export function uploadMirror(
  config: SyncConfig,
  snapshot: unknown,
  events: unknown[],
): Promise<{ ok: boolean; events: number }> {
  return call<{ ok: boolean; events: number }>(config, '/api/mirror', {
    method: 'POST',
    body: JSON.stringify({ snapshot, events }),
    // Hängende Verbindung (iOS im Hintergrund, Captive Portal) nicht ewig offen halten.
    signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
  })
}

export interface RemoteState {
  revision: number
  updatedAt: string | null
  /** Gerät, das zuletzt geschrieben hat. */
  deviceId?: string | null
  doc: unknown
}

/** Gemeinsamen Stand aller Geräte laden. */
export function fetchState(config: SyncConfig): Promise<RemoteState> {
  return call<RemoteState>(config, '/api/state', { signal: AbortSignal.timeout(STATE_TIMEOUT_MS) })
}

export type PushResult =
  | { ok: true; revision: number }
  | { ok: false; conflict: RemoteState }

/** Stand hochladen; 409 heißt: ein anderes Gerät war schneller, `conflict` enthält dessen Stand. */
export async function pushState(
  config: SyncConfig,
  body: { baseRevision: number; deviceId: string; doc: unknown },
): Promise<PushResult> {
  assertSecureUrl(config.url)
  const res = await fetch(`${config.url}/api/state`, {
    method: 'PUT',
    headers: { 'X-App-Token': config.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(STATE_TIMEOUT_MS),
  })
  if (res.status === 409) return { ok: false, conflict: (await res.json()) as RemoteState }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Backend-Fehler ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }
  const data = (await res.json()) as { revision: number }
  return { ok: true, revision: data.revision }
}

/** Einmal-Code für ein weiteres Gerät anfordern (10 Minuten gültig, genau einmal einlösbar). */
export function createPairCode(config: SyncConfig): Promise<{ code: string; expiresAt: number }> {
  return call<{ code: string; expiresAt: number }>(config, '/api/pair', { method: 'POST', body: '{}' })
}

/** Einmal-Code gegen den Zugang tauschen (das neue Gerät hat noch keinen Token). */
export async function redeemPairCode(url: string, code: string): Promise<string> {
  assertSecureUrl(url)
  const res = await fetch(`${url}/api/pair/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(STATE_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error('Kopplungs-Link ist abgelaufen oder wurde schon benutzt.')
  const data = (await res.json()) as { token?: unknown }
  if (typeof data.token !== 'string' || !data.token) throw new Error('Kopplung fehlgeschlagen.')
  return data.token
}
