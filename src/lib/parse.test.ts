import { describe, it, expect } from 'vitest'
import { parseAmount, toEditString } from './parse'

describe('parseAmount', () => {
  it('liest deutsche Dezimalzahlen (Komma)', () => {
    expect(parseAmount('7,2')).toBe(7.2)
    expect(parseAmount('1.234,56')).toBe(1234.56)
  })
  it('liest Punkt als Dezimaltrenner, wenn kein Komma da ist', () => {
    expect(parseAmount('7.2')).toBe(7.2)
    expect(parseAmount('350')).toBe(350)
  })
  it('ignoriert Währungssymbole und Leerzeichen', () => {
    expect(parseAmount('  1280 €')).toBe(1280)
    expect(parseAmount('€12,50')).toBe(12.5)
  })
  it('gibt 0 bei leer/ungültig', () => {
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
  })
  it('liest negative Beträge', () => {
    expect(parseAmount('-7,20')).toBe(-7.2)
  })
})

describe('toEditString', () => {
  it('zeigt 0 als leeren String', () => {
    expect(toEditString(0)).toBe('')
  })
  it('nutzt Komma als Dezimaltrenner', () => {
    expect(toEditString(7.2)).toBe('7,2')
    expect(toEditString(350)).toBe('350')
  })
})
