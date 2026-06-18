import type { ReactNode } from 'react'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutProps {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  center?: ReactNode
}

export function Donut({ segments, size = 168, thickness = 18, center }: DonutProps) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0)

  let offset = 0
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const fraction = total > 0 ? s.value / total : 0
      const dash = fraction * circumference
      const arc = (
        <circle
          key={s.label}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={s.color}
          strokeWidth={thickness}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={-offset}
          strokeLinecap="butt"
        />
      )
      offset += dash
      return arc
    })

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={thickness}
        />
        {total > 0 && arcs}
      </svg>
      {center && <div className="donut__center">{center}</div>}
    </div>
  )
}
