import { describe, expect, test } from 'vitest'
import { addDays, listPeriods, periodContaining, periodLabel } from './period'

describe('periodContaining', () => {
  test('ohne Gehaltsbuchung: Periode vom 15. bis 14.', () => {
    expect(periodContaining('2026-10-20', [])).toEqual({ start: '2026-10-15', end: '2026-11-14' })
    expect(periodContaining('2026-10-14', [])).toEqual({ start: '2026-09-15', end: '2026-10-14' })
  })

  test('Gehalt kommt früher (Fr. 13.): Periode beginnt am 13.', () => {
    const salary = ['2026-11-13']
    expect(periodContaining('2026-11-13', salary)).toEqual({ start: '2026-11-13', end: '2026-12-14' })
    // Die Vorperiode endet entsprechend einen Tag vorher.
    expect(periodContaining('2026-11-12', salary)).toEqual({ start: '2026-10-15', end: '2026-11-12' })
  })

  test('Gehalt außerhalb des Fensters (10. bis 18.) verschiebt nichts', () => {
    expect(periodContaining('2026-10-20', ['2026-10-02'])).toEqual({ start: '2026-10-15', end: '2026-11-14' })
  })

  test('mehrere Eingänge im Fenster: der früheste zählt', () => {
    expect(periodContaining('2026-10-20', ['2026-10-16', '2026-10-14']).start).toBe('2026-10-14')
  })

  test('Jahreswechsel', () => {
    expect(periodContaining('2027-01-03', [])).toEqual({ start: '2026-12-15', end: '2027-01-14' })
  })
})

describe('listPeriods', () => {
  test('liefert die Perioden vom ältesten Datum bis heute, neueste zuerst', () => {
    const periods = listPeriods([], '2026-10-20', '2026-08-20')
    expect(periods.map((p) => p.start)).toEqual(['2026-10-15', '2026-09-15', '2026-08-15'])
  })

  test('ohne Buchungen genau die aktuelle Periode', () => {
    expect(listPeriods([], '2026-10-20', null)).toHaveLength(1)
  })
})

describe('Helfer', () => {
  test('addDays über Monatsgrenzen', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  test('periodLabel', () => {
    expect(periodLabel({ start: '2026-10-15', end: '2026-11-14' })).toBe('15. Okt – 14. Nov')
  })
})

describe('listPeriods mit falscher Geräteuhr', () => {
  test('zukunftsdatierte Buchung verdrängt die aktuelle Periode nicht', () => {
    const periods = listPeriods([], '2026-10-20', '2027-03-01')
    expect(periods.map((p) => p.start)).toEqual(['2026-10-15'])
  })
})
