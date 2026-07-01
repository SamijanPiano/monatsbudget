import { useState } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { BackBar } from '../ui/BackBar'
import { Button } from '../ui/Button'
import { IconBell, IconPlus, IconRefresh, IconTrash } from '../ui/icons'
import { dueReminders, noticeDeadline } from '../../lib/contracts'
import {
  notificationPermission,
  requestNotificationPermission,
} from '../../lib/notifications'
import { formatCents } from '../../lib/format'
import { dateShort, parseEuroCents, todayIso } from '../../lib/euro'
import { RecurringForecast } from './RecurringForecast'
import type { ContractCadence } from '../../types/budget'

interface Props {
  onBack: () => void
}

const CADENCE_LABEL: Record<ContractCadence, string> = {
  monthly: 'monatlich',
  quarterly: 'quartalsweise',
  yearly: 'jährlich',
}

export function ContractsView({ onBack }: Props) {
  const contracts = useBudgetStore((s) => s.contracts)
  const recurringRules = useBudgetStore((s) => s.recurringRules)
  const addContract = useBudgetStore((s) => s.addContract)
  const updateContract = useBudgetStore((s) => s.updateContract)
  const removeContract = useBudgetStore((s) => s.removeContract)
  const markContractCanceled = useBudgetStore((s) => s.markContractCanceled)
  const syncContractsFromRecurring = useBudgetStore((s) => s.syncContractsFromRecurring)

  const [perm, setPerm] = useState(notificationPermission())
  const [label, setLabel] = useState('')
  const [amountText, setAmountText] = useState('')

  const reminders = dueReminders(contracts, new Date(), 30)
  const detectableCount = recurringRules.filter((r) => r.amountApprox < 0).length

  const handleAdd = () => {
    const trimmed = label.trim()
    if (!trimmed) return
    const cents = parseEuroCents(amountText)
    addContract({
      label: trimmed,
      counterparty: trimmed,
      categoryId: null,
      amountApprox: cents ? -Math.abs(cents) : 0,
      cadence: 'monthly',
      nextDue: todayIso(),
      status: 'active',
      source: 'manual',
    })
    setLabel('')
    setAmountText('')
  }

  return (
    <div className="view-stack">
      <BackBar onBack={onBack} />

      {reminders.length > 0 && (
        <Card>
          <SectionTitle title="Vertragswecker" hint="Kündigungsfristen laufen bald ab" />
          <div className="view-stack" style={{ gap: 'var(--space-2)' }}>
            {reminders.map((r) => (
              <div key={r.contract.id} className="reminder-card">
                <span className="reminder-card__icon">
                  <IconBell size={18} />
                </span>
                <div>
                  <div className="account-row__name">{r.contract.label}</div>
                  <div className="account-row__meta">
                    Kündigen bis {dateShort(r.deadline)} ·{' '}
                    <span className="reminder-card__days">
                      {r.daysLeft === 0 ? 'heute' : `noch ${r.daysLeft} Tage`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle title="Verträge & Abos" hint="Aus deinen Buchungen erkannt oder selbst gepflegt" />
        <div className="settings-actions">
          <Button
            variant="outline"
            onClick={syncContractsFromRecurring}
            disabled={detectableCount === 0}
          >
            <IconRefresh /> Aus Buchungen erkennen
            {detectableCount > 0 ? ` (${detectableCount})` : ''}
          </Button>
          {perm === 'default' && (
            <Button
              variant="ghost"
              onClick={async () => setPerm(await requestNotificationPermission())}
            >
              <IconBell size={16} /> Erinnerungen aktivieren
            </Button>
          )}
        </div>
      </Card>

      {contracts.length === 0 ? (
        <Card>
          <div className="empty">
            <h2 className="empty__title">Noch keine Verträge</h2>
            <p className="empty__text">
              Tippe auf „Aus Buchungen erkennen", um Abos und Daueraufträge automatisch aus
              deinen Umsätzen zu übernehmen — oder füge unten einen Vertrag manuell hinzu.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="contract-list">
            {contracts.map((c) => {
              const deadline = noticeDeadline(c)
              const canceled = c.status === 'canceled'
              return (
                <div
                  key={c.id}
                  className={`contract-row ${canceled ? 'contract-row--canceled' : ''}`}
                  style={{ flexWrap: 'wrap' }}
                >
                  <div className="contract-row__main">
                    <div className="contract-row__name">{c.label}</div>
                    <div className="contract-row__meta">
                      {formatCents(Math.abs(c.amountApprox))} · {CADENCE_LABEL[c.cadence]}
                      {c.source === 'detected' && ' · erkannt'}
                      {deadline && ` · Frist ${dateShort(deadline)}`}
                    </div>
                    {!canceled && (
                      <RecurringForecast contractId={c.id} counterparty={c.counterparty} />
                    )}
                  </div>
                  <span className={`pill ${canceled ? 'pill--muted' : 'pill--ok'}`}>
                    {canceled ? 'gekündigt' : 'aktiv'}
                  </span>
                  <button
                    type="button"
                    className="row__remove"
                    aria-label={`${c.label} entfernen`}
                    onClick={() => {
                      if (confirm(`${c.label} entfernen?`)) removeContract(c.id)
                    }}
                  >
                    <IconTrash size={16} />
                  </button>

                  <div className="field-row" style={{ flexBasis: '100%' }}>
                    <div className="field">
                      <label className="field__label" htmlFor={`end-${c.id}`}>
                        Vertragsende
                      </label>
                      <input
                        id={`end-${c.id}`}
                        type="date"
                        className="field__input"
                        value={c.contractEnd ?? ''}
                        onChange={(e) =>
                          updateContract(c.id, { contractEnd: e.target.value || undefined })
                        }
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor={`notice-${c.id}`}>
                        Kündigungsfrist (Tage)
                      </label>
                      <input
                        id={`notice-${c.id}`}
                        type="number"
                        min={0}
                        className="field__input"
                        value={c.noticePeriodDays ?? ''}
                        placeholder="z. B. 30"
                        onChange={(e) =>
                          updateContract(c.id, {
                            noticePeriodDays: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>
                  </div>

                  <Button
                    variant={canceled ? 'ghost' : 'outline'}
                    size="sm"
                    onClick={() =>
                      canceled
                        ? updateContract(c.id, { status: 'active' })
                        : markContractCanceled(c.id)
                    }
                  >
                    {canceled ? 'Wieder aktiv' : 'Als gekündigt markieren'}
                  </Button>
                </div>
              )
            })}
          </div>
          <p className="settings-text settings-text--faint" style={{ marginTop: 'var(--space-3)' }}>
            Hinweis: Das Versenden einer echten Kündigung ist (noch) nicht enthalten — hier
            verwaltest du Fristen und behältst den Überblick.
          </p>
        </Card>
      )}

      <Card>
        <SectionTitle title="Vertrag hinzufügen" hint="Monatlicher Betrag" />
        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="contract-label">
              Name
            </label>
            <input
              id="contract-label"
              className="field__input"
              value={label}
              placeholder="z. B. Fitnessstudio"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="contract-amount">
              Betrag / Monat
            </label>
            <input
              id="contract-amount"
              className="field__input"
              inputMode="decimal"
              value={amountText}
              placeholder="0,00 €"
              onChange={(e) => setAmountText(e.target.value)}
            />
          </div>
        </div>
        <Button variant="primary" onClick={handleAdd} disabled={!label.trim()}>
          <IconPlus /> Vertrag hinzufügen
        </Button>
      </Card>
    </div>
  )
}
