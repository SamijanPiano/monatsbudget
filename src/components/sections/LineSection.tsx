import type { ReactNode } from 'react'
import type { LineItem } from '../../types/budget'
import { useBudgetStore, type Section } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { EditableRow } from '../ui/EditableRow'
import { Money } from '../ui/Money'
import { IconPlus } from '../ui/icons'

interface LineSectionProps {
  section: Section
  title: string
  hint?: string
  icon?: ReactNode
  items: LineItem[]
  showKonto?: boolean
  showBar?: boolean
  subtotalKonto: number
  subtotalBar: number
}

export function LineSection({
  section,
  title,
  hint,
  icon,
  items,
  showKonto = true,
  showBar = true,
  subtotalKonto,
  subtotalBar,
}: LineSectionProps) {
  const addItem = useBudgetStore((s) => s.addItem)
  const updateItem = useBudgetStore((s) => s.updateItem)
  const removeItem = useBudgetStore((s) => s.removeItem)

  return (
    <Card as="section">
      <SectionTitle icon={icon} title={title} hint={hint} />

      <div className="amount-heads">
        <span>Posten</span>
        <span className="amount-heads__group">
          {showKonto && <span className="amount-heads__cell text-konto">Konto</span>}
          {showBar && <span className="amount-heads__cell text-bar">Bar</span>}
        </span>
        <span className="amount-heads__spacer" />
      </div>

      <div className="rows">
        {items.map((item) => (
          <EditableRow
            key={item.id}
            item={item}
            showKonto={showKonto}
            showBar={showBar}
            onLabel={(label) => updateItem(section, item.id, { label })}
            onKonto={(konto) => updateItem(section, item.id, { konto })}
            onBar={(bar) => updateItem(section, item.id, { bar })}
            onRemove={() => removeItem(section, item.id)}
          />
        ))}
      </div>

      <button type="button" className="add-row" onClick={() => addItem(section)}>
        <IconPlus size={16} />
        Posten hinzufügen
      </button>

      <div className="subtotal">
        <span className="subtotal__label">Summe</span>
        <span className="subtotal__values">
          {showKonto && <Money value={subtotalKonto} tone="konto" />}
          {showBar && <Money value={subtotalBar} tone="bar" />}
        </span>
      </div>
    </Card>
  )
}
