import type { ReactNode } from 'react'
import { usePlanStore } from '../../store/planStore'
import type { PlanCalc, VerdictTone } from '../../lib/plan'
import type { DailyPool } from '../../lib/dailyPool'
import { formatMoney } from '../../lib/format'
import { Card, SectionTitle } from '../ui/Card'
import { Money } from '../ui/Money'
import { EuroInput } from '../ui/EuroInput'

interface LineProps {
  label: string
  value: number
  tone?: 'konto' | 'muted' | 'default'
  signed?: boolean
  strong?: boolean
}

/** Eine berechnete Zeile (entspricht einer Excel-Formelzelle). */
export function PlanLine({ label, value, tone = 'default', signed = false, strong = false }: LineProps) {
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

export function Divider() {
  return <hr className="plan-divider" />
}

export function SavingsCard({ calc, pool }: { calc: PlanCalc; pool: DailyPool }) {
  const setSavings = usePlanStore((s) => s.setSavings)

  return (
    <Card as="section" className="plan-card">
      <SectionTitle title="Sparen" hint="Was nach Abzügen und Ausgaben übrig bleibt, Daily ist schon abgezogen" />
      <div className="plan-lines">
        <PlanLine label="Nach Abzügen & Ausgaben" value={calc.afterExpenses} signed />
        <Divider />
        <PlanInputLine
          label="Sparbetrag"
          hint={`max. ${formatMoney(calc.maxSave)}, Daily ${formatMoney(pool.dailyBase)} bleibt`}
          value={calc.savings}
          onCommit={setSavings}
        />
        <Divider />
        <PlanLine label="Puffer nach Sparen, fließt ins Daily" value={calc.buffer} signed strong />
      </div>
      {pool.dailyCut > 0 && (
        <div className={`plan-verdict plan-verdict--${pool.daily < 0 ? 'short' : 'tight'}`} role="status">
          <span className="plan-verdict__title">Mehr als das Maximum gespart</span>
          <span className="plan-verdict__detail">
            Daily sinkt um <strong className="tnum">{formatMoney(pool.dailyCut)}</strong> auf{' '}
            <strong className="tnum">{formatMoney(pool.daily)}</strong>.
          </span>
        </div>
      )}
    </Card>
  )
}

const VERDICT_TITLE: Record<VerdictTone, string> = {
  ok: 'Ja, das Konto reicht',
  tight: 'Reicht, aber knapp',
  short: 'Nein, das Konto reicht nicht',
  unknown: 'Noch offen',
}

function verdictDetail(tone: VerdictTone, calc: PlanCalc): ReactNode {
  if (tone === 'unknown') return 'Trag deinen aktuellen Kontostand ein, dann rechnet die App es aus.'
  const diff = formatMoney(Math.abs(calc.remaining))
  if (tone === 'short') return <>Es fehlen <strong className="tnum">{diff}</strong>.</>
  return <>Puffer: <strong className="tnum">{diff}</strong></>
}

export function VerdictBanner({ tone, calc }: { tone: VerdictTone; calc: PlanCalc }) {
  return (
    <div className={`plan-verdict plan-verdict--${tone}`} role="status">
      <span className="plan-verdict__title">{VERDICT_TITLE[tone]}</span>
      <span className="plan-verdict__detail">{verdictDetail(tone, calc)}</span>
    </div>
  )
}

interface SituationCardProps {
  balance: number
  calc: PlanCalc
  tone: VerdictTone
}

export function SituationCard({ balance, calc, tone }: SituationCardProps) {
  const setBalance = usePlanStore((s) => s.setBalance)

  return (
    <Card as="section" className="plan-card">
      <SectionTitle title="Reicht es?" hint="Aktueller Kontostand gegen alles, was noch abgeht" />
      <div className="plan-lines">
        <PlanInputLine label="Aktueller Kontostand" value={balance} onCommit={setBalance} />
        <Divider />
        <PlanLine label="Feste Abzüge" value={calc.fixed} tone="muted" />
        <PlanLine label="Variable Ausgaben" value={calc.variable} tone="muted" />
        <PlanLine label="Geht noch ab" value={calc.needed} strong />
        <Divider />
        <PlanLine label="Konto danach" value={calc.remaining} signed strong />
      </div>
      <VerdictBanner tone={tone} calc={calc} />
    </Card>
  )
}
