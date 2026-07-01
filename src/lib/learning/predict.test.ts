import { describe, expect, test } from 'vitest'
import { suggestionMode } from './predict'

describe('suggestionMode', () => {
  const autofill = 0.85
  const suggest = 0.4

  test('Konfidenz >= autofill -> autofill', () => {
    expect(suggestionMode(0.9, autofill, suggest)).toBe('autofill')
  })

  test('genau am autofill-Schwellwert -> autofill', () => {
    expect(suggestionMode(0.85, autofill, suggest)).toBe('autofill')
  })

  test('zwischen suggest und autofill -> suggest', () => {
    expect(suggestionMode(0.6, autofill, suggest)).toBe('suggest')
  })

  test('genau am suggest-Schwellwert -> suggest', () => {
    expect(suggestionMode(0.4, autofill, suggest)).toBe('suggest')
  })

  test('unter suggest -> none', () => {
    expect(suggestionMode(0.2, autofill, suggest)).toBe('none')
  })
})
