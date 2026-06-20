import { useActiveMonth } from '../../hooks/useActiveMonth'
import { useBudgetStore, useCashEnabled } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { NumberInput } from '../ui/NumberInput'
import { Money } from '../ui/Money'
import { StatusBanner } from '../dashboard/StatusBanner'

export function ReichtEsCheck() {
  const { month, calc, situation } = useActiveMonth()
  const setCurrent = useBudgetStore((s) => s.setCurrent)
  const cashEnabled = useCashEnabled()

  return (
    <div className="view-stack">
      <Card>
        <SectionTitle
          title="Aktuelle Situation"
          hint="Trag deinen aktuellen Stand ein — der Rest rechnet sich automatisch"
        />
        <div className="situation-inputs">
          <div className="savings-field">
            <label htmlFor="current-konto" className="savings-field__label text-konto">
              Aktueller Kontostand
            </label>
            <NumberInput
              id="current-konto"
              value={month.currentKonto}
              onChange={(v) => setCurrent('konto', v)}
              channel="konto"
            />
          </div>
          {cashEnabled && (
            <div className="savings-field">
              <label htmlFor="current-bar" className="savings-field__label text-bar">
                Aktuelles Bargeld
              </label>
              <NumberInput
                id="current-bar"
                value={month.currentBar}
                onChange={(v) => setCurrent('bar', v)}
                channel="bar"
              />
            </div>
          )}
        </div>
      </Card>

      <StatusBanner situation={situation} currentKonto={month.currentKonto} />

      <Card>
        <SectionTitle
          title="So wird gerechnet"
          hint={cashEnabled ? 'Bargeld zahlt zuerst, das Konto springt für den Rest ein' : 'Alle Ausgaben werden vom Konto abgebucht'}
        />
        <div className="result-list">
          <div className="result-row">
            <span>Feste Konto-Abzüge</span>
            <Money value={calc.fixedTotal} />
          </div>
          <div className="result-row">
            <span>Variable Ausgaben</span>
            <Money value={cashEnabled ? calc.variableKonto : calc.variableTotal} />
          </div>
          {cashEnabled && (
            <>
              <div className="result-row result-row--sub">
                <span>Gesamt Konto benötigt (fix + variabel)</span>
                <Money value={situation.kontoNeededFixedVar} />
              </div>
              <div className="result-row">
                <span>Bar deckt zuerst</span>
                <Money value={situation.barCovers} tone="bar" />
              </div>
              <div className="result-row">
                <span>Rest Bar-Ausgaben → zahlt Konto</span>
                <Money value={situation.restBarToKonto} />
              </div>
            </>
          )}
          <div className="result-row result-row--sub">
            <span>Konto benötigt gesamt</span>
            <Money value={situation.kontoNeededTotal} />
          </div>
          <div className="result-row result-row--total">
            <span>Konto verbleibend nach allen Ausgaben</span>
            <Money value={situation.kontoRemaining} signed />
          </div>
          {cashEnabled && (
            <div className="result-row">
              <span>Bar verbleibend nach Ausgaben</span>
              <Money value={situation.barRemaining} signed />
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
