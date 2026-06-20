import { useReducer } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import {
  initialOnboardingState,
  onboardingReducer,
  currentStep,
  canGoNext,
  visibleSteps,
  buildResult,
} from '../../lib/onboarding'
import {
  StepWelcome,
  StepGoals,
  StepCash,
  StepQuickstart,
  StepGoalSetup,
  StepDone,
} from './OnboardingSteps'

export function OnboardingWizard() {
  const completeOnboarding = useBudgetStore((s) => s.completeOnboarding)
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState())

  const step = currentStep(state)
  const steps = visibleSteps(state)
  const ok = canGoNext(state)

  function handleFinish() {
    completeOnboarding(buildResult(state))
  }

  const stepProps = { state, dispatch, onFinish: handleFinish, canGoNext: ok }

  return (
    <div className="wizard" role="dialog" aria-modal="true" aria-label="Einrichtungsassistent">
      <div className="wizard__progress" aria-hidden="true">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`wizard__dot${i <= state.stepIndex ? ' wizard__dot--active' : ''}`}
          />
        ))}
      </div>

      <div className="wizard__body">
        {step === 'welcome' && <StepWelcome {...stepProps} />}
        {step === 'goals' && <StepGoals {...stepProps} />}
        {step === 'cash' && <StepCash {...stepProps} />}
        {step === 'quickstart' && <StepQuickstart {...stepProps} />}
        {step === 'goalsetup' && <StepGoalSetup {...stepProps} />}
        {step === 'done' && <StepDone {...stepProps} />}
      </div>
    </div>
  )
}
