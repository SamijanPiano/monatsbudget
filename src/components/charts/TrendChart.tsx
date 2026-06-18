import { formatMoney } from '../../lib/format'

export interface TrendSeries {
  key: string
  label: string
  color: string
}

export interface TrendPoint {
  label: string
  values: Record<string, number>
}

interface TrendChartProps {
  data: TrendPoint[]
  series: TrendSeries[]
  height?: number
}

/** Schlanker, gruppierter Balken-Chart (reines SVG, skaliert per viewBox). */
export function TrendChart({ data, series, height = 200 }: TrendChartProps) {
  const groupWidth = 64
  const padX = 12
  const padTop = 16
  const baseline = height - 28
  const width = Math.max(data.length * groupWidth + padX * 2, 240)

  const max = Math.max(
    1,
    ...data.flatMap((p) => series.map((s) => p.values[s.key] ?? 0)),
  )
  const barW = Math.max(6, (groupWidth - 14) / series.length)

  return (
    <div className="trend">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Verlauf der Monatswerte"
      >
        {/* Grundlinie */}
        <line
          x1={padX}
          y1={baseline}
          x2={width - padX}
          y2={baseline}
          stroke="var(--border-strong)"
          strokeWidth="1"
        />
        {data.map((point, i) => {
          const groupX = padX + i * groupWidth + 7
          return (
            <g key={point.label}>
              {series.map((s, j) => {
                const value = point.values[s.key] ?? 0
                const h = (Math.max(0, value) / max) * (baseline - padTop)
                const x = groupX + j * barW
                return (
                  <rect
                    key={s.key}
                    x={x}
                    y={baseline - h}
                    width={barW - 2}
                    height={h}
                    rx="3"
                    fill={s.color}
                    opacity={0.92}
                  >
                    <title>{`${point.label} · ${s.label}: ${formatMoney(value)}`}</title>
                  </rect>
                )
              })}
              <text
                x={groupX + (series.length * barW) / 2 - 1}
                y={height - 9}
                textAnchor="middle"
                fontSize="11"
                fill="var(--text-muted)"
              >
                {point.label}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="trend__legend legend">
        {series.map((s) => (
          <span key={s.key} className="legend__item">
            <span className="legend__dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
