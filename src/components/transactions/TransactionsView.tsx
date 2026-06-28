import { useMemo, useState } from 'react'
import { useBudgetStore, useCashEnabled } from '../../store/budgetStore'
import type { Category, Transaction } from '../../types/budget'
import { Card, SectionTitle } from '../ui/Card'
import { formatCents, formatMonthId } from '../../lib/format'
import { currentMonthId } from '../../lib/seed'
import { sumForMonth, monthKey } from '../../lib/forecast'
import { ImportButton } from './ImportButton'
import { CategorySelect } from './CategorySelect'
import { DisposableHero } from './DisposableHero'
import { RecurringCard } from './RecurringCard'
import { BankSyncSection } from '../sync/BankSyncSection'

type GroupMode = 'category' | 'month'

/** Eine Buchungsgruppe mit Titel und Summe (signed Cent). */
interface TxGroup {
  key: string
  title: string
  txs: Transaction[]
  sum: number
}

function sortByDateDesc(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

function sumOf(txs: Transaction[]): number {
  return txs.reduce((s, t) => s + t.amount, 0)
}

/** Gruppiert Buchungen nach Monat (absteigend). */
function groupByMonth(txs: Transaction[]): TxGroup[] {
  const groups = new Map<string, Transaction[]>()
  for (const tx of sortByDateDesc(txs)) {
    const key = monthKey(tx.date)
    const list = groups.get(key) ?? []
    list.push(tx)
    groups.set(key, list)
  }
  return [...groups.entries()].map(([key, list]) => ({
    key,
    title: formatMonthId(key),
    txs: list,
    sum: sumOf(list),
  }))
}

/** Gruppiert Buchungen nach Kategorie, sortiert nach Bewegungs-Höhe. */
function groupByCategory(txs: Transaction[], categories: Category[]): TxGroup[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const groups = new Map<string, Transaction[]>()
  for (const tx of sortByDateDesc(txs)) {
    const key = tx.categoryId ?? '__none__'
    const list = groups.get(key) ?? []
    list.push(tx)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const cat = byId.get(key)
      const title = cat ? `${cat.icon ? `${cat.icon} ` : ''}${cat.label}` : 'Ohne Kategorie'
      return { key, title, txs: list, sum: sumOf(list) }
    })
    .sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum))
}

export function TransactionsView() {
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const accounts = useBudgetStore((s) => s.accounts)
  const setAccountBalance = useBudgetStore((s) => s.setAccountBalance)
  const recategorizeAll = useBudgetStore((s) => s.recategorizeAll)
  const cashEnabled = useCashEnabled()
  const [groupMode, setGroupMode] = useState<GroupMode>('category')

  function handleRecategorize() {
    const ok = window.confirm(
      'Alle Buchungen neu sortieren? Dabei werden auch von dir manuell gesetzte ' +
        'Kategorien überschrieben. Unklare Buchungen landen in „Sonstiges".',
    )
    if (ok) recategorizeAll()
  }

  const checking = accounts.find((a) => a.type === 'checking') ?? accounts[0]
  const cashAccount = accounts.find((a) => a.type === 'cash')
  const key = currentMonthId()

  const groups = useMemo(
    () =>
      groupMode === 'category'
        ? groupByCategory(transactions, categories)
        : groupByMonth(transactions),
    [transactions, categories, groupMode],
  )

  const balance = checking?.balance ?? null
  const summary = sumForMonth(transactions, key)

  if (transactions.length === 0) {
    return (
      <div className="view-stack">
        <BankSyncSection />
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
      <BankSyncSection />

      <DisposableHero />

      <Card>
        <SectionTitle title="Aktueller Kontostand" hint="Aus Bank-Sync · Basis für die Prognose" />
        <BalanceDisplay value={balance} />
        {cashEnabled && cashAccount && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <SectionTitle title="Bargeld" hint="Manuell eintragen" />
            <BalanceEditor
              value={cashAccount.balance}
              onChange={(cents) => setAccountBalance(cashAccount.id, cents)}
            />
          </div>
        )}
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

      <RecurringCard />

      <Card>
        <div className="tx-head">
          <SectionTitle title="Buchungen" hint={`${transactions.length} gesamt`} />
          <ImportButton />
        </div>
        <div className="tx-groupmode" role="group" aria-label="Gruppierung wechseln">
          <button
            type="button"
            className={`tx-seg ${groupMode === 'category' ? 'is-on' : ''}`}
            aria-pressed={groupMode === 'category'}
            onClick={() => setGroupMode('category')}
          >
            Nach Kategorie
          </button>
          <button
            type="button"
            className={`tx-seg ${groupMode === 'month' ? 'is-on' : ''}`}
            aria-pressed={groupMode === 'month'}
            onClick={() => setGroupMode('month')}
          >
            Nach Monat
          </button>
        </div>
        <button type="button" className="tx-recategorize" onClick={handleRecategorize}>
          ↻ Alle neu kategorisieren
        </button>
        <div className="tx-list">
          {groups.map((group) => (
            <div key={group.key} className="tx-group">
              <h3 className="tx-group__head">
                <span>{group.title}</span>
                <span className={`tx-group__sum tnum ${group.sum < 0 ? 'text-negative' : 'text-positive'}`}>
                  {formatCents(group.sum)}
                </span>
              </h3>
              {group.txs.map((tx) => (
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

function BalanceDisplay({ value }: { value: number | null }) {
  return (
    <div className="balance-editor">
      <span className="balance-editor__input tnum balance-editor__readonly">
        {value === null ? '—' : (value / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className="balance-editor__cur">€</span>
    </div>
  )
}

interface BalanceEditorProps {
  value: number | null
  onChange: (cents: number) => void
}

function BalanceEditor({ value, onChange }: BalanceEditorProps) {
  const display = value === null ? '' : (value / 100).toFixed(2)
  const [text, setText] = useState(display)

  // Derive-state-from-props: re-sync the input when the `value` prop changes
  // by tracking the previous prop instead of synchronizing inside an effect.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(display)
  }

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
        aria-label="Bargeldbestand in Euro"
      />
      <span className="balance-editor__cur">€</span>
    </div>
  )
}
