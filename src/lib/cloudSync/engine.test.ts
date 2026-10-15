import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Transaction } from '../../types/budget'

const mem = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
})

// Simulierter Worker: Revision + optimistisches Sperren wie in backend/src/state.ts.
const server: { revision: number; doc: unknown; puts: number; forceConflictOnce: unknown; deviceId: string | null } = {
  revision: 0,
  doc: null,
  deviceId: null,
  puts: 0,
  forceConflictOnce: null,
}

vi.mock('../syncConfig', () => ({
  getSyncConfig: () => ({ url: 'https://worker.test', token: 't' }),
  isSyncConfigured: () => true,
}))
vi.mock('../bankApi', () => ({
  fetchState: async () => ({ revision: server.revision, updatedAt: null, deviceId: server.deviceId, doc: server.doc }),
  pushState: async (_c: unknown, body: { baseRevision: number; deviceId: string; doc: unknown }) => {
    server.puts += 1
    if (server.forceConflictOnce) {
      // Ein anderes Gerät schreibt genau jetzt dazwischen.
      server.doc = server.forceConflictOnce
      server.revision += 1
      server.forceConflictOnce = null
    }
    if (body.baseRevision !== server.revision) {
      return { ok: false, conflict: { revision: server.revision, updatedAt: null, doc: server.doc } }
    }
    server.revision += 1
    server.deviceId = body.deviceId
    server.doc = JSON.parse(JSON.stringify(body.doc))
    return { ok: true, revision: server.revision }
  },
}))

const { useBudgetStore } = await import('../../store/budgetStore')
const { usePlanStore } = await import('../../store/planStore')
const { useCloudMeta, reconcile, markLocalChange, startEngineClock, PRE_PAIRING_BACKUP_KEY } = await import('./engine')
const { emptyChangedAt } = await import('./doc')

let n = 0
const tx = (id: string, over: Partial<Transaction> = {}): Transaction => ({
  id,
  date: '2026-10-01',
  amount: -1000 - ++n,
  counterparty: 'REWE',
  purpose: 'Einkauf',
  categoryId: null,
  accountId: 'acc',
  source: 'sync',
  hash: `h-${id}`,
  ...over,
})

const ids = (list: unknown) =>
  ((list as { budget: { transactions: Transaction[] } }).budget.transactions ?? []).map((t) => t.id).sort()

beforeEach(() => {
  // Start-Schonfrist liegt in der Vergangenheit: Änderungen zählen.
  startEngineClock(Date.now() - 10_000)
  mem.clear()
  server.revision = 0
  server.doc = null
  server.puts = 0
  server.forceConflictOnce = null
  server.deviceId = null
  useBudgetStore.setState({ transactions: [], deletedTransactionIds: [] })
  usePlanStore.setState({ plan: { income: [], fixed: [], variable: [], savings: 0, balance: 0 }, overrides: {} })
  useCloudMeta.setState({ revision: null, changedAt: emptyChangedAt(), dirty: false, lastError: null })
})

