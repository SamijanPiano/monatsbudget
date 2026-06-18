import { formatMoney } from '../../lib/format'

interface MoneyProps {
  value: number
  /** Färbt positiv/negativ ein (für Salden, Puffer). */
  signed?: boolean
  /** Fester Farbton, z. B. 'konto' | 'bar'. */
  tone?: 'konto' | 'bar' | 'muted' | 'default'
  className?: string
}

export function Money({ value, signed = false, tone = 'default', className = '' }: MoneyProps) {
  const toneClass =
    signed && value < 0
      ? 'text-negative'
      : signed && value > 0
        ? 'text-positive'
        : tone === 'konto'
          ? 'text-konto'
          : tone === 'bar'
            ? 'text-bar'
            : tone === 'muted'
              ? 'text-muted'
              : ''
  return (
    <span className={`tnum ${toneClass} ${className}`.trim()}>{formatMoney(value)}</span>
  )
}
