import type { ReactNode } from 'react'
import { IconArrowLeft } from '../ui/icons'

interface SubHeaderProps {
  title: string
  eyebrow?: string
  onBack?: () => void
  action?: ReactNode
}

export function SubHeader({ title, eyebrow, onBack, action }: SubHeaderProps) {
  return (
    <div className="sal-appbar">
      {onBack ? (
        <button type="button" className="sal-iconbtn" aria-label="Zurück" onClick={onBack}>
          <IconArrowLeft />
        </button>
      ) : (
        <span className="sal-appbar__spacer" />
      )}
      <div className="sal-appbar__titles">
        {eyebrow && <p className="sal-appbar__eyebrow">{eyebrow}</p>}
        <h2 className="sal-appbar__title">{title}</h2>
      </div>
      <div className="sal-appbar__action">{action}</div>
    </div>
  )
}
