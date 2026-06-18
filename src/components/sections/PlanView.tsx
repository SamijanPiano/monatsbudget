import { useActiveMonth } from '../../hooks/useActiveMonth'
import { LineSection } from './LineSection'
import { SavingsSection } from './SavingsSection'

export function PlanView() {
  const { month, calc } = useActiveMonth()

  return (
    <div className="view-stack">
      <div className="legend legend--page">
        <span className="legend__item">
          <span className="legend__dot legend__dot--konto" /> Konto (Überweisung)
        </span>
        <span className="legend__item">
          <span className="legend__dot legend__dot--bar" /> Bar
        </span>
      </div>

      <LineSection
        section="income"
        title="Einnahmen"
        hint="Gehalt und sonstige Eingänge"
        items={month.income}
        subtotalKonto={calc.incomeKonto}
        subtotalBar={calc.incomeBar}
      />

      <LineSection
        section="fixed"
        title="Feste Abzüge"
        hint="Abos & fixe Kosten (vom Konto)"
        items={month.fixed}
        showBar={false}
        subtotalKonto={calc.fixedTotal}
        subtotalBar={0}
      />

      <LineSection
        section="variable"
        title="Variable Ausgaben"
        hint="Was sich Monat für Monat ändert"
        items={month.variable}
        subtotalKonto={calc.variableKonto}
        subtotalBar={calc.variableBar}
      />

      <SavingsSection month={month} calc={calc} />
    </div>
  )
}
