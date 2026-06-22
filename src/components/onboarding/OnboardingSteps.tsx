import type { Dispatch } from 'react'
import type { OnboardingAction, OnboardingState, GoalChoice } from '../../lib/onboarding'
import { IconTarget, IconTrendingDown, IconShield, IconEye, IconWallet, IconSparkles } from '../ui/icons'
import { NumberInput } from '../ui/NumberInput'
import { ImportButton } from '../transactions/ImportButton'

interface StepProps {
  state: OnboardingState
  dispatch: Dispatch<OnboardingAction>
  onFinish: () => void
  canGoNext: boolean
}

const GOAL_OPTIONS: { value: GoalChoice; label: string; sub: string; icon: React.ReactNode }[] = [
  { value: 'save', label: 'Sparziel', sub: 'Ich spare auf etwas hin', icon: <IconTarget size={28} /> },
  { value: 'debt', label: 'Schulden abbauen', sub: 'Ich möchte Kredite tilgen', icon: <IconTrendingDown size={28} /> },
  { value: 'buffer', label: 'Notgroschen', sub: 'Ich baue einen Puffer auf', icon: <IconShield size={28} /> },
  { value: 'overview', label: 'Überblick', sub: 'Ich will wissen, wohin mein Geld geht', icon: <IconEye size={28} /> },
]

export function StepWelcome({ dispatch }: StepProps) {
  return (
    <div className="wizard-step wizard-step--center">
      <div className="wizard-step__hero">
        <IconSparkles size={56} className="wizard-step__hero-icon" />
      </div>
      <h1 className="wizard-step__title">Willkommen bei Monatsbudget</h1>
      <p className="wizard-step__sub">
        Behalte deine Finanzen im Blick — einfach, persönlich und ohne Abo.
        Lass uns kurz einrichten, was für dich wichtig ist.
      </p>
      <button
        type="button"
        className="wizard-btn wizard-btn--primary"
        onClick={() => dispatch({ kind: 'next' })}
      >
        Los geht's
      </button>
    </div>
  )
}

export function StepGoals({ state, dispatch, canGoNext: ok }: StepProps) {
  return (
    <div className="wizard-step">
      <h2 className="wizard-step__title">Was ist dein Ziel?</h2>
      <p className="wizard-step__sub">Wähle alles, was auf dich zutrifft.</p>

      <div className="goal-grid">
        {GOAL_OPTIONS.map((opt) => {
          const active = state.goalChoices.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              className={`goal-card ${active ? 'goal-card--active' : ''}`}
              onClick={() => dispatch({ kind: 'toggleGoal', goal: opt.value })}
              aria-pressed={active}
            >
              <span className="goal-card__icon">{opt.icon}</span>
              <span className="goal-card__label">{opt.label}</span>
              <span className="goal-card__sub">{opt.sub}</span>
            </button>
          )
        })}
      </div>

      <div className="wizard-nav">
        <button type="button" className="wizard-btn wizard-btn--ghost" onClick={() => dispatch({ kind: 'back' })}>
          Zurück
        </button>
        <button type="button" className="wizard-btn wizard-btn--primary" disabled={!ok} onClick={() => dispatch({ kind: 'next' })}>
          Weiter
        </button>
      </div>
    </div>
  )
}

export function StepCash({ state, dispatch }: StepProps) {
  return (
    <div className="wizard-step">
      <h2 className="wizard-step__title">Zahlst du auch mit Bargeld?</h2>
      <p className="wizard-step__sub">
        Im Einfach-Modus reicht dein Konto. Bar-Tracking aktivierst du nur, wenn du regelmäßig mit Cash zahlst.
      </p>

      <div className="cash-options">
        <button
          type="button"
          className={`cash-option ${!state.cashEnabled ? 'cash-option--active' : ''}`}
          onClick={() => dispatch({ kind: 'setCash', value: false })}
          aria-pressed={!state.cashEnabled}
        >
          <span className="cash-option__icon"><IconWallet size={28} /></span>
          <span className="cash-option__label">Nur Konto</span>
          <span className="cash-option__sub">Überweisung & Karte</span>
        </button>
        <button
          type="button"
          className={`cash-option ${state.cashEnabled ? 'cash-option--active' : ''}`}
          onClick={() => dispatch({ kind: 'setCash', value: true })}
          aria-pressed={state.cashEnabled}
        >
          <span className="cash-option__icon">💵</span>
          <span className="cash-option__label">Konto + Bar</span>
          <span className="cash-option__sub">Ich zahle auch mit Scheinen</span>
        </button>
      </div>

      <div className="wizard-nav">
        <button type="button" className="wizard-btn wizard-btn--ghost" onClick={() => dispatch({ kind: 'back' })}>
          Zurück
        </button>
        <button type="button" className="wizard-btn wizard-btn--primary" onClick={() => dispatch({ kind: 'next' })}>
          Weiter
        </button>
      </div>
    </div>
  )
}

