// Aktionsprotokoll für Claude: was Samuel in der App tut (verschoben, gelöscht,
// Plan geändert, synchronisiert …). Einträge sammeln sich lokal und gehen mit
// dem nächsten Spiegel-Upload an den Worker; danach werden sie hier entfernt.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createId } from '../lib/id'

const STORAGE_KEY = 'monatsbudget-activity-v1'
/** Mehr hält das Gerät nicht vor, falls lange kein Upload klappt. */
const MAX_PENDING = 300

export interface ActivityEvent {
  id: string
  /** ISO-Zeitpunkt. */
  at: string
  /** Art, z. B. „verschoben", „plan", „sync", „duplikat", „schulden". */
  kind: string
  text: string
}

interface ActivityState {
  pending: ActivityEvent[]
  /** Zeitpunkt des letzten erfolgreichen Spiegel-Uploads. */
  lastMirrorAt: string | null
  /** Letzter Fehler beim Upload (null = alles gut). */
  lastMirrorError: string | null
  log: (kind: string, text: string) => void
  markSent: (ids: readonly string[], at: string) => void
  setMirrorError: (message: string | null) => void
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      pending: [],
      lastMirrorAt: null,
      lastMirrorError: null,
      log: (kind, text) =>
        set((s) => ({
          pending: [...s.pending, { id: createId(), at: new Date().toISOString(), kind, text }].slice(
            -MAX_PENDING,
          ),
        })),
      markSent: (ids, at) =>
        set((s) => {
          const sent = new Set(ids)
          return { pending: s.pending.filter((e) => !sent.has(e.id)), lastMirrorAt: at, lastMirrorError: null }
        }),
      setMirrorError: (message) => set({ lastMirrorError: message }),
    }),
    { name: STORAGE_KEY, version: 1 },
  ),
)

const MAX_TEXT = 300

/** Eine Zeile ohne Steuerzeichen: Empfänger und Zweck kommen von der Bank. */
export function oneLine(text: string, max = MAX_TEXT): string {
  return text
    // Steuerzeichen sind hier genau das Ziel (Zeilenumbrüche aus Bank-Texten).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** Kurzform zum Protokollieren aus Stores und Komponenten. */
export function logActivity(kind: string, text: string): void {
  useActivityStore.getState().log(oneLine(kind, 40), oneLine(text))
}
