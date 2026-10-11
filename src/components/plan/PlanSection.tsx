import { usePlanStore } from '../../store/planStore'
import type { PlanItem, PlanSection as Section } from '../../lib/plan'
import { formatMoney } from '../../lib/format'
import { Card, SectionTitle } from '../ui/Card'
import { IconPlus } from '../ui/icons'
import { PlanItemRow } from './PlanItemRow'

interface PlanSectionProps {
  section: Section
  items: PlanItem[]
  total: number
  title: string
  hint: string
  addLabel: string
  placeholder: string
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
}: PlanSectionProps) {
  const addItem = usePlanStore((s) => s.addItem)
  const updateItem = usePlanStore((s) => s.updateItem)
  const removeItem = usePlanStore((s) => s.removeItem)

  return (
    <Card as="section" className="plan-card">
      <SectionTitle title={title} hint={hint} />

      <div className="varcost-list">
        {items.map((it) => (
          <PlanItemRow
            key={it.id}
            section={section}
            label={it.label}
            amount={it.amount}
            placeholder={placeholder}
            onChange={(patch) => updateItem(section, it.id, patch)}
            onRemove={() => removeItem(section, it.id)}
          />
        ))}
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
