// Append-only Lern-Gedächtnis als eigener, persistierter Store — bewusst getrennt
// vom budgetStore, damit es separat geprüft, exportiert und beschnitten werden
// kann und nicht an Migrationen des Kern-Schemas hängt.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createId } from '../lib/id'
import type { LearningSignal, SignalInput } from '../lib/learning/signals'

export type { SignalInput }

const STORAGE_KEY = 'monatsbudget-learning-v1'

/** Maximale Anzahl gespeicherter Rohsignale; ältere fallen heraus. */
export const MAX_SIGNALS = 5000

/**
 * Maximales Signal-Alter in Tagen. Signale jenseits davon werden beim nächsten
 * record() entfernt — Datenschutz: alte Empfänger-/Zweckdaten verfallen auch
 * dann, wenn der Zähl-Deckel nie erreicht wird (4 Halbwertszeiten ≈ Gewicht 0.06).
 */
export const MAX_SIGNAL_AGE_DAYS = 360

const MS_PER_DAY = 86400000

interface LearningState {
  signals: LearningSignal[]
  /** Hängt ein Signal an, vergibt id + ts, deckelt auf MAX_SIGNALS (neueste behalten). */
  record: (input: SignalInput) => void
  /** Leert das gesamte Log (Nutzer-gesteuertes „Lerndaten zurücksetzen"). */
  clear: () => void
}

/**
 * Vervollständigt ein Eingangssignal um id + ts, ohne Typ-Cast: Der Generic hält
 * die Diskriminanten-Korrelation des konkreten Varianten-Typs `T` erhalten, sodass
 * das Ergebnis nachweislich ein vollständiges LearningSignal ist.
 */
function buildSignal<T extends SignalInput>(input: T): T & { id: string; ts: string } {
  return { ...input, id: createId(), ts: new Date().toISOString() }
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set) => ({
      signals: [],
      record: (input) =>
        set((state) => {
          const cutoff = Date.now() - MAX_SIGNAL_AGE_DAYS * MS_PER_DAY
          const kept = state.signals.filter((s) => new Date(s.ts).getTime() >= cutoff)
          const next = [...kept, buildSignal(input)]
          const trimmed = next.length > MAX_SIGNALS ? next.slice(next.length - MAX_SIGNALS) : next
          return { signals: trimmed }
        }),
      clear: () => set({ signals: [] }),
    }),
    { name: STORAGE_KEY },
  ),
)
