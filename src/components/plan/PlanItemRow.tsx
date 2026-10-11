import { useMemo, useState } from 'react'
import { useBudgetStore, type Section } from '../../store/budgetStore'
import { useLearningStore } from '../../store/learningStore'
import type { LineItem } from '../../types/budget'
import { formatMoney } from '../../lib/format'
import { IconTrash } from '../ui/icons'
import { EuroInput } from '../ui/EuroInput'
import { useSuggestion } from '../../hooks/useSuggestion'
import { amountPredictor, type AmountContext } from '../../lib/learning/amountPredictor'
import { itemCreatedEvent } from '../../lib/learning/events'
import { SuggestionBadge } from '../learning/SuggestionBadge'

interface PlanItemRowProps {
  section: Section
  item: LineItem
  /** Bar-Spalte anzeigen (Bar-Kanal aktiv und Bereich kennt Bargeld). */
  showBar: boolean
  placeholder: string
}

/**
 * Eine Zeile im Monatsplan: Bezeichnung, Konto-Betrag, optional Bar-Betrag.
 * Beträge sind Euro-basiert (LineItem). Ein Betragsvorschlag aus früheren
 * gleichnamigen Posten erscheint, solange der Konto-Betrag leer ist.
 */
export function PlanItemRow({ section, item, showBar, placeholder }: PlanItemRowProps) {
  const updateItem = useBudgetStore((s) => s.updateItem)
  const removeItem = useBudgetStore((s) => s.removeItem)
  const [label, setLabel] = useState(item.label)

  // Stabile ctx-Identität, damit useSuggestion nur bei echten Änderungen neu rechnet.
  const suggestionCtx: AmountContext = useMemo(
    () => ({ labelKey: item.label, section }),
    [item.label, section],
  )
  const { top, mode, accept, dismiss } = useSuggestion({
    predictor: amountPredictor,
    ctx: suggestionCtx,
    surface: 'item',
  })

  const commitLabel = () => {
    const trimmed = label.trim()
    if (trimmed !== item.label) updateItem(section, item.id, { label: trimmed })
  }

  // Betrag committen (in Euro) und als Cent-Signal für die Lern-Schicht ablegen.
  const commitKonto = (euros: number) => {
    updateItem(section, item.id, { konto: euros })
    const cents = Math.round(euros * 100)
    if (item.label.trim() !== '' && cents !== 0) {
      useLearningStore.getState().record(itemCreatedEvent(item, section, cents, null, false))
    }
  }

  const applySuggestion = () => {
    if (!top) return
    updateItem(section, item.id, { konto: top.value / 100 })
    accept(top.value)
  }

  const showSuggestion =
    item.konto === 0 && item.label.trim() !== '' && mode !== 'none' && top !== null
  const name = item.label || placeholder

  return (
    <div className="varcost-row-wrap">
      <div className={`plan-row${showBar ? ' plan-row--dual' : ''}`}>
        <input
          className="varcost-name plan-row__name"
          value={label}
          aria-label="Bezeichnung"
          placeholder={placeholder}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
        />
        <div className="plan-row__konto">
          <EuroInput value={item.konto} ariaLabel={`Konto-Betrag ${name}`} onCommit={commitKonto} />
        </div>
        {showBar && (
          <div className="plan-row__bar">
            <EuroInput
              value={item.bar}
              ariaLabel={`Bar-Betrag ${name}`}
              onCommit={(euros) => updateItem(section, item.id, { bar: euros })}
            />
          </div>
        )}
        <button
          type="button"
          className="varcost-del plan-row__del"
          aria-label={`${name} löschen`}
          onClick={() => removeItem(section, item.id)}
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
