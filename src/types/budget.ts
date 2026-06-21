// Datenmodelle für die Monatsbudget-App.
// Zwei-Kanal-System: jeder Posten kann einen Konto- und/oder Bar-Betrag haben.

export type Channel = 'konto' | 'bar'

export type GoalType = 'save' | 'debt' | 'buffer' | 'overview'

export interface Goal {
  id: string
  type: GoalType
  /** Anzeigename, z. B. „Urlaub Japan" */
  label: string
  /** Zielbetrag (€). save/buffer: Sparziel · debt: ursprüngliche Schuld · overview: 0 */
  targetAmount: number
  /** Optionale Frist YYYY-MM (treibt die empfohlene Monatsrate). */
  deadline?: string
  /** Aktueller Stand: Erspartes (save/buffer) bzw. Restschuld (debt). */
  currentAmount: number
  /** ISO-Zeitstempel der Erstellung. */
  createdAt: string
}

export interface UserProfile {
  /** Onboarding abgeschlossen? Steuert den Wizard. */
  onboarded: boolean
  /** Bar-Kanal aktiv? false = Einfach-Modus (Bar überall ausgeblendet). */
  cashEnabled: boolean
  /** Vom Nutzer gewählte Ziele (Mehrfachauswahl). */
  goals: Goal[]
}

export interface LineItem {
  id: string
  label: string
  /** Betrag auf dem Bankkonto-Kanal (€) */
  konto: number
  /** Betrag auf dem Bar-Kanal (€) */
  bar: number
  /** Optionaler Hinweis, z. B. „variabel" */
  note?: string
}

export interface Month {
  /** Eindeutige ID im Format YYYY-MM */
  id: string
  income: LineItem[]
  fixed: LineItem[]
  variable: LineItem[]
  /** Geplanter Sparbetrag Konto (Eingabe) */
  savingsKonto: number
  /** Geplanter Sparbetrag Bar (Eingabe) */
  savingsBar: number
  /** Aktueller Kontostand für den „Reicht es?"-Check (Eingabe) */
  currentKonto: number
  /** Aktuelles Bargeld für den „Reicht es?"-Check (Eingabe) */
  currentBar: number
}

export interface Settings {
  currency: string
  locale: string
  /** Optionales langfristiges Sparziel (€). 0 = aus */
  savingsGoal: number
}

// ─── Transaktions-Schicht (v3) ──────────────────────────────────────────────
// Quelle der Wahrheit für die neue, automatische Welt. Beträge in CENT (ganze
// Zahlen, signed: negativ = Ausgabe, positiv = Einnahme), um Float-Drift zu
// vermeiden. Datei-Import und späterer Live-Sync normalisieren auf dieselben
// Strukturen.

export type TransactionSource = 'import' | 'sync' | 'manual'

export type CategoryKind = 'income' | 'fixed' | 'variable' | 'savings' | 'transfer' | 'ignore'

export interface CategoryRule {
  field: 'counterparty' | 'purpose'
  match: 'contains' | 'equals' | 'regex'
  value: string
}

export interface Category {
  id: string
  label: string
  kind: CategoryKind
  /** Monatliches Plan-Budget in Cent. null = kein Budget gesetzt. */
  budget: number | null
  /** Regeln für die automatische Zuordnung von Buchungen. */
  rules: CategoryRule[]
  icon?: string
}

export type AccountType = 'checking' | 'cash'

export interface Account {
  id: string
  name: string
  type: AccountType
  /** Aktueller Saldo in Cent. null = unbekannt. */
  balance: number | null
  iban?: string
}

export interface Transaction {
  id: string
  /** Buchungsdatum im Format YYYY-MM-DD. */
  date: string
  /** Betrag in Cent, signed: negativ = Ausgabe, positiv = Einnahme. */
  amount: number
  /** Empfänger/Zahler. */
  counterparty: string
  /** Verwendungszweck. */
  purpose: string
  categoryId: string | null
  accountId: string
  source: TransactionSource
  /** Dedup-Schlüssel für idempotenten (Re-)Import. */
  hash: string
}

export interface RecurringRule {
  id: string
  counterparty: string
  /** typischer Betrag in Cent (signed). */
  amountApprox: number
  cadence: 'monthly'
  categoryId: string | null
  /** nächstes erwartetes Datum im Format YYYY-MM-DD. */
  nextExpected: string
}

export interface BudgetState {
  months: Record<string, Month>
  activeMonthId: string
  settings: Settings
  profile: UserProfile
  /** v3: einzelne Buchungen (Import/Sync/manuell). */
  transactions: Transaction[]
  /** v3: Kategorien mit optionalem Plan-Budget + Auto-Regeln. */
  categories: Category[]
  /** v3: Konten (Giro + optional Bar). */
  accounts: Account[]
  /** v3: erkannte wiederkehrende Posten. */
  recurringRules: RecurringRule[]
}

/** Abgeleitete Werte eines Monats (entspricht den Excel-Formeln). */
export interface MonthCalc {
  incomeKonto: number
  incomeBar: number
  incomeTotal: number
  fixedTotal: number
  variableKonto: number
  variableBar: number
  variableTotal: number
  /** Konto nach allen Abzügen & variablen Konto-Ausgaben (C30) */
  kontoAfterDeductions: number
  /** Bar nach variablen Ausgaben (D31) */
  barAfterExpenses: number
  /** MAX Konto sparen (C35 = C30) */
  maxSaveKonto: number
  /** MAX Bar sparen (D36 = D31) */
  maxSaveBar: number
  savingsKonto: number
  savingsBar: number
  /** Sicherheitspuffer Konto nach Sparen (C41) */
  bufferKonto: number
  /** Bar frei verfügbar nach Sparen (D42) */
  freeBar: number
  /** Gesamtersparnis diesen Monat (C43 + D43) */
  totalSavings: number
}

/** Ergebnis des „Reicht mein Konto?"-Checks. */
export interface SituationCalc {
  /** Gesamt Konto benötigt: fix + variabel Konto (C59) */
  kontoNeededFixedVar: number
  /** Bar deckt zuerst (D62) */
  barCovers: number
  /** Rest variable Bar-Ausgaben, die das Konto zahlt (C63) */
  restBarToKonto: number
  /** Konto benötigt gesamt (C64) */
  kontoNeededTotal: number
  /** Konto verbleibend nach allen Ausgaben (C65) */
  kontoRemaining: number
  /** Bar verbleibend nach Ausgaben (D66) */
  barRemaining: number
  /** true, wenn das Konto reicht (C65 >= 0) */
  isEnough: boolean
  /** Betrag des Puffers (wenn reicht) bzw. des Defizits (wenn nicht) */
  diff: number
}
