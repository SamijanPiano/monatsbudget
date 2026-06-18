// Test-Fixture mit erfundenen Beispielwerten (keine echten Daten).
// Dient zur Verifikation der Rechenlogik in den Unit-Tests.

import type { Month } from '../types/budget'

export function makeSampleMonth(id = '2099-01'): Month {
  return {
    id,
    income: [
      { id: 'i1', label: 'Gehalt (Überweisung)', konto: 2000, bar: 0 },
      { id: 'i2', label: 'Gehalt (Bar)', konto: 0, bar: 500 },
      { id: 'i3', label: 'Extra', konto: 0, bar: 0 },
    ],
    fixed: [
      { id: 'f1', label: 'Abo A', konto: 20, bar: 0 },
      { id: 'f2', label: 'Abo B', konto: 30, bar: 0 },
    ],
    variable: [
      { id: 'v1', label: 'Bar-Ausgabe', konto: 0, bar: 400 },
      { id: 'v2', label: 'Gemischt', konto: 300, bar: 100 },
    ],
    savingsKonto: 600,
    savingsBar: 0,
    currentKonto: 1000,
    currentBar: 0,
  }
}
