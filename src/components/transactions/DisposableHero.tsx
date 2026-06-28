import { useBudgetStore } from '../../store/budgetStore'
import { Card } from '../ui/Card'
import { formatCents } from '../../lib/format'
import { currentMonthId } from '../../lib/seed'
import { disposableThisMonth, reichtEs, dailyDisposable, remainingDaysInMonth } from '../../lib/forecast'

/**
 * „Verfügbar diesen Monat" — die zentrale Zahl, automatisch aus Kontostand,
 * erkannten Daueraufträgen und den Buchungen berechnet. Wird in Übersicht und
 * Buchungen verwendet.
 */
export function DisposableHero() {
  const transactions = useBudgetStore((s) => s.transactions)
  const accounts = useBudgetStore((s) => s.accounts)
  const recurringRules = useBudgetStore((s) => s.recurringRules)

  const checking = accounts.find((a) => a.type === 'checking') ?? accounts[0]
  const cashAccount = accounts.find((a) => a.type === 'cash')
  const key = currentMonthId()
  const balance = checking?.balance ?? null
  const cashBalance = cashAccount?.balance ?? 0
  const totalBalance = (balance ?? 0) + cashBalance

  const disposable = disposableThisMonth({
    balance: totalBalance,
    recurring: recurringRules,
    txs: transactions,
    monthKey: key,
  })
  const reicht = reichtEs({
    balance: totalBalance,
    recurring: recurringRules,
    txs: transactions,
    monthKey: key,
  })
  const perDay = dailyDisposable({
    balance: totalBalance,
    recurring: recurringRules,
    txs: transactions,
    monthKey: key,
  })
  const daysLeft = remainingDaysInMonth()

  return (
    <Card className={`hero ${reicht.ok ? 'hero--ok' : 'hero--warn'}`}>
      <span className="hero__label">Verfügbar diesen Monat</span>
      <strong className="hero__value tnum">{formatCents(disposable)}</strong>
      {balance !== null && disposable > 0 && (
        <span className="hero__daily tnum">
          ≈ {formatCents(perDay)} pro Tag · noch {daysLeft}{' '}
          {daysLeft === 1 ? 'Tag' : 'Tage'}
        </span>
      )}
      {balance === null ? (
        <p className="hero__hint">
          Trage in „Konto" deinen aktuellen Kontostand ein, damit die Berechnung stimmt.
        </p>
      ) : (
        <p className="hero__hint">
          {reicht.ok
            ? `Dein Konto deckt die erwarteten Ausgaben — Puffer ${formatCents(reicht.diff)}.`
            : `Achtung: Es fehlen voraussichtlich ${formatCents(Math.abs(reicht.diff))}.`}
        </p>
      )}
    </Card>
  )
}