export function StepQuickstart({ state, dispatch }: StepProps) {
  return (
    <div className="wizard-step">
      <h2 className="wizard-step__title">Schnellstart</h2>
      <p className="wizard-step__sub">
        Am einfachsten: Bankauszug (CSV oder CAMT.053-XML) importieren — die App füllt
        Buchungen, Kategorien und die Prognose automatisch. Es verlassen keine Daten dein Gerät.
      </p>
      <div className="wizard-import">
        <ImportButton />
      </div>

      <p className="wizard-step__sub wizard-step__sub--divider">
        … oder trag deine Eckdaten von Hand ein (optional):
      </p>

      <div className="quickstart-section">
        <label className="quickstart-label">Monatliches Einkommen</label>
        <NumberInput
          value={state.income}
          onChange={(v) => dispatch({ kind: 'setIncome', value: v })}
          channel="konto"
        />
      </div>

      <div className="quickstart-section">
        <div className="quickstart-expenses-header">
          <label className="quickstart-label">Variable Ausgaben</label>
          <button type="button" className="wizard-btn wizard-btn--ghost wizard-btn--sm" onClick={() => dispatch({ kind: 'addExpense' })}>
            + Hinzufügen
          </button>
        </div>
        {state.expenses.map((exp, i) => (
          <div key={i} className="quickstart-expense-row">
            <input
              className="quickstart-input"
              type="text"
              value={exp.label}
              onChange={(e) => dispatch({ kind: 'setExpense', index: i, patch: { label: e.target.value } })}
              placeholder="Bezeichnung"
              aria-label="Bezeichnung der Ausgabe"
            />
            <NumberInput
              value={exp.amount}
              onChange={(v) => dispatch({ kind: 'setExpense', index: i, patch: { amount: v } })}
              channel="konto"
            />
            {state.expenses.length > 1 && (
              <button
                type="button"
                className="quickstart-remove"
                onClick={() => dispatch({ kind: 'removeExpense', index: i })}
                aria-label="Ausgabe entfernen"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="wizard-nav">
        <button type="button" className="wizard-btn wizard-btn--ghost" onClick={() => dispatch({ kind: 'back' })}>
          Zurück
        </button>
        <button type="button" className="wizard-btn wizard-btn--primary" onClick={() => dispatch({ kind: 'next' })}>
          Weiter
        </button>
      </div>
    </div>
  )
}

export function StepGoalSetup({ state, dispatch }: StepProps) {
  return (
    <div className="wizard-step">
      <h2 className="wizard-step__title">Deine Ziele einrichten</h2>
      <p className="wizard-step__sub">Gib deinen Zielen konkrete Zahlen — alles ist später anpassbar.</p>

      <div className="goal-drafts">
        {state.goalDrafts.map((draft, i) => (
          <div key={draft.type} className="goal-draft">
            <div className="goal-draft__header">
              <span className="goal-draft__type">
                {draft.type === 'save' && '🎯 Sparziel'}
                {draft.type === 'debt' && '📉 Schuldenabbau'}
                {draft.type === 'buffer' && '🛡️ Notgroschen'}
              </span>
            </div>
            <div className="goal-draft__fields">
              <div className="quickstart-section">
                <label className="quickstart-label">Bezeichnung</label>
                <input
                  className="quickstart-input"
                  type="text"
                  value={draft.label}
                  onChange={(e) => dispatch({ kind: 'setGoalDraft', index: i, patch: { label: e.target.value } })}
                  placeholder="z. B. Japan-Reise"
                />
              </div>
              <div className="goal-draft__amounts">
                <div className="quickstart-section">
                  <label className="quickstart-label">
                    {draft.type === 'debt' ? 'Schuldenstand' : 'Zielbetrag'}
                  </label>
                  <NumberInput
                    value={draft.type === 'debt' ? draft.currentAmount : draft.targetAmount}
                    onChange={(v) =>
                      dispatch({
                        kind: 'setGoalDraft',
                        index: i,
                        patch: draft.type === 'debt' ? { currentAmount: v, targetAmount: v } : { targetAmount: v },
                      })
                    }
                    channel="konto"
                  />
                </div>
                {draft.type !== 'debt' && (
                  <div className="quickstart-section">
                    <label className="quickstart-label">Bereits gespart</label>
                    <NumberInput
                      value={draft.currentAmount}
                      onChange={(v) => dispatch({ kind: 'setGoalDraft', index: i, patch: { currentAmount: v } })}
                      channel="konto"
                    />
                  </div>
                )}
              </div>
              <div className="quickstart-section">
                <label className="quickstart-label">Frist (optional)</label>
                <input
                  className="quickstart-input"
                  type="month"
                  value={draft.deadline}
                  onChange={(e) => dispatch({ kind: 'setGoalDraft', index: i, patch: { deadline: e.target.value } })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="wizard-nav">
        <button type="button" className="wizard-btn wizard-btn--ghost" onClick={() => dispatch({ kind: 'back' })}>
          Zurück
        </button>
        <button type="button" className="wizard-btn wizard-btn--primary" onClick={() => dispatch({ kind: 'next' })}>
          Weiter
        </button>
      </div>
    </div>
  )
}

export function StepDone({ onFinish }: StepProps) {
  return (
    <div className="wizard-step wizard-step--center">
      <div className="wizard-step__hero">
        <span className="wizard-step__done-emoji">🎉</span>
      </div>
      <h2 className="wizard-step__title">Alles bereit!</h2>
      <p className="wizard-step__sub">
        Deine App ist eingerichtet. Du kannst jederzeit alles in den Einstellungen anpassen.
      </p>
      <button type="button" className="wizard-btn wizard-btn--primary" onClick={onFinish}>
        App starten
      </button>
    </div>
  )
}
