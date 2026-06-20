import { useEffect, useState } from 'react'
import { useBudgetStore } from './store/budgetStore'
import { Header } from './components/layout/Header'
import { BottomNav } from './components/layout/BottomNav'
import { BUDGET_TABS, type TabId } from './components/layout/nav'
import { Dashboard } from './components/dashboard/Dashboard'
import { PlanView } from './components/sections/PlanView'
import { ReichtEsCheck } from './components/situation/ReichtEsCheck'
import { HistoryView } from './components/history/HistoryView'
import { SettingsView } from './components/settings/SettingsView'
import { SaldoApp } from './components/saldo/SaldoApp'
import { OnboardingWizard } from './components/onboarding/OnboardingWizard'

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard')
  const onboarded = useBudgetStore((s) => s.profile.onboarded)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  if (!onboarded) return <OnboardingWizard />

  return (
    <div className="app">
      <Header showMonth={BUDGET_TABS.includes(tab)} />
      <main className="app-main">
        <div className="app-main__inner" key={tab}>
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'plan' && <PlanView />}
          {tab === 'check' && <ReichtEsCheck />}
          {tab === 'schulden' && <SaldoApp />}
          {tab === 'history' && <HistoryView />}
          {tab === 'settings' && <SettingsView />}
        </div>
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
