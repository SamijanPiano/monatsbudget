import type { Month, MonthCalc } from '../../types/budget'
import { useBudgetStore, useCashEnabled } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { NumberInput } from '../ui/NumberInput'
import { Money } from '../ui/Money'
import { formatMoney } from '../../lib/format'

interface SavingsSectionProps {
  month: Month
  calc: MonthCalc
}

export function SavingsSection({ month, calc }: SavingsSectionProps) {
  const setSavings = useBudgetStore((s) => s.setSavings)
  const cashEnabled = useCashEnabled()

  return (
    <Card as="section">
      <SectionTitle
        title="Sparen & Puffer"
        hint="Wie viel legst du diesen Monat zur Seite?"
      />

      <div className="savings-grid">
        <div className="savings-field">
          <label htmlFor="savings-konto" className="savings-field__label text-konto">
            Sparbetrag Konto
          </label>
          <NumberInput
            id="savings-konto"
            value={month.savingsKonto}
            onChange={(v) => setSavings('konto', v)}
            channel="konto"
          />
          <span className="savings-field__hint">
            max. {formatMoney(calc.maxSaveKonto)}
          </span>
        </div>

        {cashEnabled && (
          <div className="savings-field">
            <label htmlFor="savings-bar" className="savings-field__label text-bar">
              Sparbetrag Bar
            </label>
            <NumberInput
              id="savings-bar"
              value={month.savingsBar}
              onChange={(v) => setSavings('bar', v)}
              channel="bar"
            />
            <span className="savings-field__hint">max. {formatMoney(calc.maxSaveBar)}</span>
          </div>
        )}
      </div>

      <div className="result-list">
        <div className="result-row">
          <span>Sicherheitspuffer Konto nach Sparen</span>
          <Money value={calc.bufferKonto} signed />
        </div>
        {cashEnabled && (
          <div className="result-row">
            <span>Bar frei verfügbar nach Sparen</span>
            <Money value={calc.freeBar} signed />
          </div>
        )}
        <div className="result-row result-row--total">
          <span>Gesamtersparnis diesen Monat</span>
          <Money value={calc.totalSavings} tone="konto" />
        </div>
      </div>
    </Card>
  )
}
