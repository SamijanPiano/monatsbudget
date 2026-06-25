import { useState } from 'react'
import { euroPlain, parseEuroCents } from '../../lib/euro'

interface CentInputProps {
  /** Aktueller Wert in Cent (null = leer/unbekannt). */
  value: number | null
  disabled?: boolean
  ariaLabel?: string
  placeholder?: string
  /** Beim Verlassen des Feldes: geparster Cent-Wert (null = leer). */
  onCommit: (cents: number | null) => void
}

/**
 * Geld-Eingabefeld auf Cent-Basis (für Budgets, Kontostände). Während des
 * Tippens gilt ein lokaler Entwurf; beim Blur wird über `parseEuroCents`
 * geparst. Negative Beträge (z. B. Schulden) sind erlaubt.
 */
export function CentInput({
  value,
  disabled,
  ariaLabel = 'Betrag',
  placeholder = '—',
  onCommit,
}: CentInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? (value != null ? euroPlain(value) : '')

  return (
    <div className="num-input num-input--sm">
      <input
        type="text"
        inputMode="decimal"
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onFocus={(e) => {
          setDraft(value != null ? euroPlain(value) : '')
          e.target.select()
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onCommit(parseEuroCents(draft ?? ''))
          setDraft(null)
        }}
      />
      <span className="num-input__suffix" aria-hidden="true">
        €
      </span>
    </div>
  )
}
