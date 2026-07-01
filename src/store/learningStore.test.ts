import { beforeEach, describe, expect, test, vi } from 'vitest'

// In-Memory-localStorage-Shim für die node-Umgebung (wie saldoStore.test).
const mem = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
})

const { useLearningStore, MAX_SIGNALS, MAX_SIGNAL_AGE_DAYS } = await import('./learningStore')

beforeEach(() => {
  useLearningStore.setState({ signals: [] })
})

describe('learningStore.record', () => {
  test('hängt ein Signal an und vergibt id + ts', () => {
    useLearningStore.getState().record({
      type: 'budget-set',
      categoryId: 'c1',
      amountCent: 5000,
      monthId: '2026-06',
    })
    const signals = useLearningStore.getState().signals
    expect(signals).toHaveLength(1)
    expect(signals[0].id).toBeTruthy()
    expect(signals[0].ts).toBeTruthy()
    expect(signals[0].type).toBe('budget-set')
  })

  test('mutiert das vorhandene Array nicht (immutabel)', () => {
    const before = useLearningStore.getState().signals
    useLearningStore.getState().record({
      type: 'budget-set',
      categoryId: 'c1',
      amountCent: 5000,
      monthId: '2026-06',
    })
    const after = useLearningStore.getState().signals
    expect(after).not.toBe(before)
    expect(before).toHaveLength(0)
  })

  test('deckelt auf MAX_SIGNALS und behält die neuesten', () => {
    for (let i = 0; i < MAX_SIGNALS + 5; i++) {
      useLearningStore.getState().record({
        type: 'budget-set',
        categoryId: `c${i}`,
        amountCent: i,
        monthId: '2026-06',
      })
    }
    const signals = useLearningStore.getState().signals
    expect(signals).toHaveLength(MAX_SIGNALS)
    // ältestes (i=0..4) ist rausgefallen, neuestes ist das letzte
    const last = signals[signals.length - 1]
    expect(last.type === 'budget-set' && last.categoryId).toBe(`c${MAX_SIGNALS + 4}`)
  })
})

describe('learningStore — Alters-Verfall', () => {
  test('record entfernt Signale, die älter als MAX_SIGNAL_AGE_DAYS sind', () => {
    const oldTs = new Date(Date.now() - (MAX_SIGNAL_AGE_DAYS + 10) * 86400000).toISOString()
    const freshTs = new Date().toISOString()
    useLearningStore.setState({
      signals: [
        { id: 'old', ts: oldTs, type: 'budget-set', categoryId: 'a', amountCent: 1, monthId: '2025-01' },
        { id: 'fresh', ts: freshTs, type: 'budget-set', categoryId: 'b', amountCent: 2, monthId: '2026-06' },
      ],
    })
    useLearningStore.getState().record({
      type: 'budget-set',
      categoryId: 'c',
      amountCent: 3,
      monthId: '2026-06',
    })
    const ids = useLearningStore.getState().signals.map((s) => s.id)
    expect(ids).not.toContain('old')
    expect(ids).toContain('fresh')
    expect(useLearningStore.getState().signals).toHaveLength(2)
  })
})

describe('learningStore.clear', () => {
  test('leert das Log', () => {
    useLearningStore.getState().record({
      type: 'budget-set',
      categoryId: 'c1',
      amountCent: 5000,
      monthId: '2026-06',
    })
    useLearningStore.getState().clear()
    expect(useLearningStore.getState().signals).toHaveLength(0)
  })
})
