import { useBudgetStore } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { formatCents } from '../../lib/format'
import { currentMonthId } from '../../lib/seed'

function currentMonthKey(): string {
  return currentMonthId()
}

function todayDay(): number {
  return new Date().getUTCDate()
}

type RuleStatus = 'upcoming' | 'booked' | 'next-month'

function ruleStatus(nextExpected: string, monthKey: string): RuleStatus {
  const ruleMonth = nextExpected.slice(0, 7)
  if (ruleMonth !== monthKey) return 'next-month'
  const day = Number(nextExpected.slice(8, 10))
  return day > todayDay() ? 'upcoming' : 'booked'
}

const STATUS_LABEL: Record<RuleStatus, string> = {
  upcoming: 'noch ausstehend',
  booked: 'bereits gebucht',
  'next-month': 'nächsten Monat',
}

const STATUS_CLASS: Record<RuleStatus, string> = {
  upcoming: 'recurring__status--upcoming',
  booked: 'recurring__status--booked',
  'next-month': 'recurring__status--next',
}

export function RecurringCard() {
  const rules = useBudgetStore((s) => s.recurringRules)
  const categories = useBudgetStore((s) => s.categories)

  if (rules.length === 0) return null

  const key = currentMonthKey()
  const outflows = rules.filter((r) => r.amountApprox < 0)
  const inflows = rules.filter((r) => r.amountApprox >= 0)

  function catLabel(categoryId: string | null) {
    if (!categoryId) return null
    return categories.find((c) => c.id === categoryId)?.label ?? null
  }

  function renderGroup(title: string, items: typeof rules) {
    if (items.length === 0) return null
    return (
      <div className="recurring__group">
        <h4 className="recurring__group-title">{title}</h4>
        {items.map((rule) => {
          const status = ruleStatus(rule.nextExpected, key)
          const cat = catLabel(rule.categoryId)
          return (
            <div key={rule.id} className="recurring__row">
              <div className="recurring__info">
                <span className="recurring__party">{rule.counterparty || 'Unbekannt'}</span>
                {cat && <span className="recurring__cat">{cat}</span>}
              </div>
              <div className="recurring__right">
                <span className={`recurring__status ${STATUS_CLASS[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
                <span className={`recurring__amount tnum ${rule.amountApprox < 0 ? 'text-negative' : 'text-positive'}`}>
                  {formatCents(rule.amountApprox)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Card>
      <SectionTitle
        title="Erkannte Dauerposten"
        hint={`${rules.length} automatisch erkannt`}
      />
      {renderGroup('Einnahmen', inflows)}
      {renderGroup('Ausgaben & Abos', outflows)}
    </Card>
  )
}
