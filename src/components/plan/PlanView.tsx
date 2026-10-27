import { useMemo, useState } from 'react'
import { usePlanStore } from '../../store/planStore'
import { usePlanPeriods } from '../../hooks/usePlanPeriods'
import { actualsForPeriod, UNASSIGNED } from '../../lib/planMatch'
import { DuplicatesSection } from '../settings/DuplicatesSection'
import { PeriodSwitcher } from './PeriodSwitcher'
import { PlanExtrasCard } from './PlanExtrasCard'
import { calcPlan, verdictTone } from '../../lib/plan'
import { calcDailyPool } from '../../lib/dailyPool'
import { DailyPoolCard } from './DailyPoolCard'
import { formatMoney } from '../../lib/format'
import { Card } from '../ui/Card'
import { BackBar } from '../ui/BackBar'
import { PlanSection } from './PlanSection'
import { SavingsCard, SituationCard, VerdictBanner } from './PlanResult'

interface PlanViewProps {
  onBack: () => void
}

/**
 * Monatsplan: ein einziger Plan, den man jederzeit ändert. Alles wird sofort
 * gespeichert und neu gerechnet (Nachbau der Excel „Monatskalkulation").
 */
export function PlanView({ onBack }: PlanViewProps) {
  const plan = usePlanStore((s) => s.plan)
  const calc = calcPlan(plan)
  const tone = verdictTone(plan, calc)
  const pool = calcDailyPool(plan, calc)

  const { input, assignments, periods } = usePlanPeriods()
  const [periodIndex, setPeriodIndex] = useState(0)
  const safeIndex = Math.min(periodIndex, periods.length - 1)
  const period = periods[safeIndex]
  const actuals = useMemo(
    () => actualsForPeriod(input, assignments, period),
    [input, assignments, period],
  )
  const expenseIds = [...plan.fixed, ...plan.variable].map((i) => i.id)
  const spentCents = [...expenseIds, UNASSIGNED].reduce(
    (sum, id) => sum + (actuals.byTarget[id]?.cents ?? 0),
    0,
  )
  const neededCents = Math.round(calc.needed * 100)

  const otherNames = pool.items.filter((i) => !i.catchAll).map((i) => i.label || 'Posten').join(' + ')
  const bufferPart =
    pool.buffer < 0 ? ` − ${formatMoney(-pool.buffer)} zu viel gespart` : ` + ${formatMoney(pool.buffer)} Puffer`
  const formula =
    (pool.others > 0 ? `${formatMoney(pool.others)} ${otherNames} + ` : '') +
    `${formatMoney(pool.dailyBase)} Daily${bufferPart}`

  return (
    <div className="view-stack">
      <BackBar onBack={onBack} />

      <PeriodSwitcher periods={periods} index={safeIndex} onChange={setPeriodIndex} />

      <DuplicatesSection />

      <Card className="plan-hero">
        <span className="plan-hero__eyebrow">Monatsplan</span>
        <span className="plan-hero__label">Frei für Daily{otherNames ? ` & ${otherNames}` : ''}</span>
        <span className={`plan-hero__value tnum${pool.total < 0 ? ' text-negative' : ''}`}>
          {formatMoney(pool.total)}
        </span>
        <span className="plan-hero__formula tnum">{formula}</span>
        <span className="plan-hero__spent tnum">
          In dieser Periode ausgegeben: <strong>{formatMoney(spentCents / 100)}</strong> von{' '}
          {formatMoney(neededCents / 100)}
          {neededCents > 0 && (
            <span className={spentCents > neededCents ? 'text-negative' : 'text-positive'}>
              {' '}
              · {spentCents > neededCents ? 'drüber' : 'noch'} {formatMoney(Math.abs(neededCents - spentCents) / 100)}
            </span>
          )}
        </span>
        <VerdictBanner tone={tone} calc={calc} />
      </Card>

      <PlanSection
        section="income"
        actuals={actuals}
        items={plan.income}
        total={calc.income}
        title="Einnahmen"
        hint="Gehalt, Nebenjob"
        addLabel="Einnahme hinzufügen"
        placeholder="z. B. Gehalt"
      />
      <PlanSection
        section="fixed"
        actuals={actuals}
        items={plan.fixed}
        total={calc.fixed}
        title="Feste Abzüge"
        hint="Abos, Handy, Tanken: geht jeden Monat ab"
        addLabel="Abzug hinzufügen"
        placeholder="z. B. Spotify"
      />
      <PlanSection
        section="variable"
        actuals={actuals}
        items={plan.variable}
        total={calc.variable}
        title="Variable Ausgaben"
        hint="Was sonst noch anfällt"
        addLabel="Ausgabe hinzufügen"
        placeholder="z. B. Lebensmittel"
      />

      <DailyPoolCard pool={pool} actuals={actuals} period={period} />

      <PlanExtrasCard actuals={actuals} />

      <SavingsCard calc={calc} pool={pool} />
      <SituationCard balance={plan.balance} calc={calc} tone={tone} />
    </div>
  )
}
