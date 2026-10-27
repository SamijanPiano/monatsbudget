import { useState } from 'react'
import { usePlanStore } from '../../store/planStore'
import { daysLeft, poolSpent, poolTransactions, type DailyPool } from '../../lib/dailyPool'
import type { PeriodActuals } from '../../lib/planMatch'
import type { PlanItem } from '../../lib/plan'
import type { Period } from '../../lib/period'
import { todayIso } from '../../lib/euro'
import { formatCents } from '../../lib/format'
import { Card, SectionTitle } from '../ui/Card'
import { IconChevronRight, IconPlus } from '../ui/icons'
import { Divider, PlanLine } from './PlanResult'
import { PlanItemRow } from './PlanItemRow'
import { TransactionMoveList } from './TransactionMoveList'

interface DailyPoolCardProps {
  pool: DailyPool
  actuals: PeriodActuals
  period: Period
}

/**
 * Daily-Topf: Daily, Andere, Nadja … einzeln eintragbar, dazu der Puffer nach
 * Sparen. Ausgegeben wird aus einem Topf: Buchungen, die keinem eigenen Posten
 * direkt gehören, zählen für alle Topf-Posten gemeinsam.
 */
export function DailyPoolCard({ pool, actuals, period }: DailyPoolCardProps) {
  const plan = usePlanStore((s) => s.plan)
  const addItem = usePlanStore((s) => s.addItem)
  const updateItem = usePlanStore((s) => s.updateItem)
  const removeItem = usePlanStore((s) => s.removeItem)
  const [open, setOpen] = useState(false)

  const spent = poolSpent(pool, actuals)
  const totalCents = Math.round(pool.total * 100)
  const restCents = totalCents - spent.cents
  const days = daysLeft(period, todayIso())
  const perDay = days !== null && restCents > 0 ? restCents / days / 100 : null
  const ratio = totalCents > 0 ? spent.cents / totalCents : spent.cents > 0 ? 1 : 0
  const entries = poolTransactions(pool, actuals)
  const targets = new Map(entries.map((e) => [e.tx.id, e.target]))
  const sectionOf = (it: PlanItem) => (plan.fixed.some((f) => f.id === it.id) ? 'fixed' : 'variable')
  // Daily zuerst, darunter die übrigen Topf-Posten.
  const items = [...pool.items].sort((a, b) => Number(Boolean(b.catchAll)) - Number(Boolean(a.catchAll)))

  return (
    <Card as="section" className="plan-card">
      <SectionTitle
        title="Daily-Topf"
        hint="Beträge einzeln planen, ausgegeben wird aus einem Topf: Was keinem eigenen Posten direkt zugeordnet ist, zählt für alle zusammen"
      />

      <div className="varcost-list">
        {items.map((it) => (
          <PlanItemRow
            key={it.id}
            section={sectionOf(it)}
            label={it.label}
            amount={it.amount}
            placeholder="z. B. Nadja"
            onChange={(patch) => updateItem(sectionOf(it), it.id, patch)}
            onRemove={() => removeItem(sectionOf(it), it.id)}
          >
            {it.catchAll ? (
              <span className="plan-pool-note">Grundbetrag, bekommt den Puffer nach Sparen</span>
            ) : (
              <button
                type="button"
                className="plan-pool-out"
                onClick={() => updateItem(sectionOf(it), it.id, { pooled: false })}
              >
                Aus dem Topf nehmen
              </button>
            )}
          </PlanItemRow>
        ))}
      </div>

      <div className="varcost-foot">
        <button type="button" className="varcost-add" onClick={() => addItem('variable', { pooled: true })}>
          <IconPlus size={16} /> Topf-Posten hinzufügen
        </button>
      </div>

      <div className="plan-lines">
        <PlanLine label="Geplant (Summe der Posten)" value={pool.others + pool.dailyBase} tone="muted" />
        <PlanLine label="Allgemein: Puffer nach Sparen" value={pool.buffer} tone="muted" signed />
        <Divider />
        <PlanLine label="Topf gesamt" value={pool.total} signed strong />
      </div>

      <div className={`plan-actual${open ? ' is-open' : ''}`}>
        <button
          type="button"
          className="plan-actual__toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <IconChevronRight size={14} className="plan-actual__chevron" />
          <span className="plan-actual__text tnum">
            {formatCents(spent.cents)} ausgegeben von {formatCents(totalCents)}
            <span className="plan-actual__count">
              {' '}
              · {spent.count} {spent.count === 1 ? 'Buchung' : 'Buchungen'}
            </span>
          </span>
        </button>
        <div className="plan-bar" aria-hidden="true">
          <span
            className={`plan-bar__fill${ratio > 1 ? ' plan-bar__fill--over' : ''}`}
            style={{ transform: `scaleX(${Math.min(Math.max(ratio, 0), 1)})` }}
          />
        </div>
        {open && (
          <div className="plan-actual__body">
            <TransactionMoveList
              transactions={entries.map((e) => e.tx)}
              current={items[0]?.id ?? ''}
              targetOf={(tx) => targets.get(tx.id) ?? ''}
            />
          </div>
        )}
      </div>

      <div className="plan-lines">
        <PlanLine label="Noch im Topf" value={restCents / 100} signed strong />
        {perDay !== null && (
          <PlanLine label={`Pro Tag, noch ${days} ${days === 1 ? 'Tag' : 'Tage'}`} value={perDay} />
        )}
      </div>
    </Card>
  )
}
