import { IconArrowLeft } from './icons'

interface BackBarProps {
  label?: string
  onBack: () => void
}

/** Zurück-Leiste für Sekundär-Views, die unter dem „Mehr"-Hub liegen. */
export function BackBar({ label = 'Mehr', onBack }: BackBarProps) {
  return (
    <button type="button" className="backbar" onClick={onBack}>
      <IconArrowLeft size={20} />
      <span>{label}</span>
    </button>
  )
}
