import { describe, it, expect } from 'vitest'
import { budgetStatus, WARN_RATIO } from './budgets'

describe('budgetStatus', () => {
  it('ist ok deutlich unter dem Limit', () => {
    const s = budgetStatus(5000, 20000)
    expect(s.health).toBe('ok')
    expect(s.ratio).toBeCloseTo(0.25)
  })

  it('warnt ab der Schwelle (WARN_RATIO) unterhalb des Limits', () => {
    // genau 80 % von 20000 = 16000
    const s = budgetStatus(16000, 20000)
    expect(WARN_RATIO).toBe(0.8)
    expect(s.health).toBe('warn')
  })

  it('ist ok knapp unter der Warnschwelle', () => {
    const s = budgetStatus(15999, 20000)
    expect(s.health).toBe('ok')
  })

  it('ist over, sobald die Ausgaben das Budget übersteigen', () => {
    const s = budgetStatus(20001, 20000)
    expect(s.health).toBe('over')
    expect(s.ratio).toBeGreaterThan(1)
  })

  it('genau auf dem Limit ist warn, nicht over', () => {
    const s = budgetStatus(20000, 20000)
    expect(s.health).toBe('warn')
  })

  it('ohne Budget (0) immer ok, ratio 0', () => {
    const s = budgetStatus(5000, 0)
    expect(s.health).toBe('ok')
    expect(s.ratio).toBe(0)
    expect(s.budget).toBe(0)
  })

  it('negatives Budget wird wie 0 behandelt', () => {
    const s = budgetStatus(100, -500)
    expect(s.budget).toBe(0)
    expect(s.health).toBe('ok')
  })
})
