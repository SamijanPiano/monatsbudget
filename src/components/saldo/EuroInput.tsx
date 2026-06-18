import { useState } from 'react'
import { euroPlain, parseEuroCents } from '../../lib/euro'

interface EuroInputProps {
  /** Wert in Cent (oder null = leer) */
  value: number | null
  onCommit: (cents: number | null) => void
  ariaLabel: string
  placeholder?: string
  className?: string
}

/**
 * Geld-Eingabe in Cent. Übernimmt den geparsten Wert direkt bei jeder Eingabe
 * (wie die Budget-Eingabe); ohne Fokus wird der Cent-Wert formatiert angezeigt.
 */
export function EuroInput({
  value,
  onCommit,
  ariaLabel,
  placeholder = '0,00',
  className = '',
}: EuroInputProps) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)

  const display = focused ? draft : value != null ? euroPlain(value) : ''

  return (
    <span className={`sal-eurofield ${className}`.trim()}>
      <span className="sal-eurofield__cur" aria-hidden="true">
        €
      </span>
      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        value={display}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onFocus={(e) => {
          setDraft(value != null ? euroPlain(value) : '')
          setFocused(true)
          e.target.select()
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setDraft(e.target.value)
          onCommit(parseEuroCents(e.target.value))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
    </span>
  )
}
