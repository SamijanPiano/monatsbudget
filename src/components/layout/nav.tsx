import type { ReactNode } from 'react'
import {
  IconCheck,
  IconDashboard,
  IconHistory,
  IconPlan,
  IconSettings,
  IconUsers,
} from '../ui/icons'

export type TabId = 'dashboard' | 'plan' | 'check' | 'schulden' | 'history' | 'settings'

export interface TabDef {
  id: TabId
  label: string
  icon: (props: { size?: number }) => ReactNode
}

export const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Übersicht', icon: IconDashboard },
  { id: 'plan', label: 'Plan', icon: IconPlan },
  { id: 'check', label: 'Reicht es?', icon: IconCheck },
  { id: 'schulden', label: 'Schulden', icon: IconUsers },
  { id: 'history', label: 'Verlauf', icon: IconHistory },
  { id: 'settings', label: 'Mehr', icon: IconSettings },
]

/** Auf welchen Tabs der Monats-Umschalter im Kopf sinnvoll ist. */
export const BUDGET_TABS: TabId[] = ['dashboard', 'plan', 'check', 'history']
