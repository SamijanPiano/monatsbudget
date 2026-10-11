import { useBudgetStore, type Section } from '../../store/budgetStore'
import { sumBar, sumKonto } from '../../lib/calc'
import type { LineItem } from '../../types/budget'
import { Card, SectionTitle } from '../ui/Card'
import { Money } from '../ui/Money'
import { IconPlus } from '../ui/icons'
import { PlanItemRow } from './PlanItemRow'

interface PlanSectionProps {
  section: Section
  items: LineItem[]
  title: string
  hint: string
  addLabel: string
  placeholder: string
  /** Bar-Spalte zeigen. Feste Abzüge laufen in der Excel nur übers Konto. */
  showBar: boolean
}

/** Ein Block des Monatsplans mit Einzelposten und automatischer Summe. */
export function PlanSection({
  section,
  items,
  title,
  hint,
  addLabel,
  placeholder,
  showBar,
}: PlanSectionProps) {
  const addItem = useBudgetStore((s) => s.addItem)
  const totalKonto = sumKonto(items)
  const totalBar = sumBar(items)

  return (
    <Card as="section" className="plan-card">
      <SectionTitle title={title} hint={hint} />

      {items.length > 0 && (
        <div className={`plan-row plan-row--head${showBar ? ' plan-row--dual' : ''}`} aria-hidden="true">
          <span className="plan-row__name">Posten</span>
          <span className="plan-row__konto plan-chan plan-chan--konto">Konto</span>
          {showBar && <span className="plan-row__bar plan-chan plan-chan--bar">Bar</span>}
          <span className="plan-row__del" />
        </div>
      )}

      <div className="varcost-list">
        {items.map((it) => (
          <PlanItemRow
            key={it.id}
            section={section}
            item={it}
            showBar={showBar}
            placeholder={placeholder}
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
            <Money value={totalKonto} tone="konto" className="plan-total__value" />
            {showBar && <Money value={totalBar} tone="bar" className="plan-total__value" />}
          </span>
        )}
      </div>
    </Card>
  )
}
