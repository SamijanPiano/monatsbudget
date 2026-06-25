import type { ReactNode } from 'react'
import {
  IconAI,
  IconDashboard,
  IconReceipt,
  IconSettings,
  IconUsers,
} from '../ui/icons'

export type TabId = 'dashboard' | 'buchungen' | 'schulden' | 'history' | 'settings' | 'ai'

export interface TabDef {
  id: TabId
  label: string
  icon: (props: { size?: number }) => ReactNode
}

export const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Übersicht', icon: IconDashboard },
  { id: 'buchungen', label: 'Buchungen', icon: IconReceipt },
  { id: 'ai', label: 'KI', icon: IconAI },
  { id: 'schulden', label: 'Schulden', icon: IconUsers },
  { id: 'settings', label: 'Mehr', icon: IconSettings },
]

/** Auf welchen Tabs der Monats-Umschalter im Kopf sinnvoll ist. */
export const BUDGET_TABS: TabId[] = ['history']
