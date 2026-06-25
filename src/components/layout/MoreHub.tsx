import type { ReactNode } from 'react'
import { Card, SectionTitle } from '../ui/Card'
import {
  IconAI,
  IconBank,
  IconPieChart,
  IconSend,
  IconShield,
  IconUsers,
  IconWallet,
} from '../ui/icons'
import type { TabId } from './nav'

interface HubItem {
  id: TabId
  label: string
  hint: string
  icon: (props: { size?: number }) => ReactNode
}

const ITEMS: HubItem[] = [
  { id: 'budgets', label: 'Budgets', hint: 'Limits je Kategorie', icon: IconWallet },
  { id: 'berichte', label: 'Berichte', hint: 'Ausgaben über die Zeit', icon: IconPieChart },
  { id: 'vermoegen', label: 'Vermögen', hint: 'Konten & Gesamtvermögen', icon: IconBank },
  { id: 'vertraege', label: 'Verträge', hint: 'Abos & Kündigungsfristen', icon: IconShield },
  { id: 'zahlungen', label: 'Zahlungen', hint: 'Überweisen & Daueraufträge', icon: IconSend },
  { id: 'schulden', label: 'Schulden', hint: 'Auslagen & Abrechnungen', icon: IconUsers },
  { id: 'ai', label: 'KI-Assistent', hint: 'Dein Finanz-Assistent', icon: IconAI },
]

interface MoreHubProps {
  onNavigate: (tab: TabId) => void
}

export function MoreHub({ onNavigate }: MoreHubProps) {
  return (
    <Card>
      <SectionTitle title="Funktionen" hint="Alle Features im Überblick" />
      <div className="hub-grid">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className="hub-tile"
              onClick={() => onNavigate(item.id)}
            >
              <span className="hub-tile__icon">
                <Icon size={20} />
              </span>
              <span className="hub-tile__label">{item.label}</span>
              <span className="hub-tile__hint">{item.hint}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
