import type { ReactNode } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import type { Month, MonthCalc, SituationCalc } from '../../types/budget'
import type { VerdictTone } from '../../lib/plan'
import { formatMoney } from '../../lib/format'
import { Card, SectionTitle } from '../ui/Card'
import { Money } from '../ui/Money'
import { EuroInput } from '../ui/EuroInput'

interface LineProps {
  label: string
  value: number
  tone?: 'konto' | 'bar' | 'muted' | 'default'
  signed?: boolean
  strong?: boolean
}

/** Eine berechnete Zeile (entspricht einer Excel-Formelzelle). */
function PlanLine({ label, value, tone = 'default', signed = false, strong = false }: LineProps) {
  return (
    <div className={`plan-line${strong ? ' plan-line--strong' : ''}`}>
      <span className="plan-line__label">{label}</span>
      <Money value={value} tone={tone} signed={signed} />
    </div>
  )
}

interface InputLineProps {
  label: string
  hint?: string
  value: number
  onCommit: (euros: number) => void
}

/** Eine Eingabezeile (entspricht einer blauen Excel-Eingabezelle). */
function PlanInputLine({ label, hint, value, onCommit }: InputLineProps) {
  return (
    <div className="plan-line plan-line--input">
      <span className="plan-line__label">
        {label}
        {hint && <span className="plan-line__hint">{hint}</span>}
      </span>
      <EuroInput value={value} ariaLabel={label} onCommit={onCommit} />
    </div>
  )
}

function Divider() {
  return <hr className="plan-divider" />
}

interface SavingsCardProps {
  calc: MonthCalc
  cashEnabled: boolean
}

export function SavingsCard({ calc, cashEnabled }: SavingsCardProps) {
  const setSavings = useBudgetStore((s) => s.setSavings)

  return (
    <Card as="section" className="plan-card">
      <SectionTitle title="Sparen" hint="Was nach Abzügen und Ausgaben übrig bleibt" />
      <div className="plan-lines">
        <PlanLine label="Konto nach Abzügen & Ausgaben" value={calc.kontoAfterDeductions} signed />
        {cashEnabled && (
          <PlanLine label="Bar nach Ausgaben" value={calc.barAfterExpenses} signed />
        )}
        <Divider />
        <PlanInputLine
          label="Sparbetrag Konto"
          hint={`max. ${formatMoney(calc.maxSaveKonto)}`}
          value={calc.savingsKonto}
          onCommit={(v) => setSavings('konto', v)}
        />
        {cashEnabled && (
          <PlanInputLine
            label="Sparbetrag Bar"
            hint={`max. ${formatMoney(calc.maxSaveBar)}`}
            value={calc.savingsBar}
            onCommit={(v) => setSavings('bar', v)}
          />
        )}
        <Divider />
        <PlanLine label="Puffer auf dem Konto" value={calc.bufferKonto} signed strong />
        {cashEnabled && <PlanLine label="Bar frei verfügbar" value={calc.freeBar} signed strong />}
        <PlanLine label="Gesamtersparnis diesen Monat" value={calc.totalSavings} tone="konto" />
      </div>
    </Card>
  )
}

const VERDICT_TITLE: Record<VerdictTone, string> = {
  ok: 'Ja, das Konto reicht',
  tight: 'Reicht, aber knapp',
  short: 'Nein, das Konto reicht nicht',
  unknown: 'Noch offen',
}

function verdictDetail(tone: VerdictTone, situation: SituationCalc): ReactNode {
  if (tone === 'unknown') return 'Trag deinen aktuellen Kontostand ein, dann rechnet die App es aus.'
  if (tone === 'short') return <>Es fehlen <strong className="tnum">{formatMoney(situation.diff)}</strong>.</>
  return <>Puffer: <strong className="tnum">{formatMoney(situation.diff)}</strong></>
}

export function VerdictBanner({ tone, situation }: { tone: VerdictTone; situation: SituationCalc }) {
  return (
    <div className={`plan-verdict plan-verdict--${tone}`} role="status">
      <span className="plan-verdict__title">{VERDICT_TITLE[tone]}</span>
      <span className="plan-verdict__detail">{verdictDetail(tone, situation)}</span>
    </div>
  )
}

interface SituationCardProps {
  month: Month
  calc: MonthCalc
  situation: SituationCalc
  tone: VerdictTone
  cashEnabled: boolean
}

export function SituationCard({ month, calc, situation, tone, cashEnabled }: SituationCardProps) {
  const setCurrent = useBudgetStore((s) => s.setCurrent)

  return (
    <Card as="section" className="plan-card">
      <SectionTitle title="Reicht es?" hint="Aktueller Stand gegen alles, was noch abgeht" />
      <div className="plan-lines">
        <PlanInputLine
          label="Aktueller Kontostand"
          value={month.currentKonto}
          onCommit={(v) => setCurrent('konto', v)}
        />
        {cashEnabled && (
          <PlanInputLine
            label="Aktuelles Bargeld"
            value={month.currentBar}
            onCommit={(v) => setCurrent('bar', v)}
          />
        )}
        <Divider />
        <PlanLine label="Feste Abzüge" value={calc.fixedTotal} tone="muted" />
        <PlanLine label="Variable Ausgaben vom Konto" value={calc.variableKonto} tone="muted" />
        {cashEnabled && (
          <>
            <PlanLine label="Bargeld deckt davon" value={situation.barCovers} tone="bar" />
            <PlanLine label="Rest Bar-Ausgaben zahlt das Konto" value={situation.restBarToKonto} tone="muted" />
          </>
        )}
        <PlanLine label="Konto braucht insgesamt" value={situation.kontoNeededTotal} strong />
        <Divider />
        <PlanLine label="Konto danach" value={situation.kontoRemaining} signed strong />
        {cashEnabled && <PlanLine label="Bargeld danach" value={situation.barRemaining} signed />}
      </div>
      <VerdictBanner tone={tone} situation={situation} />
    </Card>
  )
}
