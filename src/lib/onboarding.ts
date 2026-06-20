// Reine Wizard-Logik: State, Reducer, Navigation, Ergebnis-Bau. Keine UI.
import type { Goal, GoalType } from '../types/budget'
import { createId } from './id'

export type GoalChoice = GoalType // 'save' | 'debt' | 'buffer' | 'overview'
export type TargetGoalType = 'save' | 'debt' | 'buffer'

export const WIZARD_STEPS = ['welcome', 'goals', 'cash', 'quickstart', 'goalsetup', 'done'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

export interface QuickStartExpense { label: string; amount: number }

export interface GoalDraft {
  type: TargetGoalType
  label: string
  targetAmount: number
  currentAmount: number
  deadline: string // '' = keine Frist
}

export interface OnboardingState {
  stepIndex: number
  goalChoices: GoalChoice[]
  cashEnabled: boolean
  income: number
  expenses: QuickStartExpense[]
  goalDrafts: GoalDraft[]
}

export interface OnboardingResult {
  cashEnabled: boolean
  goals: Goal[]
  income: number
  expenses: QuickStartExpense[]
}

const DEFAULT_LABEL: Record<TargetGoalType, string> = {
  save: 'Mein Sparziel',
  debt: 'Meine Schulden',
  buffer: 'Notgroschen',
}

export function initialOnboardingState(): OnboardingState {
  return {
    stepIndex: 0,
    goalChoices: [],
    cashEnabled: false,
    income: 0,
    expenses: [
      { label: 'Lebensmittel', amount: 0 },
      { label: 'Freizeit', amount: 0 },
    ],
    goalDrafts: [],
  }
}

function isTarget(choice: GoalChoice): choice is TargetGoalType {
  return choice === 'save' || choice === 'debt' || choice === 'buffer'
}

export function hasTargetGoals(state: OnboardingState): boolean {
  return state.goalChoices.some(isTarget)
}

/** Sichtbare Schritte — „goalsetup" entfällt ohne ziel-tragende Ziele. */
export function visibleSteps(state: OnboardingState): WizardStep[] {
  return WIZARD_STEPS.filter((s) => s !== 'goalsetup' || hasTargetGoals(state))
}

export function currentStep(state: OnboardingState): WizardStep {
  return visibleSteps(state)[state.stepIndex] ?? 'done'
}

export function canGoNext(state: OnboardingState): boolean {
  if (currentStep(state) === 'goals') return state.goalChoices.length > 0
  return true
}

export type OnboardingAction =
  | { kind: 'next' }
  | { kind: 'back' }
  | { kind: 'toggleGoal'; goal: GoalChoice }
  | { kind: 'setCash'; value: boolean }
  | { kind: 'setIncome'; value: number }
  | { kind: 'setExpense'; index: number; patch: Partial<QuickStartExpense> }
  | { kind: 'addExpense' }
  | { kind: 'removeExpense'; index: number }
  | { kind: 'setGoalDraft'; index: number; patch: Partial<GoalDraft> }

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.kind) {
    case 'next': {
      const max = visibleSteps(state).length - 1
      return { ...state, stepIndex: Math.min(max, state.stepIndex + 1) }
    }
    case 'back':
      return { ...state, stepIndex: Math.max(0, state.stepIndex - 1) }
    case 'setCash':
      return { ...state, cashEnabled: action.value }
    case 'setIncome':
      return { ...state, income: action.value }
    case 'setExpense':
      return {
        ...state,
        expenses: state.expenses.map((e, i) => (i === action.index ? { ...e, ...action.patch } : e)),
      }
    case 'addExpense':
      return { ...state, expenses: [...state.expenses, { label: 'Ausgabe', amount: 0 }] }
    case 'removeExpense':
      return { ...state, expenses: state.expenses.filter((_, i) => i !== action.index) }
    case 'setGoalDraft':
      return {
        ...state,
        goalDrafts: state.goalDrafts.map((d, i) => (i === action.index ? { ...d, ...action.patch } : d)),
      }
    case 'toggleGoal': {
      const has = state.goalChoices.includes(action.goal)
      const goalChoices = has
        ? state.goalChoices.filter((g) => g !== action.goal)
        : [...state.goalChoices, action.goal]
      let goalDrafts = state.goalDrafts
      if (isTarget(action.goal)) {
        if (has) {
          goalDrafts = goalDrafts.filter((d) => d.type !== action.goal)
        } else {
          goalDrafts = [
            ...goalDrafts,
            { type: action.goal, label: DEFAULT_LABEL[action.goal], targetAmount: 0, currentAmount: 0, deadline: '' },
          ]
        }
      }
      return { ...state, goalChoices, goalDrafts }
    }
    default:
      return state
  }
}

export function buildResult(state: OnboardingState, now: Date = new Date()): OnboardingResult {
  const createdAt = now.toISOString()
  const goals: Goal[] = state.goalDrafts.map((d) => {
    const targetAmount = d.type === 'debt' ? Math.max(d.targetAmount, d.currentAmount) : d.targetAmount
    return {
      id: createId(),
      type: d.type,
      label: d.label.trim() || DEFAULT_LABEL[d.type],
      targetAmount,
      currentAmount: d.currentAmount,
      deadline: d.deadline ? d.deadline : undefined,
      createdAt,
    }
  })
  return {
    cashEnabled: state.cashEnabled,
    goals,
    income: state.income,
    expenses: state.expenses.filter((e) => e.amount > 0),
  }
}
