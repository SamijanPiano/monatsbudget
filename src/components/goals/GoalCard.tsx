import type { Goal } from '../../types/budget'
import { progressRatio, recommendedMonthlyRate, monthsUntil } from '../../lib/goals'
import { formatMoney } from '../../lib/format'
import { useBudgetStore } from '../../store/budgetStore'
import { IconTarget, IconTrendingDown, IconShield, IconTrash } from '../ui/icons'

interface GoalCardProps {
  goal: Goal
}

const ICON: Record<string, React.ReactNode> = {
  save: <IconTarget size={20} />,
  debt: <IconTrendingDown size={20} />,
  buffer: <IconShield size={20} />,
}

const LABEL_SUFFIX: Record<string, string> = {
  save: 'Sparziel',
  debt: 'Schuldenabbau',
  buffer: 'Notgroschen',
  overview: 'Überblick',
}

export function GoalCard({ goal }: GoalCardProps) {
  const removeGoal = useBudgetStore((s) => s.removeGoal)

  const ratio = progressRatio(goal)
  const pct = Math.round(ratio * 100)
  const rate = goal.deadline ? recommendedMonthlyRate(goal) : null
  const months = goal.deadline ? monthsUntil(goal.deadline) : null

  const isOverview = goal.type === 'overview'
  const remaining = goal.targetAmount - goal.currentAmount

  return (
    <div className="goal-card-item">
      <div className="goal-card-item__header">
        <span className="goal-card-item__icon">{ICON[goal.type]}</span>
        <div className="goal-card-item__info">
          <span className="goal-card-item__label">{goal.label}</span>
          <span className="goal-card-item__type">{LABEL_SUFFIX[goal.type]}</span>
        </div>
        <button
          type="button"
          className="goal-card-item__remove"
          aria-label={`Ziel "${goal.label}" entfernen`}
          onClick={() => removeGoal(goal.id)}
        >
          <IconTrash size={15} />
        </button>
      </div>

      {!isOverview && (
        <>
          <div className="goal-card-item__amounts">
            <span className="goal-card-item__current">{formatMoney(goal.currentAmount)}</span>
            <span className="goal-card-item__of">von</span>
            <span className="goal-card-item__target">{formatMoney(goal.targetAmount)}</span>
          </div>

          <div className="goal-card-item__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% erreicht`}>
            <div className="goal-card-item__fill" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>

          <div className="goal-card-item__meta">
            <span>{pct}% erreicht</span>
            {remaining > 0 && <span>noch {formatMoney(remaining)}</span>}
          </div>

          {rate !== null && months !== null && months > 0 && (
            <div className="goal-card-item__rate">
              {formatMoney(rate)}/Monat · noch {months} Monat{months === 1 ? '' : 'e'}
            </div>
          )}
        </>
      )}

      {isOverview && (
        <p className="goal-card-item__overview-hint">
          Behalte im Blick, wohin dein Geld fließt.
        </p>
      )}
    </div>
  )
}
