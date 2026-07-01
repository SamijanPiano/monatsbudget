// Lernsignale: das append-only Gedächtnis der App. Reine Datenmodelle plus
// seiteneffektfreie Helfer (Normalisierung, Tokenisierung, Recency-Gewicht).
// Beträge in CENT (ganze Zahlen, signed) wie die v3-Transaktionsschicht.

export type SignalSource = 'manual' | 'rule' | 'ai' | 'suggestion'
export type SuggestionSurface = 'category' | 'item' | 'budget' | 'recurring'

interface BaseSignal {
  id: string
  /** ISO-Zeitstempel der Erfassung. */
  ts: string
}

/** Eine Buchung wurde einer Kategorie zugeordnet (manuell, Regel, Vorschlag …). */
export interface CategoryAssignedSignal extends BaseSignal {
  type: 'category-assigned'
  counterpartyKey: string
  purposeTokens: string[]
  categoryId: string
  source: SignalSource
}

/** Ein Posten (Einnahme/Abo/Ausgabe) wurde angelegt. */
export interface ItemCreatedSignal extends BaseSignal {
  type: 'item-created'
  section: 'income' | 'fixed' | 'variable'
  labelKey: string
  amountCent: number
  categoryId: string | null
  recurring: boolean
}

/** Ein Kategorie-Budget wurde gesetzt. */
export interface BudgetSetSignal extends BaseSignal {
  type: 'budget-set'
  categoryId: string
  amountCent: number
  /** Monat im Format YYYY-MM. */
  monthId: string
}

/** Ein wiederkehrender Posten/Abo wurde bestätigt. */
export interface RecurringConfirmedSignal extends BaseSignal {
  type: 'recurring-confirmed'
  counterpartyKey: string
  amountCent: number
  /** Tag im Monat (1..31). */
  dayOfMonth: number
}

/** Rückmeldung zu einem Vorschlag: angenommen oder korrigiert. */
export interface SuggestionFeedbackSignal extends BaseSignal {
  type: 'suggestion-feedback'
  surface: SuggestionSurface
  predicted: string
  chosen: string
  accepted: boolean
}

export type LearningSignal =
  | CategoryAssignedSignal
  | ItemCreatedSignal
  | BudgetSetSignal
  | RecurringConfirmedSignal
  | SuggestionFeedbackSignal

/** Ein Signal, wie es an den Store übergeben wird — ohne die vom Store gesetzten Felder. */
export type SignalInput =
  | Omit<CategoryAssignedSignal, 'id' | 'ts'>
  | Omit<ItemCreatedSignal, 'id' | 'ts'>
  | Omit<BudgetSetSignal, 'id' | 'ts'>
  | Omit<RecurringConfirmedSignal, 'id' | 'ts'>
  | Omit<SuggestionFeedbackSignal, 'id' | 'ts'>

/** Standard-Halbwertszeit der Recency-Gewichtung in Tagen. */
export const HALF_LIFE_DAYS = 90

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Vereinheitlicht einen Schlüssel (Empfänger/Label) für stabile Vergleiche:
 * trimmen, Whitespace kollabieren, lowercase.
 */
export function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Zerlegt einen Verwendungszweck in lowercase-Tokens. Satzzeichen trennen,
 * Tokens kürzer als 2 Zeichen (Füllwörter, einzelne Buchstaben) fallen raus.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/)
    .filter((token) => token.length >= 2)
}

/**
 * Exponentiell abfallendes Gewicht eines Signals: jetzt = 1, nach einer
 * Halbwertszeit = 0.5. Zukünftige Zeitstempel werden auf 1 gedeckelt.
 */
export function recencyWeight(
  ts: string,
  now: string,
  halfLifeDays: number = HALF_LIFE_DAYS,
): number {
  const ageDays = (new Date(now).getTime() - new Date(ts).getTime()) / MS_PER_DAY
  // Kaputte Zeitstempel (NaN) niemals weiterreichen — neutrales Gewicht 1.
  if (Number.isNaN(ageDays) || ageDays <= 0) return 1
  return Math.pow(0.5, ageDays / halfLifeDays)
}
