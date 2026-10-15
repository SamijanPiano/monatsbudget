import type { Period } from '../../lib/period'
import { periodLabel } from '../../lib/period'
import { IconChevronLeft, IconChevronRight } from '../ui/icons'

interface PeriodSwitcherProps {
  periods: Period[]
  /** 0 = aktuelle Periode, höhere Zahlen = ältere. */
  index: number
  onChange: (index: number) => void
}

/** Blättert zwischen den Gehalts-Perioden (neueste rechts). */
export function PeriodSwitcher({ periods, index, onChange }: PeriodSwitcherProps) {
  const period = periods[index]
  if (!period) return null
  const isCurrent = index === 0

  return (
    <div className="period-switch" role="group" aria-label="Periode wählen">
      <button
        type="button"
        className="period-switch__btn"
        aria-label="Vorherige Periode"
        disabled={index >= periods.length - 1}
        onClick={() => onChange(index + 1)}
      >
        <IconChevronLeft size={18} />
      </button>
      <span className="period-switch__label">
        <strong className="tnum">{periodLabel(period)}</strong>
        <span className="period-switch__hint">{isCurrent ? 'Aktuelle Periode' : 'Abgeschlossen'}</span>
      </span>
      <button
        type="button"
        className="period-switch__btn"
        aria-label="Nächste Periode"
        disabled={isCurrent}
        onClick={() => onChange(index - 1)}
      >
        <IconChevronRight size={18} />
      </button>
    </div>
  )
}
