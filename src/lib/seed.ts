// Startdaten der App — bewusst OHNE persönliche Zahlen.
// Eine neue Installation startet mit einer leeren, aber hilfreichen Vorlage.
// Echte Werte werden vom Nutzer lokal per Backup-Import geladen.

import type { Month, Settings } from '../types/budget'
import { createId } from './id'

export const DEFAULT_SETTINGS: Settings = {
  currency: '€',
  locale: 'de-DE',
  savingsGoal: 0,
}

/** Aktueller Monat im Format YYYY-MM. */
export function currentMonthId(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Generische Startvorlage (alle Beträge 0). Liefert eine sinnvolle Struktur,
 * die der Nutzer frei anpassen kann — enthält keine persönlichen Daten.
 */
export function createBlankMonth(id: string): Month {
  return {
    id,
    income: [
      { id: createId(), label: 'Gehalt (Überweisung)', konto: 0, bar: 0 },
      { id: createId(), label: 'Gehalt (Bar)', konto: 0, bar: 0 },
    ],
    fixed: [
      { id: createId(), label: 'Handy', konto: 0, bar: 0 },
      { id: createId(), label: 'Streaming', konto: 0, bar: 0 },
      { id: createId(), label: 'Versicherung', konto: 0, bar: 0 },
    ],
    variable: [
      { id: createId(), label: 'Lebensmittel', konto: 0, bar: 0 },
      { id: createId(), label: 'Sonstiges', konto: 0, bar: 0 },
    ],
    savingsKonto: 0,
    savingsBar: 0,
    currentKonto: 0,
    currentBar: 0,
  }
}

/**
 * Kopiert einen Monat als Vorlage für einen neuen Monat: Struktur und geplante
 * Beträge bleiben, aber die tagesaktuellen Stände werden zurückgesetzt.
 */
export function copyMonth(source: Month, newId: string): Month {
  return {
    id: newId,
    income: source.income.map((item) => ({ ...item, id: createId() })),
    fixed: source.fixed.map((item) => ({ ...item, id: createId() })),
    variable: source.variable.map((item) => ({ ...item, id: createId() })),
    savingsKonto: source.savingsKonto,
    savingsBar: source.savingsBar,
    currentKonto: 0,
    currentBar: 0,
  }
}
