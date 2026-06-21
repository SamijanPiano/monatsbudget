import { useMemo, useState } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import type { Transaction } from '../../types/budget'
import { Card, SectionTitle } from '../ui/Card'
import { formatCents, formatMonthId } from '../../lib/format'
import { currentMonthId } from '../../lib/seed'
import { disposableThisMonth, reichtEs, sumForMonth, monthKey } from '../../lib/forecast'
import { ImportButton } from './ImportButton'
import { CategorySelect } from './CategorySelect'

/** Sortiert Buchungen nach Datum absteigend und gruppiert sie nach Monat. */
function groupByMonth(txs: Transaction[]): [string, Transaction[]][] {
  const sorted = [...txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const groups = new Map<string, Transaction[]>()
  for (const tx of sorted) {
    const key = monthKey(tx.date)
    const list = groups.get(key) ?? []
    list.push(tx)
    groups.set(key, list)
  }
  return [...groups.entries()]
}

export function TransactionsView() {
  const transactions = useBudgetStore((s) => s.transactions)
  const accounts = useBudgetStore((s) => s.accounts)
  const recurringRules = useBudgetStore((s) => s.recurringRules)
  const setAccountBalance = useBudgetStore((s) => s.setAccountBalance)

  const checking = accounts.find((a) => a.type === 'checking') ?? accounts[0]
  const key = currentMonthId()

  const groups = useMemo(() => groupByMonth(transactions), [transactions])

  const balance = checking?.balance ?? null
  const disposable = disposableThisMonth({
    balance: balance ?? 0,
    recurring: recurringRules,
    txs: transactions,
    monthKey: key,
  })
  const reicht = reichtEs({
    balance: balance ?? 0,
    recurring: recurringRules,
    txs: transactions,
    monthKey: key,
  })
  const summary = sumForMonth(transactions, key)

  if (transactions.length === 0) {
    return (
      <div className="view-stack">
        <Card>
          <div className="empty">
            <h2 className="empty__title">Noch keine Buchungen</h2>
            <p className="empty__text">
              Lade einen Bankauszug (CSV oder CAMT.053-XML) aus deinem Online-Banking
              hoch. Die App ordnet die Buchungen automatisch Kategorien zu und rechnet
              aus, was dir diesen Monat noch bleibt — du musst nichts abtippen.
            </p>
            <ImportButton />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="view-stack">
      <Card className={`hero ${reicht.ok ? 'hero--ok' : 'hero--warn'}`}>
        <span className="hero__label">Verfügbar diesen Monat</span>
        <strong className="hero__value tnum">{formatCents(disposable)}</strong>
        {balance === null ? (
          <p className="hero__hint">
            Trage deinen aktuellen Kontostand ein, damit die Berechnung stimmt.
          </p>
        ) : (
          <p className="hero__hint">
            {reicht.ok
              ? `Dein Konto deckt die erwarteten Ausgaben — Puffer ${formatCents(reicht.diff)}.`
              : `Achtung: Es fehlen voraussichtlich ${formatCents(Math.abs(reicht.diff))}.`}
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle title="Aktueller Kontostand" hint="Basis für die Prognose" />
        <BalanceEditor
          value={balance}
          onChange={(cents) => checking && setAccountBalance(checking.id, cents)}
        />
        <div className="result-list" style={{ marginTop: 'var(--space-3)' }}>
          <div className="result-row">
            <span>Einnahmen {formatMonthId(key)}</span>
            <span className="tnum text-positive">{formatCents(summary.income)}</span>
          </div>
          <div className="result-row">
            <span>Ausgaben {formatMonthId(key)}</span>
            <span className="tnum text-negative">{formatCents(summary.expenses)}</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="tx-head">
          <SectionTitle title="Buchungen" hint={`${transactions.length} gesamt`} />
          <ImportButton />
        </div>
        <div className="tx-list">
          {groups.map(([gKey, list]) => (
            <div key={gKey} className="tx-group">
              <h3 className="tx-group__head">{formatMonthId(gKey)}</h3>
              {list.map((tx) => (
                <div key={tx.id} className="tx-row">
                  <div className="tx-row__main">
                    <span className="tx-row__party">{tx.counterparty || 'Unbekannt'}</span>
                    <span className="tx-row__meta">
                      {tx.date}
                      {tx.purpose ? ` · ${tx.purpose}` : ''}
                    </span>
                  </div>
                  <CategorySelect tx={tx} />
                  <span className={`tx-row__amount tnum ${tx.amount < 0 ? 'text-negative' : 'text-positive'}`}>
                    {formatCents(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

interface BalanceEditorProps {
  value: number | null
  onChange: (cents: number) => void
}

function BalanceEditor({ value, onChange }: BalanceEditorProps) {
  const [text, setText] = useState(value === null ? '' : (value / 100).toFixed(2))

  function commit() {
    const normalized = text.replace(/\./g, '').replace(',', '.')
    const euros = Number.parseFloat(normalized)
    if (Number.isFinite(euros)) onChange(Math.round(euros * 100))
  }

  return (
    <div className="balance-editor">
      <input
        className="balance-editor__input tnum"
        inputMode="decimal"
        placeholder="0,00"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        aria-label="Aktueller Kontostand in Euro"
      />
      <span className="balance-editor__cur">€</span>
    </div>
  )
}
