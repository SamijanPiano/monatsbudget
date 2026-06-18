import { Money } from '../ui/Money'

interface KpiCardProps {
  label: string
  value: number
  signed?: boolean
  tone?: 'konto' | 'bar' | 'muted' | 'default'
  sub?: string
  accent?: 'gold' | 'positive' | 'negative' | 'bar'
}

export function KpiCard({ label, value, signed, tone, sub, accent = 'gold' }: KpiCardProps) {
  return (
    <div className={`kpi kpi--${accent}`}>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">
        <Money value={value} signed={signed} tone={tone} />
      </span>
      {sub && <span className="kpi__sub">{sub}</span>}
    </div>
  )
}
