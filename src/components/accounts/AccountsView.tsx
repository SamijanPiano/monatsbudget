import { useState, type ReactNode } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { BackBar } from '../ui/BackBar'
import { CentInput } from '../ui/CentInput'
import { Button } from '../ui/Button'
import {
  IconBank,
  IconHistory,
  IconPlus,
  IconReceipt,
  IconSparkles,
  IconTrash,
  IconWallet,
} from '../ui/icons'
import { netWorth } from '../../lib/networth'
import { formatCents } from '../../lib/format'
import { parseEuroCents } from '../../lib/euro'
import type { AccountType } from '../../types/budget'

interface Props {
  onBack: () => void
}

interface AccountMeta {
  label: string
  icon: (props: { size?: number }) => ReactNode
}

const ACCOUNT_META: Record<AccountType, AccountMeta> = {
  checking: { label: 'Girokonto', icon: IconBank },
  cash: { label: 'Bargeld', icon: IconWallet },
  paypal: { label: 'PayPal', icon: IconWallet },
  crypto: { label: 'Krypto', icon: IconSparkles },
  broker: { label: 'Depot', icon: IconHistory },
  credit: { label: 'Kreditkarte', icon: IconReceipt },
}

// Manuell anlegbare Konten (Giro kommt i. d. R. über den Bank-Sync).
const ADDABLE: AccountType[] = ['cash', 'paypal', 'crypto', 'broker', 'credit']

export function AccountsView({ onBack }: Props) {
  const accounts = useBudgetStore((s) => s.accounts)
  const addAccount = useBudgetStore((s) => s.addAccount)
  const removeAccount = useBudgetStore((s) => s.removeAccount)
  const setAccountBalance = useBudgetStore((s) => s.setAccountBalance)

  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('cash')
  const [balanceText, setBalanceText] = useState('')

  const worth = netWorth(accounts)

  const handleAdd = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    addAccount({
      name: trimmed,
      type,
      balance: parseEuroCents(balanceText),
      manual: true,
      isLiability: type === 'credit',
    })
    setName('')
    setBalanceText('')
    setType('cash')
  }

  return (
    <div className="view-stack">
      <BackBar onBack={onBack} />

      <Card className="hero">
        <div className="networth">
          <span className="networth__label">Gesamtvermögen</span>
          <strong
            className={`networth__value tnum ${worth.total < 0 ? 'text-negative' : ''}`}
          >
            {formatCents(worth.total)}
          </strong>
          <div className="networth__split">
            <span>Vermögen {formatCents(worth.assets)}</span>
            {worth.liabilities > 0 && <span>Schulden {formatCents(worth.liabilities)}</span>}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Konten" hint="Bankkonten kommen aus dem Sync, weitere pflegst du selbst" />
        <div className="account-list">
          {accounts.map((account) => {
            const meta = ACCOUNT_META[account.type]
            const Icon = meta.icon
            const synced = account.manual === false
            return (
              <div key={account.id} className="account-row">
                <span className="account-row__icon">
                  <Icon size={18} />
                </span>
                <div className="account-row__main">
                  <div className="account-row__name">{account.name}</div>
                  <div className="account-row__meta">
                    {meta.label} · {synced ? 'aus Bank-Sync' : 'manuell'}
                  </div>
                </div>
                {synced ? (
                  <span
                    className={`account-row__amount tnum ${
                      account.isLiability ? 'account-row__amount--liability' : ''
                    }`}
                  >
                    {account.balance != null ? formatCents(account.balance) : '—'}
                  </span>
                ) : (
                  <CentInput
                    value={account.balance}
                    ariaLabel={`Saldo ${account.name}`}
                    onCommit={(cents) => setAccountBalance(account.id, cents)}
                  />
                )}
                {!synced && (
                  <button
                    type="button"
                    className="row__remove"
                    aria-label={`${account.name} entfernen`}
                    onClick={() => {
                      if (confirm(`${account.name} entfernen?`)) removeAccount(account.id)
                    }}
                  >
                    <IconTrash size={16} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Konto hinzufügen" hint="PayPal, Krypto, Depot, Kreditkarte oder Bargeld" />
        <div className="field">
          <label className="field__label" htmlFor="acc-name">
            Name
          </label>
          <input
            id="acc-name"
            className="field__input"
            value={name}
            placeholder="z. B. PayPal"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="acc-type">
              Art
            </label>
            <select
              id="acc-type"
              className="field__input"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
            >
              {ADDABLE.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_META[t].label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="acc-balance">
              Stand
            </label>
            <input
              id="acc-balance"
              className="field__input"
              inputMode="decimal"
              value={balanceText}
              placeholder="0,00 €"
              onChange={(e) => setBalanceText(e.target.value)}
            />
          </div>
        </div>
        <Button variant="primary" onClick={handleAdd} disabled={!name.trim()}>
          <IconPlus /> Konto hinzufügen
        </Button>
      </Card>
    </div>
  )
}
