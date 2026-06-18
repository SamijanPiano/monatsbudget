// Reine Budget-Berechnungen — 1:1 aus dem ursprünglichen Excel „Monatskalkulation".
// Keine Seiteneffekte, keine UI: nur Zahlen rein, Zahlen raus. Vollständig getestet.

import type { LineItem, Month, MonthCalc, SituationCalc } from '../types/budget'

/** Auf zwei Nachkommastellen (Cent) runden, ohne Float-Drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Eine Zahl absichern: NaN/Infinity -> 0. */
function safe(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function sumKonto(items: readonly LineItem[]): number {
  return round2(items.reduce((acc, item) => acc + safe(item.konto), 0))
}

export function sumBar(items: readonly LineItem[]): number {
  return round2(items.reduce((acc, item) => acc + safe(item.bar), 0))
}

/**
 * Berechnet alle abgeleiteten Monatswerte.
 * Flaschenposten zählt als Konto-Einnahme (siehe Excel-Hinweis) und ist damit
 * automatisch in `incomeKonto` enthalten.
 */
export function calcMonth(month: Month): MonthCalc {
  const incomeKonto = sumKonto(month.income)
  const incomeBar = sumBar(month.income)
  const incomeTotal = round2(incomeKonto + incomeBar)

  const fixedTotal = sumKonto(month.fixed)

  const variableKonto = sumKonto(month.variable)
  const variableBar = sumBar(month.variable)
  const variableTotal = round2(variableKonto + variableBar)

  // C30: Konto nach allen Abzügen & variablen Konto-Ausgaben
  const kontoAfterDeductions = round2(incomeKonto - fixedTotal - variableKonto)
  // D31: Bar nach variablen Ausgaben
  const barAfterExpenses = round2(incomeBar - variableBar)

  const savingsKonto = round2(safe(month.savingsKonto))
  const savingsBar = round2(safe(month.savingsBar))

  return {
    incomeKonto,
    incomeBar,
    incomeTotal,
    fixedTotal,
    variableKonto,
    variableBar,
    variableTotal,
    kontoAfterDeductions,
    barAfterExpenses,
    // „Maximal sparen" nie negativ anzeigen
    maxSaveKonto: Math.max(0, kontoAfterDeductions),
    maxSaveBar: Math.max(0, barAfterExpenses),
    savingsKonto,
    savingsBar,
    // C41: Sicherheitspuffer Konto nach Sparen
    bufferKonto: round2(kontoAfterDeductions - savingsKonto),
    // D42: Bar frei verfügbar nach Sparen
    freeBar: round2(barAfterExpenses - savingsBar),
    // C43 + D43: Gesamtersparnis
    totalSavings: round2(savingsKonto + savingsBar),
  }
}

/**
 * „Reicht mein Konto diesen Monat?" — Szenario: Bargeld deckt die variablen
 * Bar-Ausgaben zuerst, das Konto springt für den Rest ein.
 */
export function calcSituation(month: Month, calc: MonthCalc): SituationCalc {
  const currentKonto = round2(safe(month.currentKonto))
  const currentBar = round2(safe(month.currentBar))

  // C59: Gesamt Konto benötigt (fix + variabel Konto)
  const kontoNeededFixedVar = round2(calc.fixedTotal + calc.variableKonto)
  // D62: Bar deckt variable Bar-Ausgaben bis zum verfügbaren Bargeld
  const barCovers = round2(Math.min(currentBar, calc.variableBar))
  // C63: Rest variable Bar-Ausgaben -> zahlt Konto
  const restBarToKonto = round2(calc.variableBar - barCovers)
  // C64: Konto benötigt gesamt
  const kontoNeededTotal = round2(kontoNeededFixedVar + restBarToKonto)
  // C65: Konto verbleibend nach allen Ausgaben
  const kontoRemaining = round2(currentKonto - kontoNeededTotal)
  // D66: Bar verbleibend nach Ausgaben
  const barRemaining = round2(currentBar - barCovers)

  const isEnough = kontoRemaining >= 0

  return {
    kontoNeededFixedVar,
    barCovers,
    restBarToKonto,
    kontoNeededTotal,
    kontoRemaining,
    barRemaining,
    isEnough,
    diff: round2(Math.abs(kontoRemaining)),
  }
}
