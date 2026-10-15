// Abgleich zwischen diesem Gerät und dem gemeinsamen Stand im Worker.
// Ablauf wie beim ERP: der Worker ist die Quelle, Geräte laden beim Öffnen und
// regelmäßig nach und schicken eigene Änderungen hoch. Schreiben zwei Geräte
// gleichzeitig, lehnt der Worker den veralteten Stand ab (409); dieses Gerät
// führt dann zusammen und versucht es erneut.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useBudgetStore } from '../../store/budgetStore'
import { usePlanStore } from '../../store/planStore'
import { saldoSnapshot, useSaldoStore } from '../../store/saldoStore'
import { detectRecurring } from '../recurring'
import { createId } from '../id'
import { fetchState, pushState, type RemoteState } from '../bankApi'
import { getSyncConfig, isSyncConfigured } from '../syncConfig'
import {
  buildDoc,
  emptyChangedAt,
  isEmptyDoc,
  mergeDocs,
  parseDoc,
  type ChangedAt,
  type Section,
  type SyncDoc,
} from './doc'

const META_KEY = 'monatsbudget-cloud-v2'
/** Sicherungen der lokalen Daten, bevor ein Gerät den Cloud-Stand übernimmt (die letzten 3). */
export const PRE_PAIRING_BACKUP_KEY = 'monatsbudget-vor-kopplung'
const MAX_BACKUPS = 3
const MAX_PUSH_ATTEMPTS = 3

interface CloudMeta {
  /** Zufällige Kennung dieses Geräts. */
  deviceId: string
  /** Revision des Worker-Stands, auf dem dieses Gerät aufsetzt. null = noch nie abgeglichen. */
  revision: number | null
  changedAt: ChangedAt
  /** Es gibt lokale Änderungen, die noch nicht im Worker sind (überlebt Neustarts). */
  dirty: boolean
  lastSyncAt: string | null
  lastError: string | null
}

export const useCloudMeta = create<CloudMeta>()(
  persist(
    (): CloudMeta => ({
      deviceId: createId(),
      revision: null,
      changedAt: emptyChangedAt(),
      dirty: false,
      lastSyncAt: null,
      lastError: null,
    }),
    { name: META_KEY, version: 1 },
  ),
)

/** Während ein fremder Stand eingespielt wird, sind Store-Änderungen keine lokalen Änderungen. */
let applyingRemote = false
/**
 * Kurz nach dem Start räumt die App selbst auf (Kategorien nachtragen, Plan
 * festschreiben). Das sind keine Eingaben und zählt nicht als Änderung. Alles
 * danach zählt sofort, auch wenn der erste Abgleich noch lädt.
 */
const BOOT_GRACE_MS = 1_500
let bootAt = Date.now()

/** Beim Einhängen der App aufrufen: ab hier läuft die Start-Schonfrist. */
export function startEngineClock(now = Date.now()): void {
  bootAt = now
}
/** Zählt lokale Änderungen; so bleibt eine Änderung während eines Uploads als offen markiert. */
let localVersion = 0

/** Fremden Stand einspielen, ohne ihn als lokale Änderung zu zählen (auch für Tab-Abgleich). */
export function withRemote(fn: () => void): void {
  applyingRemote = true
  try {
    fn()
  } finally {
    applyingRemote = false
  }
}

/** Wie withRemote, für asynchrones Nachladen (z. B. Stand aus einem anderen Tab). */
export async function withRemoteAsync(fn: () => Promise<void>): Promise<void> {
  applyingRemote = true
  try {
    await fn()
  } finally {
    applyingRemote = false
  }
}

/** Von den Store-Abos aufgerufen: diese Bereiche wurden auf diesem Gerät geändert. */
export function markLocalChange(sections: readonly Section[]): void {
  if (applyingRemote || sections.length === 0 || Date.now() - bootAt < BOOT_GRACE_MS) return
  localVersion += 1
  const now = new Date().toISOString()
  const changedAt = { ...useCloudMeta.getState().changedAt }
  for (const s of sections) changedAt[s] = now
  useCloudMeta.setState({ changedAt, dirty: true })
}

function localDoc(): SyncDoc {
  const plan = usePlanStore.getState()
  return buildDoc(
    useBudgetStore.getState(),
    { plan: plan.plan, overrides: plan.overrides },
    saldoSnapshot(),
    useCloudMeta.getState().changedAt,
  )
}

/** Spielt einen Stand in die Stores ein. */
function applyDoc(doc: SyncDoc): void {
  withRemote(() => {
    const current = useBudgetStore.getState()
    const monthIds = Object.keys(doc.budget.months).sort()
    useBudgetStore.setState({
      months: doc.budget.months,
      // Welcher Monat gerade angezeigt wird, bleibt Sache des Geräts.
      activeMonthId: doc.budget.months[current.activeMonthId]
        ? current.activeMonthId
        : (monthIds[monthIds.length - 1] ?? current.activeMonthId),
      settings: doc.budget.settings,
      transactions: doc.budget.transactions,
      categories: doc.budget.categories,
      accounts: doc.budget.accounts,
      contracts: doc.budget.contracts,
      bankPending: doc.budget.bankPending,
      dismissedDuplicates: doc.budget.dismissedDuplicates,
      deletedTransactionIds: doc.budget.deletedTransactionIds,
      recurringRules: detectRecurring(doc.budget.transactions),
      profile: { ...current.profile, cashEnabled: doc.budget.cashEnabled, goals: doc.budget.goals },
    })
    usePlanStore.setState({ plan: doc.plan.plan, overrides: doc.plan.overrides })
    useSaldoStore.getState().replaceSaldo(doc.saldo)
    useCloudMeta.setState({ changedAt: doc.changedAt })
  })
}

