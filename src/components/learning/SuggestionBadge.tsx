// Wiederverwendbares Vorschlags-Badge: zeigt „vorgeschlagen · 92 %" mit
// Bestätigen/Verwerfen. Die sichtbare Wahrscheinlichkeit ist bewusst Teil der UI.

interface SuggestionBadgeProps {
  /** Anzuzeigender Vorschlagstext, z. B. der Kategoriename. */
  label: string
  /** Konfidenz 0..1. */
  confidence: number
  /** 'autofill' = bereits vorausgefüllt (bestätigen optional), 'suggest' = anbieten. */
  mode: 'autofill' | 'suggest'
  onConfirm: () => void
  onDismiss: () => void
}

export function SuggestionBadge({
  label,
  confidence,
  mode,
  onConfirm,
  onDismiss,
}: SuggestionBadgeProps) {
  const percent = Math.round(confidence * 100)
  const prefix = mode === 'autofill' ? 'vorausgefüllt' : 'vorgeschlagen'

  return (
    <span className={`suggestion-badge suggestion-badge--${mode}`}>
      <button
        type="button"
        className="suggestion-badge__confirm"
        onClick={onConfirm}
        title="Vorschlag übernehmen"
      >
        {prefix} · {label} · {percent}%
      </button>
      <button
        type="button"
        className="suggestion-badge__dismiss"
        onClick={onDismiss}
        aria-label="Vorschlag verwerfen"
      >
        ×
      </button>
    </span>
  )
}
