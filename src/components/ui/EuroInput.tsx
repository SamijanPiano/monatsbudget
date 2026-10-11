import { useState } from 'react'
import { parseEuroCents } from '../../lib/euro'

interface EuroInputProps {
  /** Aktueller Wert in Euro (LineItem und Monatsplan sind Euro-basiert). */
  value: number
  ariaLabel: string
  onCommit: (euros: number) => void
}

/**
 * Euro-Eingabe für den Monatsplan. Während des Tippens gilt ein lokaler
 * Entwurf; beim Blur wird die deutsche Schreibweise geparst. Leer = 0.
 */
export function EuroInput({ value, ariaLabel, onCommit }: EuroInputProps) {
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
