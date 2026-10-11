import { useBudgetStore } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { formatMoney } from '../../lib/format'
import { IconPlus } from '../ui/icons'
import { PlanItemRow } from '../plan/PlanItemRow'

/**
 * Eingabe der geplanten variablen Kosten des aktiven Monats (Month.variable).
 * Beträge sind Euro-basiert (LineItem), getrennt von den importierten Buchungen.
 */
export function VariableCostsCard() {
  const month = useBudgetStore((s) => s.months[s.activeMonthId])
  const addItem = useBudgetStore((s) => s.addItem)
  const updateItem = useBudgetStore((s) => s.updateItem)
  const removeItem = useBudgetStore((s) => s.removeItem)

  const items = month?.variable ?? []
  const total = items.reduce((sum, it) => sum + it.konto, 0)

  return (
    <Card>
      <SectionTitle title="Variable Kosten" hint="Geplante variable Ausgaben diesen Monat" />

      {items.length === 0 ? (
        <p className="empty__text" style={{ marginTop: 'var(--space-2)' }}>
          Noch keine variablen Kosten. Trage deine geplanten Ausgaben ein (z. B. Lebensmittel,
          Freizeit, Tanken).
        </p>
      ) : (
        <div className="varcost-list">
          {items.map((it) => (
            <PlanItemRow
              key={it.id}
              section="variable"
              label={it.label}
              amount={it.konto}
              placeholder="z. B. Lebensmittel"
              onChange={({ label, amount }) =>
                updateItem('variable', it.id, {
                  ...(label !== undefined && { label }),
                  ...(amount !== undefined && { konto: amount }),
                })
              }
              onRemove={() => removeItem('variable', it.id)}
            />
          ))}
        </div>
      )}

      <div className="varcost-foot">
        <button type="button" className="varcost-add" onClick={() => addItem('variable')}>
          <IconPlus size={16} /> Variable Kosten hinzufügen
        </button>
        {items.length > 0 && (
          <span className="varcost-total">
            Summe <strong className="tnum">{formatMoney(total)}</strong>
          </span>
        )}
      </div>
    </Card>
  )
}