describe('reconcile', () => {
  test('erstes Gerät mit Daten legt den Cloud-Stand an', async () => {
    useBudgetStore.setState({ transactions: [tx('a')] })
    await reconcile()
    expect(server.revision).toBe(1)
    expect(ids(server.doc)).toEqual(['a'])
    expect(useCloudMeta.getState().revision).toBe(1)
  })

  test('leeres Gerät legt nichts an', async () => {
    await reconcile()
    expect(server.puts).toBe(0)
  })

  test('neues Gerät übernimmt den Cloud-Stand und sichert seine Altdaten', async () => {
    useBudgetStore.setState({ transactions: [tx('handy')] })
    await reconcile() // Handy legt an
    // Gleiches Testgerät spielt jetzt einen frisch gekoppelten Mac mit Altdaten:
    server.deviceId = 'handy-id'
    useCloudMeta.setState({ revision: null })
    useBudgetStore.setState({ transactions: [tx('alt-mac')] })
    await reconcile()
    expect(useBudgetStore.getState().transactions.map((t) => t.id)).toEqual(['handy'])
    expect(mem.get(PRE_PAIRING_BACKUP_KEY)).toContain('alt-mac')
    expect(server.puts).toBe(1)
  })

  test('unverändertes Gerät übernimmt neuere Cloud-Stände', async () => {
    useBudgetStore.setState({ transactions: [tx('a')] })
    await reconcile()
    server.doc = { ...(server.doc as object), budget: { ...(server.doc as { budget: object }).budget, transactions: [tx('a'), tx('b')] } }
    server.revision += 1
    await reconcile()
    expect(useBudgetStore.getState().transactions.map((t) => t.id).sort()).toEqual(['a', 'b'])
  })

  test('beide geändert: Buchungen werden vereinigt und hochgeladen', async () => {
    useBudgetStore.setState({ transactions: [tx('a')] })
    await reconcile()
    // Anderes Gerät fügt b hinzu …
    server.doc = { ...(server.doc as object), budget: { ...(server.doc as { budget: object }).budget, transactions: [tx('a'), tx('b')] } }
    server.revision += 1
    // … während dieses Gerät c hinzufügt.
    useBudgetStore.setState({ transactions: [tx('a'), tx('c')] })
    markLocalChange(['transactions'])
    await reconcile()
    expect(ids(server.doc)).toEqual(['a', 'b', 'c'])
    expect(useBudgetStore.getState().transactions.map((t) => t.id).sort()).toEqual(['a', 'b', 'c'])
  })

  test('Konflikt beim Hochladen: zusammenführen und erneut versuchen', async () => {
    useBudgetStore.setState({ transactions: [tx('a')] })
    await reconcile()
    const base = server.doc as { budget: object }
    server.forceConflictOnce = { ...base, budget: { ...base.budget, transactions: [tx('a'), tx('fremd')] } }
    useBudgetStore.setState({ transactions: [tx('a'), tx('eigen')] })
    markLocalChange(['transactions'])
    await reconcile()
    expect(ids(server.doc)).toEqual(['a', 'eigen', 'fremd'])
    expect(useCloudMeta.getState().lastError).toBeNull()
  })

  test('auf einem Gerät gelöschte Buchung kommt vom anderen nicht zurück', async () => {
    useBudgetStore.setState({ transactions: [tx('a'), tx('b')] })
    await reconcile()
    useBudgetStore.getState().removeTransactions(['b'])
    markLocalChange(['transactions'])
    await reconcile()
    expect(ids(server.doc)).toEqual(['a'])
  })

  test('offene Änderung überlebt einen Neustart und wird zusammengeführt statt überschrieben', async () => {
    useBudgetStore.setState({ transactions: [tx('a')] })
    await reconcile()
    // „Neustart": nur der gespeicherte Merker sagt noch, dass c nicht hochgeladen ist.
    useBudgetStore.setState({ transactions: [tx('a'), tx('c')] })
    useCloudMeta.setState({ dirty: true, changedAt: { ...emptyChangedAt(), transactions: new Date().toISOString() } })
    const base = server.doc as { budget: object }
    server.doc = { ...base, budget: { ...base.budget, transactions: [tx('a'), tx('b')] } }
    server.revision += 1
    await reconcile()
    expect(ids(server.doc)).toEqual(['a', 'b', 'c'])
    expect(useCloudMeta.getState().dirty).toBe(false)
  })

  test('niedrigere Cloud-Revision: lokale Daten bleiben und werden wieder eingebracht', async () => {
    useBudgetStore.setState({ transactions: [tx('a')] })
    await reconcile()
    useCloudMeta.setState({ revision: 5 })
    await reconcile()
    expect(useBudgetStore.getState().transactions.map((t) => t.id)).toEqual(['a'])
    expect(ids(server.doc)).toEqual(['a'])
    expect(useCloudMeta.getState().revision).toBe(server.revision)
  })

  test('eigener Stand nach verlorener Upload-Antwort: zusammenführen statt ersetzen', async () => {
    useBudgetStore.setState({ transactions: [tx('a')] })
    await reconcile()
    server.deviceId = useCloudMeta.getState().deviceId
    useCloudMeta.setState({ revision: null })
    useBudgetStore.setState({ transactions: [tx('a'), tx('neu')] })
    await reconcile()
    expect(ids(server.doc)).toEqual(['a', 'neu'])
    expect(mem.get(PRE_PAIRING_BACKUP_KEY)).toBeUndefined()
  })

  test('Änderung während des ersten Ladens zählt (nach der Start-Schonfrist)', async () => {
    useBudgetStore.setState({ transactions: [tx('a')] })
    await reconcile()
    markLocalChange(['transactions'])
    expect(useCloudMeta.getState().dirty).toBe(true)
  })

  test('Änderung in der Start-Schonfrist zählt nicht (Aufräumarbeiten der App)', async () => {
    startEngineClock(Date.now())
    markLocalChange(['transactions'])
    expect(useCloudMeta.getState().dirty).toBe(false)
  })

  test('zurückgesetzte Cloud (niedrigere Revision): eigener Stand wird wieder eingebracht', async () => {
    useBudgetStore.setState({ transactions: [tx('a'), tx('b')] })
    await reconcile()
    await reconcile()
    useCloudMeta.setState({ revision: 7 })
    server.revision = 0
    server.doc = null
    await reconcile()
    expect(ids(server.doc)).toEqual(['a', 'b'])
    expect(useCloudMeta.getState().revision).toBe(1)
  })
})

