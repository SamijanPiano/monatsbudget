import { describe, expect, it } from 'vitest'
import { buildPairingLink, readPairing } from './pairing'

const CODE = '0123456789abcdef0123456789abcdef'

describe('Gerät koppeln', () => {
  it('Link hin und zurück, ohne Zugangs-Token im Link', () => {
    const link = buildPairingLink('https://samijanpiano.github.io/monatsbudget/#alt', {
      url: 'https://mb.example.workers.dev/',
      code: CODE,
    })
    expect(link.startsWith('https://samijanpiano.github.io/monatsbudget/#koppeln=')).toBe(true)
    expect(readPairing(new URL(link).hash)).toEqual({ url: 'https://mb.example.workers.dev', code: CODE })
  })

  it('ignoriert fremde oder kaputte Fragmente', () => {
    expect(readPairing('')).toBeNull()
    expect(readPairing('#anderes')).toBeNull()
    expect(readPairing('#koppeln=%%%')).toBeNull()
    expect(readPairing('#koppeln=' + btoa(JSON.stringify({ u: 'http://evil.test', c: CODE })))).toBeNull()
    expect(readPairing('#koppeln=' + btoa(JSON.stringify({ u: 'https://x.test', c: 'kurz' })))).toBeNull()
    expect(readPairing('#koppeln=' + btoa(JSON.stringify({ u: 'http://localhost.evil.test', c: CODE })))).toBeNull()
    expect(readPairing('#koppeln=' + btoa(JSON.stringify({ u: 'http://localhost:8799', c: CODE })))?.url).toBe(
      'http://localhost:8799',
    )
  })
})
