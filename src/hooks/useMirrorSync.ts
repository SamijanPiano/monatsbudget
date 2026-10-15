import { useEffect } from 'react'
import { useBudgetStore } from '../store/budgetStore'
import { usePlanStore } from '../store/planStore'
import { useSaldoStore, saldoSnapshot } from '../store/saldoStore'
import { useActivityStore } from '../store/activityStore'
import { buildSnapshot } from '../lib/mirror/snapshot'
import { uploadMirror } from '../lib/bankApi'
import { getSyncConfig, isSyncConfigured } from '../lib/syncConfig'
import { todayIso } from '../lib/euro'

/** Wartezeit nach der letzten Änderung, bevor gespiegelt wird. */
const DEBOUNCE_MS = 15_000

let inFlight = false
/** Während eines Uploads kam eine Änderung oder ein Flush-Wunsch: danach nochmal. */
let pendingRerun = false
/** Inhalt des zuletzt erfolgreich gesendeten Schnappschusses (ohne Zeitstempel). */
let lastSentSignature: string | null = null

function currentSnapshot() {
  const b = useBudgetStore.getState()
  const p = usePlanStore.getState()
  return buildSnapshot({
    today: todayIso(),
    transactions: b.transactions,
    categories: b.categories,
    accounts: b.accounts,
    recurringRules: b.recurringRules,
    contracts: b.contracts,
    bankPending: b.bankPending,
    dismissedDuplicates: b.dismissedDuplicates ?? [],
    plan: p.plan,
    overrides: p.overrides,
    saldo: saldoSnapshot(),
  })
}

/** Leeres Gerät (frisch installiert, Daten noch nicht importiert): nichts überschreiben. */
function isEmptyDevice(): boolean {
  const { plan } = usePlanStore.getState()
  const hasPlan = plan.income.length + plan.fixed.length + plan.variable.length > 0
  return useBudgetStore.getState().transactions.length === 0 && !hasPlan
}

/** Baut den Schnappschuss aus allen Stores und lädt ihn mit offenen Protokolleinträgen hoch. */
export async function flushMirror(): Promise<void> {
  const config = getSyncConfig()
  if (!isSyncConfigured(config)) return
  if (inFlight) {
    pendingRerun = true
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  if (isEmptyDevice()) return

  const events = useActivityStore.getState().pending
  const snapshot = currentSnapshot()
  // Zeitstempel ausblenden, sonst wäre jeder Schnappschuss „neu".
  const signature = JSON.stringify({ ...snapshot, createdAt: '' })
  if (events.length === 0 && signature === lastSentSignature) return

  inFlight = true
  try {
    await uploadMirror(config, snapshot, events)
    lastSentSignature = signature
    useActivityStore.getState().markSent(events.map((e) => e.id), new Date().toISOString())
  } catch (e) {
    useActivityStore.getState().setMirrorError(e instanceof Error ? e.message : 'Spiegel fehlgeschlagen')
  } finally {
    inFlight = false
  }
  if (pendingRerun) {
    pendingRerun = false
    await flushMirror()
  }
}

/**
 * Spiegelt die App-Daten an den Worker, damit Claude sie sieht: einmal beim
 * Start, danach 15 s nach der letzten Änderung und sofort, wenn die App in den
 * Hintergrund geht. Ohne eingerichteten Sync passiert nichts.
 */
export function useMirrorSync(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void flushMirror(), DEBOUNCE_MS)
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(timer)
        void flushMirror()
      }
    }

    void flushMirror()
    const unsubscribe = [
      useBudgetStore.subscribe(schedule),
      usePlanStore.subscribe(schedule),
      useSaldoStore.subscribe(schedule),
      // Nur neue Einträge lösen aus, nicht das Entfernen nach einem Upload.
      useActivityStore.subscribe((s, prev) => {
        if (s.pending.length > prev.pending.length) schedule()
      }),
    ]
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      clearTimeout(timer)
      unsubscribe.forEach((u) => u())
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [])
}
