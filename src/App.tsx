import { useEffect, useState } from 'react'
import { useBudgetStore } from './store/budgetStore'
import { Header } from './components/layout/Header'
import { BottomNav } from './components/layout/BottomNav'
import { BUDGET_TABS, bottomActiveFor, type TabId } from './components/layout/nav'
import { Dashboard } from './components/dashboard/Dashboard'
import { TransactionsView } from './components/transactions/TransactionsView'
import { HistoryView } from './components/history/HistoryView'
import { SettingsView } from './components/settings/SettingsView'
import { SaldoApp } from './components/saldo/SaldoApp'
import { OnboardingWizard } from './components/onboarding/OnboardingWizard'
import { AiChat } from './components/ai/AiChat'
import { BudgetsView } from './components/budgets/BudgetsView'
import { ReportsView } from './components/reports/ReportsView'
import { AccountsView } from './components/accounts/AccountsView'
import { ContractsView } from './components/contracts/ContractsView'
import { PaymentsView } from './components/payments/PaymentsView'
import { AnalyseView } from './components/analyse/AnalyseView'
import { dueReminders } from './lib/contracts'
import { notify } from './lib/notifications'

// Einmaliger Vertragswecker-Check beim App-Start (StrictMode-sicher per Modul-Flag).
let remindersChecked = false
function checkContractReminders() {
  if (remindersChecked) return
  remindersChecked = true
  const { contracts } = useBudgetStore.getState()
  const due = dueReminders(contracts, new Date(), 30)
  if (due.length === 0) return
  const first = due[0]
  const extra = due.length > 1 ? ` (+${due.length - 1} weitere)` : ''
  notify(
    'Vertragswecker',
    `${first.contract.label}: Kündigungsfrist in ${first.daysLeft} Tagen${extra}.`,
  )
}

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard')
  const onboarded = useBudgetStore((s) => s.profile.onboarded)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  useEffect(() => {
    if (onboarded) {
      checkContractReminders()
      // Bestehende, noch unkategorisierte Buchungen einmalig „Sonstiges" zuordnen.
      useBudgetStore.getState().backfillCategories()
    }
  }, [onboarded])

  if (!onboarded) return <OnboardingWizard />

  const backToMore = () => setTab('settings')

  return (
    <div className="app">
      <Header showMonth={BUDGET_TABS.includes(tab)} />
      <main className="app-main">
        <div className="app-main__inner" key={tab}>
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'konto' && <TransactionsView />}
          {tab === 'analyse' && <AnalyseView />}
          {tab === 'ai' && <AiChat />}
          {tab === 'schulden' && <SaldoApp />}
          {tab === 'history' && <HistoryView />}
          {tab === 'budgets' && <BudgetsView onBack={backToMore} />}
          {tab === 'berichte' && <ReportsView onBack={backToMore} />}
          {tab === 'vermoegen' && <AccountsView onBack={backToMore} />}
          {tab === 'vertraege' && <ContractsView onBack={backToMore} />}
          {tab === 'zahlungen' && <PaymentsView onBack={backToMore} />}
          {tab === 'settings' && <SettingsView onNavigate={setTab} />}
        </div>
      </main>
      <BottomNav active={bottomActiveFor(tab)} onChange={setTab} />
    </div>
  )
}
