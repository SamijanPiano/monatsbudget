// Überweisungen (PSD2 Payment Initiation) über das bestehende Bank-Backend.
// Enable Banking agiert als lizenzierter PISP — die App löst nur aus, die
// eigentliche Freigabe (SCA) passiert bei der Bank. Reine Validierung/Builder
// sind testbar; die Netzwerkaufrufe gehen an den Worker (X-App-Token).

import type { SyncConfig } from './syncConfig'
import { isValidIban, normalizeIban } from './iban'

export interface TransferRequest {
  creditorName: string
  /** Normalisierte Empfänger-IBAN. */
  creditorIban: string
  /** Betrag in Cent (positiv). */
  amount: number
  currency: string
  /** Verwendungszweck. */
  remittance: string
}

export interface TransferInput {
  creditorName: string
  iban: string
  /** Betrag in Cent (null = leer/ungültig). */
  amountCents: number | null
  remittance: string
}

export interface TransferErrors {
  creditorName?: string
  iban?: string
  amount?: string
}

const MAX_REMITTANCE = 140

/** Validiert eine Überweisungseingabe feldweise. Leeres Objekt = gültig. */
export function validateTransfer(input: TransferInput): TransferErrors {
  const errors: TransferErrors = {}
  if (!input.creditorName.trim()) {
    errors.creditorName = 'Empfängername fehlt.'
  }
  if (!isValidIban(input.iban)) {
    errors.iban = 'Ungültige IBAN.'
  }
  if (input.amountCents == null || input.amountCents <= 0) {
    errors.amount = 'Betrag muss größer als 0 sein.'
  }
  if (input.remittance.length > MAX_REMITTANCE) {
    // nicht-fatal, aber wir kürzen beim Build; hier kein Fehler nötig.
  }
  return errors
}

export function isValid(errors: TransferErrors): boolean {
  return Object.keys(errors).length === 0
}

/** Baut den Request aus einer (als gültig geprüften) Eingabe. */
export function buildTransferRequest(input: TransferInput): TransferRequest {
  return {
    creditorName: input.creditorName.trim(),
    creditorIban: normalizeIban(input.iban),
    amount: input.amountCents ?? 0,
    currency: 'EUR',
    remittance: input.remittance.slice(0, MAX_REMITTANCE),
  }
}

// ── Worker-Aufrufe ───────────────────────────────────────────────────────────

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

export interface InitiatePaymentResponse {
  /** URL zur Bank-Freigabe (SCA). Dorthin wird der Nutzer geleitet. */
  authUrl: string
  paymentId: string
}

/**
 * Startet eine Überweisung. Das Backend erzeugt die Zahlung bei Enable Banking
 * und liefert die SCA-URL zurück. `redirectUrl` ist die Rücksprungadresse der PWA.
 */
export function initiatePayment(
  config: SyncConfig,
  request: TransferRequest,
  redirectUrl: string,
): Promise<InitiatePaymentResponse> {
  return call<InitiatePaymentResponse>(config, '/api/payments/initiate', {
    method: 'POST',
    body: JSON.stringify({ payment: request, redirectUrl }),
  })
}

export interface PaymentStatusResponse {
  status: string
}

export function paymentStatus(
  config: SyncConfig,
  paymentId: string,
): Promise<PaymentStatusResponse> {
  return call<PaymentStatusResponse>(
    config,
    `/api/payments/status?paymentId=${encodeURIComponent(paymentId)}`,
  )
}
