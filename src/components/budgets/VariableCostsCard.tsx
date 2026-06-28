import { useState } from 'react'
import { useBudgetStore, useCashEnabled } from '../../store/budgetStore'
import type { LineItem } from '../../types/budget'
import { Card, SectionTitle } from '../ui/Card'
import { formatMoney } from '../../lib/format'
import { parseEuroCents } from '../../lib/euro'
import { IconPlus, IconTrash } from '../ui/icons'

/**
 * Eingabe der geplanten variablen Kosten des aktiven Monats (Month.variable).
 * Beträge sind Euro-basiert (LineItem), getrennt von den importierten Buchungen.
 */
export function VariableCostsCard() {
  const month = useBudgetStore((s) => s.months[s.activeMonthId])
  const addItem = useBudgetStore((s) => s.addItem)
  const cashEnabled = useCashEnabled()

  const items = month?.variable ?? []
  const total = items.reduce((sum, it) => sum + it.konto + (cashEnabled ? it.bar : 0), 0)

  return (
    <Card>
      <SectionTitle title="Variable Kosten" hint="Geplante variable Ausgaben diesen Monat" />

      {items.length === 0 ? (
        <p className="empty__text" style={{ marginTop: 'var(--space-2)' }}>
          Noch keine variablen Kosten. Trage deine geplanten Ausgaben ein (z. B. Lebensmittel,
          Freizeit, Tanken).
        </p>
      ) : (
        <div className="varcost-list">
          {items.map((it) => (
            <VariableCostRow key={it.id} item={it} cashEnabled={cashEnabled} />
          ))}
        </div>
      )}

      <div className="varcost-foot">
        <button type="button" className="varcost-add" onClick={() => addItem('variable')}>
          <IconPlus size={16} /> Variable Kosten hinzufügen
        </button>
        {items.length > 0 && (
          <span className="varcost-total">
            Summe <strong className="tnum">{formatMoney(total)}</strong>
          </span>
        )}
      </div>
    </Card>
  )
}

function VariableCostRow({ item, cashEnabled }: { item: LineItem; cashEnabled: boolean }) {
  const updateItem = useBudgetStore((s) => s.updateItem)
  const removeItem = useBudgetStore((s) => s.removeItem)
  const [label, setLabel] = useState(item.label)

  const commitLabel = () => {
    const trimmed = label.trim()
    if (trimmed !== item.label) updateItem('variable', item.id, { label: trimmed })
  }

  return (
    <div className="varcost-row">
      <input
        className="varcost-name"
        value={label}
        aria-label="Bezeichnung"
        placeholder="z. B. Lebensmittel"
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitLabel}
      />
      <EuroInput
        value={item.konto}
        ariaLabel={`Betrag ${item.label || 'variable Kosten'}`}
        onCommit={(euros) => updateItem('variable', item.id, { konto: euros })}
      />
      {cashEnabled && (
        <EuroInput
          value={item.bar}
          ariaLabel={`Bar-Betrag ${item.label || 'variable Kosten'}`}
          onCommit={(euros) => updateItem('variable', item.id, { bar: euros })}
        />
      )}
      <button
        type="button"
        className="varcost-del"
        aria-label="Posten löschen"
        onClick={() => removeItem('variable', item.id)}
      >
        <IconTrash size={16} />
      </button>
    </div>
  )
}

interface EuroInputProps {
  value: number
  ariaLabel: string
  onCommit: (euros: number) => void
}

/** Euro-Eingabe (LineItem ist Euro-basiert). Parst deutsche Schreibweise. */
function EuroInput({ value, ariaLabel, onCommit }: EuroInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const formatted = value
    ? value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : ''
  const display = draft ?? formatted

  return (
    <div className="num-input num-input--sm">
      <input
        type="text"
        inputMode="decimal"
        value={display}
        placeholder="0,00"
        aria-label={ariaLabel}
        onFocus={(e) => {
          setDraft(formatted)
          e.target.select()
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const cents = parseEuroCents(draft ?? '')
          onCommit(cents == null ? 0 : cents / 100)
          setDraft(null)
        }}
      />
      <span className="num-input__suffix" aria-hidden="true">
        €
      </span>
    </div>
  )
}
