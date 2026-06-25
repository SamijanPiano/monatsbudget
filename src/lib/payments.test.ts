import { describe, it, expect } from 'vitest'
import { buildTransferRequest, isValid, validateTransfer, type TransferInput } from './payments'

function input(partial: Partial<TransferInput> = {}): TransferInput {
  return {
    creditorName: 'Max Mustermann',
    iban: 'DE89 3704 0044 0532 0130 00',
    amountCents: 2500,
    remittance: 'Miete Juni',
    ...partial,
  }
}

describe('validateTransfer', () => {
  it('eine korrekte Eingabe hat keine Fehler', () => {
    expect(isValid(validateTransfer(input()))).toBe(true)
  })

  it('meldet fehlenden Empfänger', () => {
    expect(validateTransfer(input({ creditorName: '   ' })).creditorName).toBeDefined()
  })

  it('meldet ungültige IBAN', () => {
    expect(validateTransfer(input({ iban: 'DE00 1234' })).iban).toBeDefined()
  })

  it('meldet Betrag <= 0 oder leer', () => {
    expect(validateTransfer(input({ amountCents: 0 })).amount).toBeDefined()
    expect(validateTransfer(input({ amountCents: null })).amount).toBeDefined()
    expect(validateTransfer(input({ amountCents: -100 })).amount).toBeDefined()
  })
})

describe('buildTransferRequest', () => {
  it('normalisiert IBAN, trimmt Namen, setzt EUR', () => {
    const req = buildTransferRequest(input())
    expect(req.creditorIban).toBe('DE89370400440532013000')
    expect(req.creditorName).toBe('Max Mustermann')
    expect(req.amount).toBe(2500)
    expect(req.currency).toBe('EUR')
  })

  it('kürzt einen zu langen Verwendungszweck auf 140 Zeichen', () => {
    const long = 'x'.repeat(200)
    const req = buildTransferRequest(input({ remittance: long }))
    expect(req.remittance).toHaveLength(140)
  })
})
