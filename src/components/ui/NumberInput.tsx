import { useState } from 'react'
import { parseAmount, toEditString } from '../../lib/parse'

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  channel?: 'konto' | 'bar'
  ariaLabel?: string
  id?: string
  placeholder?: string
  size?: 'sm' | 'md'
}

/**
 * Geld-Eingabefeld mit €-Suffix. Während des Tippens gilt der lokale
 * Editierstring; ohne Fokus wird der Wert aus dem Store formatiert angezeigt.
 * Kein Sync-Effekt nötig — das vermeidet Doppel-Renders.
 */
export function NumberInput({
  value,
  onChange,
  channel,
  ariaLabel,
  id,
  placeholder = '0',
  size = 'md',
}: NumberInputProps) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)

  const display = focused ? draft : toEditString(value)
  const channelClass = channel ? `num-input--${channel}` : ''

  return (
    <div className={`num-input num-input--${size} ${channelClass}`.trim()}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onFocus={(e) => {
          setDraft(toEditString(value))
          setFocused(true)
          e.target.select()
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setDraft(e.target.value)
          onChange(parseAmount(e.target.value))
        }}
      />
      <span className="num-input__suffix" aria-hidden="true">
        €
      </span>
    </div>
  )
}
