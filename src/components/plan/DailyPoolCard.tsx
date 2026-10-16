import { daysLeft, poolSpent, type DailyPool } from '../../lib/dailyPool'
import type { PeriodActuals } from '../../lib/planMatch'
import type { Period } from '../../lib/period'
import { todayIso } from '../../lib/euro'
import { Card, SectionTitle } from '../ui/Card'
import { Divider, PlanLine } from './PlanResult'

interface DailyPoolCardProps {
  pool: DailyPool
  actuals: PeriodActuals
  period: Period
}

/**
 * Zusammenfassung am Ende des Plans: Andere, Daily und der Puffer nach Sparen
 * als ein Topf, dazu was davon in der Periode schon ausgegeben ist.
 */
export function DailyPoolCard({ pool, actuals, period }: DailyPoolCardProps) {
  const spent = poolSpent(pool, actuals)
  const restCents = Math.round(pool.total * 100) - spent.cents
  const days = daysLeft(period, todayIso())
  const perDay = days !== null && restCents > 0 ? restCents / days / 100 : null
  const others = pool.items.filter((i) => !i.catchAll)

  return (
    <Card as="section" className="plan-card">
      <SectionTitle title="Daily-Topf" hint="Andere, Daily und Puffer zusammen: daraus zahlst du den Alltag" />
      <div className="plan-lines">
        {others.map((i) => (
          <PlanLine key={i.id} label={`${i.label || 'Posten'} (geschätzt)`} value={i.amount} tone="muted" />
        ))}
        <PlanLine label="Daily (Grundbetrag)" value={pool.dailyBase} tone="muted" />
        <PlanLine label="Allgemein: Puffer nach Sparen" value={pool.buffer} tone="muted" signed />
        <Divider />
        <PlanLine label="Daily tatsächlich" value={pool.daily} signed strong />
        <PlanLine label="Topf gesamt" value={pool.total} signed strong />
        <Divider />
        <PlanLine
          label={`In dieser Periode ausgegeben (${spent.count} ${spent.count === 1 ? 'Buchung' : 'Buchungen'})`}
          value={spent.cents / 100}
        />
        <PlanLine label="Noch im Topf" value={restCents / 100} signed strong />
        {perDay !== null && (
          <PlanLine label={`Pro Tag, noch ${days} ${days === 1 ? 'Tag' : 'Tage'}`} value={perDay} />
        )}
      </div>
    </Card>
  )
}