function backupBeforeAdopting(doc: SyncDoc): void {
  try {
    const raw = localStorage.getItem(PRE_PAIRING_BACKUP_KEY)
    const list = raw ? (JSON.parse(raw) as unknown[]) : []
    const next = [...(Array.isArray(list) ? list : []), { savedAt: new Date().toISOString(), doc }].slice(-MAX_BACKUPS)
    localStorage.setItem(PRE_PAIRING_BACKUP_KEY, JSON.stringify(next))
  } catch {
    // Speicher voll oder gesperrt: Übernahme trotzdem, der Cloud-Stand ist die Quelle.
  }
}

/** Upload erfolgreich: nur als erledigt markieren, wenn währenddessen nichts Neues kam. */
function markPushed(revision: number, versionAtPush: number): void {
  useCloudMeta.setState({ revision, dirty: localVersion !== versionAtPush })
}

/** Lädt hoch; bei Konflikt zusammenführen und erneut versuchen. */
async function push(doc: SyncDoc, baseRevision: number): Promise<void> {
  const config = getSyncConfig()
  const { deviceId } = useCloudMeta.getState()
  let candidate = doc
  let base = baseRevision
  for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt++) {
    const versionAtPush = localVersion
    const result = await pushState(config, { baseRevision: base, deviceId, doc: candidate })
    if (result.ok) {
      markPushed(result.revision, versionAtPush)
      return
    }
    const remote = result.conflict.doc === null ? null : parseDoc(result.conflict.doc)
    if (result.conflict.doc !== null && !remote) throw new Error('Cloud-Stand ist beschädigt.')
    candidate = remote ? mergeDocs(localDoc(), remote) : localDoc()
    if (remote) applyDoc(candidate)
    base = result.conflict.revision
  }
  throw new Error('Abgleich nach mehreren Versuchen nicht möglich, später erneut.')
}

/** Die eigentliche Entscheidung eines Abgleichs. */
async function reconcileWith(remote: RemoteState): Promise<void> {
  const meta = useCloudMeta.getState()
  const local = localDoc()

  if (remote.doc === null) {
    // Noch nichts in der Cloud (oder zurückgesetzt): ein Gerät mit Daten legt den Stand an.
    if (!isEmptyDoc(local)) await push(local, remote.revision)
    return
  }
  const remoteDoc = parseDoc(remote.doc)
  if (!remoteDoc) throw new Error('Cloud-Stand ist beschädigt.')

  if (meta.revision === null) {
    if (remote.deviceId === meta.deviceId && !isEmptyDoc(local)) {
      // Eigener Stand, nur die Antwort auf den ersten Upload ging verloren: zusammenführen.
      const merged = mergeDocs(local, remoteDoc)
      applyDoc(merged)
      await push(merged, remote.revision)
    } else {
      // Neues Gerät: übernimmt den Cloud-Stand, eigene Altdaten werden gesichert.
      if (!isEmptyDoc(local)) backupBeforeAdopting(local)
      applyDoc(remoteDoc)
      useCloudMeta.setState({ revision: remote.revision, dirty: false })
    }
    return
  }

  if (remote.revision < meta.revision) {
    // Das Durable Object ist stark konsistent: ein niedrigerer Stand heißt, die
    // Cloud wurde zurückgesetzt. Eigenen Stand einbringen statt einzufrieren.
    const merged = mergeDocs(local, remoteDoc)
    applyDoc(merged)
    await push(merged, remote.revision)
    return
  }
  if (remote.revision === meta.revision) {
    if (meta.dirty) await push(local, remote.revision)
    return
  }
  if (!meta.dirty) {
    applyDoc(remoteDoc)
    useCloudMeta.setState({ revision: remote.revision })
    return
  }
  const merged = mergeDocs(local, remoteDoc)
  applyDoc(merged)
  await push(merged, remote.revision)
}

let inFlight = false
let rerun = false

/**
 * Ein Abgleich: neuesten Stand holen, mit dem lokalen vergleichen, eigene
 * Änderungen hochladen. Läuft nie doppelt; Anfragen währenddessen werden nachgeholt.
 */
export async function reconcile(): Promise<void> {
  const config = getSyncConfig()
  if (!isSyncConfigured(config)) return
  if (inFlight) {
    rerun = true
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  inFlight = true
  try {
    await reconcileWith(await fetchState(config))
    useCloudMeta.setState({ lastSyncAt: new Date().toISOString(), lastError: null })
  } catch (e) {
    useCloudMeta.setState({ lastError: e instanceof Error ? e.message : 'Abgleich fehlgeschlagen' })
  } finally {
    inFlight = false
  }
  if (rerun) {
    rerun = false
    await reconcile()
  }
}
