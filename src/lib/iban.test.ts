import { describe, it, expect } from 'vitest'
import { formatIban, isValidIban, normalizeIban } from './iban'

describe('normalizeIban', () => {
  it('entfernt Leerzeichen und macht Großbuchstaben', () => {
    expect(normalizeIban('de89 3704 0044 0532 0130 00')).toBe('DE89370400440532013000')
  })
})

describe('formatIban', () => {
  it('gruppiert in Vierer-Blöcke', () => {
    expect(formatIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00')
  })
})

describe('isValidIban', () => {
  it('akzeptiert eine gültige deutsche IBAN (mit Leerzeichen)', () => {
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true)
  })

  it('akzeptiert weitere gültige SEPA-IBANs', () => {
    expect(isValidIban('NL91ABNA0417164300')).toBe(true)
    expect(isValidIban('AT611904300234573201')).toBe(true)
    expect(isValidIban('CH9300762011623852957')).toBe(true)
  })

  it('lehnt eine IBAN mit falscher Prüfsumme ab', () => {
    expect(isValidIban('DE90 3704 0044 0532 0130 00')).toBe(false)
  })

  it('lehnt eine zu kurze/falsch lange IBAN ab (DE = 22 Zeichen)', () => {
    expect(isValidIban('DE89 3704 0044')).toBe(false)
  })

  it('lehnt fremde Zeichen / falsche Struktur ab', () => {
    expect(isValidIban('XX00')).toBe(false)
    expect(isValidIban('1234567890')).toBe(false)
    expect(isValidIban('DE89 3704 0044 0532 0130 0!')).toBe(false)
  })

  it('lehnt leere Eingabe ab', () => {
    expect(isValidIban('')).toBe(false)
  })
})
