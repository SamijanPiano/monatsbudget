import { useCashEnabled } from '../../store/budgetStore'
import { useActiveMonth } from '../../hooks/useActiveMonth'
import { verdictTone } from '../../lib/plan'
import { formatMoney, formatMonthId } from '../../lib/format'
import { Card } from '../ui/Card'
import { BackBar } from '../ui/BackBar'
import { PlanSection } from './PlanSection'
import { SavingsCard, SituationCard, VerdictBanner } from './PlanResult'

interface PlanViewProps {
  onBack: () => void
}

/**
 * Monatsplan: Einzelposten eintragen, alles Weitere rechnet die App
 * (Nachbau der Excel „Monatskalkulation", Formeln in lib/calc.ts).
 */
export function PlanView({ onBack }: PlanViewProps) {
  const { activeMonthId, month, calc, situation } = useActiveMonth()
  const cashEnabled = useCashEnabled()
  const tone = verdictTone(month, calc, situation)

  const outgoing = calc.fixedTotal + calc.variableKonto
  const formula =
    `${formatMoney(calc.incomeKonto)} rein − ${formatMoney(outgoing)} raus` +
    ` − ${formatMoney(calc.savingsKonto)} sparen`

  return (
    <div className="view-stack">
      <BackBar onBack={onBack} />

      <Card className="plan-hero">
        <span className="plan-hero__eyebrow">Monatsplan · {formatMonthId(activeMonthId)}</span>
        <span className="plan-hero__label">Puffer auf dem Konto nach Plan</span>
        <span
          className={`plan-hero__value tnum${calc.bufferKonto < 0 ? ' text-negative' : ''}`}
        >
          {formatMoney(calc.bufferKonto)}
        </span>
        <span className="plan-hero__formula tnum">{formula}</span>
        <VerdictBanner tone={tone} situation={situation} />
      </Card>

      <PlanSection
        section="income"
        items={month.income}
        title="Einnahmen"
        hint="Gehalt, Nebenjob, Bargeld"
        addLabel="Einnahme hinzufügen"
        placeholder="z. B. Gehalt"
        showBar={cashEnabled}
      />
      <PlanSection
        section="fixed"
        items={month.fixed}
        title="Feste Abzüge"
        hint="Abos, Handy, Tanken: geht jeden Monat vom Konto"
        addLabel="Abzug hinzufügen"
        placeholder="z. B. Spotify"
        showBar={false}
      />
      <PlanSection
        section="variable"
        items={month.variable}
        title="Variable Ausgaben"
        hint="Was diesen Monat sonst noch anfällt"
        addLabel="Ausgabe hinzufügen"
        placeholder="z. B. Lebensmittel"
        showBar={cashEnabled}
      />

      <SavingsCard calc={calc} cashEnabled={cashEnabled} />
      <SituationCard
        month={month}
        calc={calc}
        situation={situation}
        tone={tone}
        cashEnabled={cashEnabled}
      />
    </div>
  )
}
