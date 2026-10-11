import { useMemo, useState } from 'react'
import { useLearningStore } from '../../store/learningStore'
import type { PlanSection } from '../../lib/plan'
import { formatMoney } from '../../lib/format'
import { IconTrash } from '../ui/icons'
import { EuroInput } from '../ui/EuroInput'
import { useSuggestion } from '../../hooks/useSuggestion'
import { amountPredictor, type AmountContext } from '../../lib/learning/amountPredictor'
import { itemCreatedEvent } from '../../lib/learning/events'
import { SuggestionBadge } from '../learning/SuggestionBadge'

interface PlanItemRowProps {
  section: PlanSection
  label: string
  /** Betrag in Euro */
  amount: number
  placeholder: string
  onChange: (patch: { label?: string; amount?: number }) => void
  onRemove: () => void
}

/**
 * Eine Zeile: Bezeichnung und Betrag. Ein Betragsvorschlag aus früheren
 * gleichnamigen Posten erscheint, solange der Betrag leer ist.
 */
export function PlanItemRow({
  section,
  label,
  amount,
  placeholder,
  onChange,
  onRemove,
}: PlanItemRowProps) {
  const [draftLabel, setDraftLabel] = useState(label)

  // Stabile ctx-Identität, damit useSuggestion nur bei echten Änderungen neu rechnet.
  const suggestionCtx: AmountContext = useMemo(() => ({ labelKey: label, section }), [label, section])
  const { top, mode, accept, dismiss } = useSuggestion({
    predictor: amountPredictor,
    ctx: suggestionCtx,
    surface: 'item',
  })

  const commitLabel = () => {
    const trimmed = draftLabel.trim()
    if (trimmed !== label) onChange({ label: trimmed })
  }

  // Betrag committen und als Cent-Signal für die Lern-Schicht ablegen.
  const commitAmount = (euros: number) => {
    onChange({ amount: euros })
    const cents = Math.round(euros * 100)
    if (label.trim() !== '' && cents !== 0) {
      useLearningStore.getState().record(itemCreatedEvent({ label }, section, cents, null, false))
    }
  }

  const applySuggestion = () => {
    if (!top) return
    onChange({ amount: top.value / 100 })
    accept(top.value)
  }

  const showSuggestion = amount === 0 && label.trim() !== '' && mode !== 'none' && top !== null
  const name = label || placeholder

  return (
    <div className="varcost-row-wrap">
      <div className="plan-row">
        <input
          className="varcost-name"
          value={draftLabel}
          aria-label="Bezeichnung"
          placeholder={placeholder}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={commitLabel}
        />
        <EuroInput value={amount} ariaLabel={`Betrag ${name}`} onCommit={commitAmount} />
        <button
          type="button"
          className="varcost-del"
          aria-label={`${name} löschen`}
          onClick={onRemove}
        >
          <IconTrash size={16} />
        </button>
      </div>
      {showSuggestion && (
        <div className="varcost-suggestion">
          <SuggestionBadge
            label={formatMoney(top.value / 100)}
            confidence={top.confidence}
            mode={mode === 'autofill' ? 'autofill' : 'suggest'}
            onConfirm={applySuggestion}
            onDismiss={dismiss}
          />
        </div>
      )}
    </div>
  )
}
