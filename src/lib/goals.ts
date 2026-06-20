// Reine Ziel-Mathematik — keine Seiteneffekte, keine UI.
import type { Goal } from '../types/budget'
import { round2 } from './calc'

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/** Fortschritt 0..1. save/buffer: erreicht/Ziel · debt: abgebauter Anteil. */
export function progressRatio(goal: Goal): number {
  if (goal.type === 'overview' || goal.targetAmount <= 0) return 0
  if (goal.type === 'debt') {
    const paid = goal.targetAmount - goal.currentAmount
    return clamp01(paid / goal.targetAmount)
  }
  return clamp01(goal.currentAmount / goal.targetAmount)
}

/** Volle Monate von heute bis zur Frist „YYYY-MM" (nie negativ). */
export function monthsUntil(deadline: string, today: Date = new Date()): number {
  const [y, m] = deadline.split('-').map(Number)
  if (!y || !m) return 0
  const months = (y - today.getFullYear()) * 12 + (m - (today.getMonth() + 1))
  return Math.max(0, months)
}

/** Empfohlene Monatsrate, um das Ziel bis zur Frist zu erreichen. 0 ohne Frist/Restbetrag. */
export function recommendedMonthlyRate(goal: Goal, today: Date = new Date()): number {
  if (goal.type === 'overview') return 0
  const remaining = goal.type === 'debt' ? goal.currentAmount : goal.targetAmount - goal.currentAmount
  if (remaining <= 0) return 0
  if (!goal.deadline) return 0
  const months = monthsUntil(goal.deadline, today)
  if (months <= 0) return round2(remaining)
  return round2(remaining / months)
}
