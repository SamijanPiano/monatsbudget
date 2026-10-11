// Urteil für den Monatsplan („Reicht es?"). Rechnet nichts neu, sondern
// bewertet die fertigen Excel-Werte aus calc.ts. Keine UI, vollständig getestet.

import type { Month, MonthCalc, SituationCalc } from '../types/budget'

/**
 * ok      = Konto reicht mit Luft
 * tight   = Konto reicht, aber knapp
 * short   = Konto reicht nicht (Excel: „NEIN, Konto fehlen")
 * unknown = noch kein aktueller Kontostand/Bargeld eingetragen
 */
export type VerdictTone = 'ok' | 'tight' | 'short' | 'unknown'

/** Kein Stand eingetragen: dann wäre jedes Urteil geraten. */
export function hasCurrentBalance(month: Month): boolean {
  return month.currentKonto !== 0 || month.currentBar !== 0
}

/**
 * Bewertet, ob das Konto für den Rest des Monats reicht.
 * Die Excel kennt nur Ja/Nein (C65 >= 0). Die Abstufung „knapp" ist die
 * einzige Stelle, an der die App bewusst mehr sagt als die Tabelle.
 */
export function verdictTone(month: Month, calc: MonthCalc, situation: SituationCalc): VerdictTone {
  if (!hasCurrentBalance(month)) return 'unknown'
  if (!situation.isEnough) return 'short'

  // TODO(human): Ab wann ist ein positiver Puffer „knapp" ('tight')?
  // Verfügbar: situation.kontoRemaining (Puffer in €), situation.kontoNeededTotal
  // (was das Konto noch zahlen muss), calc.fixedTotal, calc.incomeKonto.
  void calc

  return 'ok'
}
