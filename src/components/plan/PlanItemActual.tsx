import { useState } from 'react'
import type { PlanSection } from '../../lib/plan'
import type { TargetActual } from '../../lib/planMatch'
import { formatCents } from '../../lib/format'
import { IconChevronRight } from '../ui/icons'
import { TransactionMoveList } from './TransactionMoveList'

interface PlanItemActualProps {
  itemId: string
  section: PlanSection
  /** Planbetrag in Euro. */
  planned: number
  actual: TargetActual | undefined
  role: 'catchAll' | 'salary' | null
  onMakeRole: (() => void) | null
  /** Gehört zum Daily-Topf (ohne Sammelposten selbst). */
  pooled?: boolean
  /** Topf-Zugehörigkeit umschalten; null = nicht möglich (Einnahme, Sammelposten). */
  onTogglePool?: (() => void) | null
}

const ROLE_LABEL = { catchAll: 'Sammelposten', salary: 'Gehalt' } as const

/**
 * Ist-Stand eines Postens in der gewählten Periode: Balken „ausgegeben von
 * geplant", aufklappbar zur Liste der zugeordneten Buchungen.
 */
export function PlanItemActual({
  itemId,
  section,
  planned,
  actual,
  role,
  onMakeRole,
  pooled = false,
  onTogglePool = null,
}: PlanItemActualProps) {
  const [open, setOpen] = useState(false)
  const plannedCents = Math.round(planned * 100)
  const actualCents = actual?.cents ?? 0
  const count = actual?.transactions.length ?? 0
  const ratio = plannedCents > 0 ? actualCents / plannedCents : actualCents > 0 ? 1 : 0
  const isIncome = section === 'income'
  const over = !isIncome && ratio > 1
  const verb = isIncome ? 'eingegangen' : 'ausgegeben'

  return (
    <div className={`plan-actual${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="plan-actual__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <IconChevronRight size={14} className="plan-actual__chevron" />
        <span className="plan-actual__text tnum">
          {formatCents(actualCents)} {verb}
          {plannedCents > 0 && ` von ${formatCents(plannedCents)}`}
          <span className="plan-actual__count"> · {count} {count === 1 ? 'Buchung' : 'Buchungen'}</span>
        </span>
        {role && <span className="plan-badge">{ROLE_LABEL[role]}</span>}
        {!role && pooled && <span className="plan-badge">Daily-Topf</span>}
      </button>
      <div className="plan-bar" aria-hidden="true">
        <span
          className={`plan-bar__fill${over ? ' plan-bar__fill--over' : ''}${isIncome ? ' plan-bar__fill--income' : ''}`}
          style={{ transform: `scaleX(${Math.min(Math.max(ratio, 0), 1)})` }}
        />
      </div>
      {open && (
        <div className="plan-actual__body">
          <TransactionMoveList transactions={actual?.transactions ?? []} current={itemId} />
          {onMakeRole && (
            <button type="button" className="plan-role-btn" onClick={onMakeRole}>
              {isIncome ? 'Als Gehalt verwenden (bestimmt den Periodenstart)' : 'Als Sammelposten verwenden'}
            </button>
          )}
          {onTogglePool && (
            <button type="button" className="plan-role-btn" onClick={onTogglePool}>
              {pooled ? 'Nicht mehr mit Daily zusammenfassen' : 'Mit Daily zusammenfassen'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
