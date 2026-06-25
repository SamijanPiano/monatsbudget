import type { ReactNode } from 'react'
import {
  IconDashboard,
  IconHistory,
  IconReceipt,
  IconSettings,
} from '../ui/icons'

export type TabId =
  | 'dashboard'
  | 'buchungen'
  | 'analyse'
  | 'schulden'
  | 'history'
  | 'settings'
  | 'ai'
  // Sekundär-Views, erreichbar über den „Mehr"-Hub:
  | 'budgets'
  | 'berichte'
  | 'vermoegen'
  | 'vertraege'
  | 'zahlungen'

export interface TabDef {
  id: TabId
  label: string
  icon: (props: { size?: number }) => ReactNode
}

export const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Übersicht', icon: IconDashboard },
  { id: 'buchungen', label: 'Buchungen', icon: IconReceipt },
  { id: 'analyse', label: 'Analyse', icon: IconHistory },
  { id: 'settings', label: 'Mehr', icon: IconSettings },
]

/**
 * Sekundär-Views und ausgelagerte Features mappen auf „Mehr" in der Bottom-Nav.
 */
const SECONDARY_TABS: TabId[] = [
  'budgets', 'berichte', 'vermoegen', 'vertraege', 'zahlungen',
  'history', 'ai', 'schulden',
]

/** Welcher Bottom-Tab als aktiv gilt. */
export function bottomActiveFor(tab: TabId): TabId {
  return SECONDARY_TABS.includes(tab) ? 'settings' : tab
}

/** Auf welchen Tabs der Monats-Umschalter im Kopf sinnvoll ist. */
export const BUDGET_TABS: TabId[] = ['history', 'analyse']
