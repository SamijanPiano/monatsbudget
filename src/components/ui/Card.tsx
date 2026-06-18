import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  as?: 'div' | 'section'
}

export function Card({ children, className = '', as = 'div' }: CardProps) {
  const Tag = as
  return <Tag className={`card ${className}`.trim()}>{children}</Tag>
}

interface SectionTitleProps {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}

export function SectionTitle({ icon, title, hint, action }: SectionTitleProps) {
  return (
    <div className="section-title">
      <div className="section-title__main">
        {icon && <span className="section-title__icon">{icon}</span>}
        <div>
          <h2>{title}</h2>
          {hint && <p className="section-title__hint">{hint}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
