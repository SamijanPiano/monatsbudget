import { describe, it, expect } from 'vitest'
import { serializeBackup, parseBackup } from './backup'
import { DEFAULT_SETTINGS } from './seed'
import { makeSampleMonth } from './sampleMonth'

const state = {
  months: { '2099-01': makeSampleMonth('2099-01') },
  activeMonthId: '2099-01',
  settings: { ...DEFAULT_SETTINGS },
}

describe('Backup Roundtrip', () => {
  it('serialisiert und liest denselben Zustand wieder ein', () => {
    const json = serializeBackup(state)
    const parsed = parseBackup(json)
    expect(parsed.activeMonthId).toBe('2099-01')
    expect(Object.keys(parsed.months)).toEqual(['2099-01'])
    expect(parsed.months['2099-01'].income).toHaveLength(3)
    expect(parsed.months['2099-01'].savingsKonto).toBe(600)
  })

  it('wirft bei ungültigem JSON', () => {
    expect(() => parseBackup('nicht json {')).toThrow()
  })

  it('wirft, wenn keine Monate enthalten sind', () => {
    expect(() => parseBackup('{"months":{}}')).toThrow()
  })

  it('repariert fehlende Felder mit Defaults', () => {
    const partial = JSON.stringify({
      months: { '2026-07': { income: [{ label: 'X' }] } },
    })
    const parsed = parseBackup(partial)
    expect(parsed.months['2026-07'].income[0].konto).toBe(0)
    expect(parsed.months['2026-07'].fixed).toEqual([])
    expect(parsed.activeMonthId).toBe('2026-07')
  })

  it('lehnt fremde app-Kennung ab', () => {
    expect(() => parseBackup('{"app":"andere","months":{"2026-06":{}}}')).toThrow()
  })

  it('lehnt neuere Backup-Version ab', () => {
    expect(() => parseBackup('{"version":99,"months":{"2026-06":{}}}')).toThrow()
  })

  it('filtert ungültige Monats-IDs heraus', () => {
    expect(() => parseBackup('{"months":{"foo":{},"bar":{}}}')).toThrow()
  })

  it('klemmt negative Beträge auf 0', () => {
    const json = JSON.stringify({
      months: { '2026-06': { income: [{ label: 'X', konto: -50 }], savingsKonto: -10 } },
    })
    const parsed = parseBackup(json)
    expect(parsed.months['2026-06'].income[0].konto).toBe(0)
    expect(parsed.months['2026-06'].savingsKonto).toBe(0)
  })

  it('lehnt nicht-Objekt JSON ab', () => {
    expect(() => parseBackup('[]')).toThrow()
    expect(() => parseBackup('42')).toThrow()
  })
})
