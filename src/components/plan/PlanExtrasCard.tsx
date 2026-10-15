import { useState } from 'react'
import { EXCLUDED, OTHER_INCOME, SAVINGS, UNASSIGNED, type PeriodActuals } from '../../lib/planMatch'
import { formatCents } from '../../lib/format'
import { Card, SectionTitle } from '../ui/Card'
import { IconChevronRight } from '../ui/icons'
import { TransactionMoveList } from './TransactionMoveList'

const GROUPS = [
  { target: SAVINGS, label: 'Gespart', hint: 'Sparen-Kategorie' },
  { target: OTHER_INCOME, label: 'Sonstige Eingänge', hint: 'Erstattungen, Überweisungen an dich' },
  { target: UNASSIGNED, label: 'Nicht zugeordnet', hint: 'Kein Posten passt' },
  { target: EXCLUDED, label: 'Nicht gezählt', hint: 'Umbuchungen zwischen eigenen Konten' },
] as const

/** Buchungen der Periode, die zu keinem Planposten gehören. Nur sichtbar, wenn es welche gibt. */
export function PlanExtrasCard({ actuals }: { actuals: PeriodActuals }) {
  const [open, setOpen] = useState<string | null>(null)
  const present = GROUPS.filter((g) => (actuals.byTarget[g.target]?.transactions.length ?? 0) > 0)
  if (present.length === 0) return null

  return (
    <Card as="section" className="plan-card">
      <SectionTitle title="Weitere Buchungen" hint="Zählen nicht gegen deine Posten" />
      <div className="plan-extras">
        {present.map((g) => {
          const actual = actuals.byTarget[g.target]
          const isOpen = open === g.target
          return (
            <div key={g.target} className={`plan-actual${isOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="plan-actual__toggle"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : g.target)}
              >
                <IconChevronRight size={14} className="plan-actual__chevron" />
                <span className="plan-actual__text">
                  <strong>{g.label}</strong>
                  <span className="plan-actual__count"> · {g.hint}</span>
                </span>
                <span className="tnum">{formatCents(actual?.cents ?? 0)}</span>
              </button>
              {isOpen && (
                <div className="plan-actual__body">
                  <TransactionMoveList transactions={actual?.transactions ?? []} current={g.target} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
