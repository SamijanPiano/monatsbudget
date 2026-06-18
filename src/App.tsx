import { useEffect, useState } from 'react'
import { Header } from './components/layout/Header'
import { BottomNav } from './components/layout/BottomNav'
import type { TabId } from './components/layout/nav'
import { Dashboard } from './components/dashboard/Dashboard'
import { PlanView } from './components/sections/PlanView'
import { ReichtEsCheck } from './components/situation/ReichtEsCheck'
import { HistoryView } from './components/history/HistoryView'
import { SettingsView } from './components/settings/SettingsView'

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard')

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <div className="app-main__inner" key={tab}>
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'plan' && <PlanView />}
          {tab === 'check' && <ReichtEsCheck />}
          {tab === 'history' && <HistoryView />}
          {tab === 'settings' && <SettingsView />}
        </div>
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
