import { usePlanStore } from '../../store/planStore'
import type { PlanItem, PlanSection as Section } from '../../lib/plan'
import { formatMoney } from '../../lib/format'
import { isPooled } from '../../lib/dailyPool'
import { Card, SectionTitle } from '../ui/Card'
import { IconPlus } from '../ui/icons'
import { PlanItemRow } from './PlanItemRow'
import { PlanItemActual } from './PlanItemActual'
import type { PeriodActuals } from '../../lib/planMatch'

interface PlanSectionProps {
  section: Section
  items: PlanItem[]
  total: number
  title: string
  hint: string
  addLabel: string
  placeholder: string
  /** Ist-Werte der gewählten Periode (fehlt = nur Planung). */
  actuals?: PeriodActuals
}

/** Ein Block des Monatsplans mit Einzelposten und automatischer Summe. */
export function PlanSection({
  section,
  items,
  total,
  title,
  hint,
  addLabel,
  placeholder,
  actuals,
}: PlanSectionProps) {
  const addItem = usePlanStore((s) => s.addItem)
  const updateItem = usePlanStore((s) => s.updateItem)
  const removeItem = usePlanStore((s) => s.removeItem)
  const setRole = usePlanStore((s) => s.setRole)
  const roleOf = (it: PlanItem) => (it.catchAll ? 'catchAll' : it.salary ? 'salary' : null)
  const roleToGive = section === 'income' ? 'salary' : 'catchAll'
  // Topf-Posten stehen in der Karte „Daily-Topf"; hier nur als Hinweis, die Summe zählt sie mit.
  const pooled = section === 'income' ? [] : items.filter(isPooled)
  const own = section === 'income' ? items : items.filter((it) => !isPooled(it))
  const pooledSum = pooled.reduce((acc, it) => acc + (Number.isFinite(it.amount) ? it.amount : 0), 0)

  return (
    <Card as="section" className="plan-card">
      <SectionTitle title={title} hint={hint} />

      <div className="varcost-list">
        {own.map((it) => (
          <PlanItemRow
            key={it.id}
            section={section}
            label={it.label}
            amount={it.amount}
            placeholder={placeholder}
            onChange={(patch) => updateItem(section, it.id, patch)}
            onRemove={() => removeItem(section, it.id)}
          >
            {actuals && (
              <PlanItemActual
                itemId={it.id}
                section={section}
                planned={it.amount}
                actual={actuals.byTarget[it.id]}
                role={roleOf(it)}
                onMakeRole={roleOf(it) ? null : () => setRole(roleToGive, it.id)}
                onTogglePool={section === 'income' ? null : () => updateItem(section, it.id, { pooled: true })}
              />
            )}
          </PlanItemRow>
        ))}
        {pooled.length > 0 && (
          <div className="plan-pool-ref">
            <span>Im Daily-Topf: {pooled.map((it) => it.label || 'Posten').join(', ')}</span>
            <strong className="tnum">{formatMoney(pooledSum)}</strong>
          </div>
        )}
      </div>

      <div className="varcost-foot">
        <button type="button" className="varcost-add" onClick={() => addItem(section)}>
          <IconPlus size={16} /> {addLabel}
        </button>
        {items.length > 0 && (
          <span className="plan-total">
            <span className="plan-total__label">Summe</span>
            <strong className="plan-total__value tnum">{formatMoney(total)}</strong>
          </span>
        )}
      </div>
    </Card>
  )
}
