import { useMemo } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import { useLearningStore } from '../../store/learningStore'
import { useSuggestion } from '../../hooks/useSuggestion'
import {
  recurringPredictor,
  type RecurringContext,
  type RecurringPrediction,
} from '../../lib/learning/recurringPredictor'
import { recurringConfirmedEvent } from '../../lib/learning/events'
import { SuggestionBadge } from '../learning/SuggestionBadge'
import { formatCents } from '../../lib/format'

interface RecurringForecastProps {
  contractId: string
  counterparty: string
}

/** DD.MM. aus einem YYYY-MM-DD-Datum. */
function dayMonth(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`
}

/**
 * Zeigt für einen Vertrag die aus echten Buchungen vorhergesagte nächste
 * Fälligkeit + Betrag an. Beim Bestätigen wird der Vertrag aktualisiert und ein
 * recurring-confirmed-Signal abgelegt.
 */
export function RecurringForecast({ contractId, counterparty }: RecurringForecastProps) {
  const transactions = useBudgetStore((s) => s.transactions)
  const updateContract = useBudgetStore((s) => s.updateContract)

  // Stabile ctx-Identität, damit useSuggestion nur bei echten Änderungen neu rechnet.
  const ctx: RecurringContext = useMemo(
    () => ({ counterpartyKey: counterparty, transactions }),
    [counterparty, transactions],
  )
  const { top, mode, accept, dismiss } = useSuggestion({
    predictor: recurringPredictor,
    ctx,
    surface: 'recurring',
    serialize: (v: RecurringPrediction) => `${v.nextDue}:${v.amountCent}`,
  })

  if (mode === 'none' || top === null) return null

  const prediction = top.value
  const apply = (): void => {
    updateContract(contractId, {
      nextDue: prediction.nextDue,
      amountApprox: -Math.abs(prediction.amountCent),
    })
    useLearningStore
      .getState()
      .record(recurringConfirmedEvent(counterparty, prediction.amountCent, prediction.dayOfMonth))
    accept(prediction)
  }

  const label = `nächste ${dayMonth(prediction.nextDue)} · ${formatCents(Math.abs(prediction.amountCent))}`

  return (
    <div className="contract-row__forecast">
      <SuggestionBadge
        label={label}
        confidence={top.confidence}
        mode={mode === 'autofill' ? 'autofill' : 'suggest'}
        onConfirm={apply}
        onDismiss={dismiss}
      />
    </div>
  )
}
