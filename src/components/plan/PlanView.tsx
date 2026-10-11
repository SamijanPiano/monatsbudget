import { usePlanStore } from '../../store/planStore'
import { calcPlan, verdictTone } from '../../lib/plan'
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

  const formula =
    `${formatMoney(calc.income)} rein − ${formatMoney(calc.needed)} raus` +
    ` − ${formatMoney(calc.savings)} sparen`

  return (
    <div className="view-stack">
      <BackBar onBack={onBack} />

      <Card className="plan-hero">
        <span className="plan-hero__eyebrow">Monatsplan</span>
        <span className="plan-hero__label">Puffer nach Plan</span>
        <span className={`plan-hero__value tnum${calc.buffer < 0 ? ' text-negative' : ''}`}>
          {formatMoney(calc.buffer)}
        </span>
        <span className="plan-hero__formula tnum">{formula}</span>
        <VerdictBanner tone={tone} calc={calc} />
      </Card>

      <PlanSection
        section="income"
        items={plan.income}
        total={calc.income}
        title="Einnahmen"
        hint="Gehalt, Nebenjob"
        addLabel="Einnahme hinzufügen"
        placeholder="z. B. Gehalt"
      />
      <PlanSection
        section="fixed"
        items={plan.fixed}
        total={calc.fixed}
        title="Feste Abzüge"
        hint="Abos, Handy, Tanken: geht jeden Monat ab"
        addLabel="Abzug hinzufügen"
        placeholder="z. B. Spotify"
      />
      <PlanSection
        section="variable"
        items={plan.variable}
        total={calc.variable}
        title="Variable Ausgaben"
        hint="Was sonst noch anfällt"
        addLabel="Ausgabe hinzufügen"
        placeholder="z. B. Lebensmittel"
      />

      <SavingsCard calc={calc} />
      <SituationCard balance={plan.balance} calc={calc} tone={tone} />
    </div>
  )
}
