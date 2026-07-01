import { describe, expect, test } from 'vitest'
import { normalizeKey, tokenize, recencyWeight } from './signals'

describe('normalizeKey', () => {
  test('trimmt, kollabiert Whitespace und lowercased', () => {
    expect(normalizeKey('  REWE   Markt  ')).toBe('rewe markt')
  })

  test('leerer/whitespace-only Wert ergibt leeren String', () => {
    expect(normalizeKey('   ')).toBe('')
  })
})

describe('tokenize', () => {
  test('zerlegt Verwendungszweck in lowercase Tokens ohne Satzzeichen', () => {
    expect(tokenize('Netflix Abo, Mai 2026')).toEqual(['netflix', 'abo', 'mai', '2026'])
  })

  test('filtert leere Tokens und sehr kurze Füllwörter (<2)', () => {
    expect(tokenize('a REWE x')).toEqual(['rewe'])
  })

  test('leerer Zweck ergibt leeres Array', () => {
    expect(tokenize('')).toEqual([])
  })
})

describe('recencyWeight', () => {
  const now = '2026-06-30T00:00:00.000Z'

  test('jetziges Signal hat Gewicht 1', () => {
    expect(recencyWeight(now, now)).toBeCloseTo(1, 5)
  })

  test('eine Halbwertszeit (90 Tage) zurück ergibt Gewicht 0.5', () => {
    const past = '2026-04-01T00:00:00.000Z' // 90 Tage vor 2026-06-30
    expect(recencyWeight(past, now)).toBeCloseTo(0.5, 2)
  })

  test('älteres Signal wiegt weniger als jüngeres', () => {
    const older = '2026-01-01T00:00:00.000Z'
    const newer = '2026-06-01T00:00:00.000Z'
    expect(recencyWeight(older, now)).toBeLessThan(recencyWeight(newer, now))
  })

  test('zukünftiger Zeitstempel wird auf Gewicht 1 gedeckelt', () => {
    const future = '2026-12-31T00:00:00.000Z'
    expect(recencyWeight(future, now)).toBeCloseTo(1, 5)
  })

  test('ungültiger Zeitstempel ergibt nie NaN (neutrales Gewicht 1)', () => {
    expect(recencyWeight('kein-datum', now)).toBe(1)
    expect(recencyWeight(now, 'kaputt')).toBe(1)
  })
})
