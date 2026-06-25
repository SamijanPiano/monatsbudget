import { useState } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import { Card, SectionTitle } from '../ui/Card'
import { BackBar } from '../ui/BackBar'
import { Button } from '../ui/Button'
import { CentInput } from '../ui/CentInput'
import { IconSend } from '../ui/icons'
import { getSyncConfig, isSyncConfigured } from '../../lib/syncConfig'
import { formatIban, isValidIban } from '../../lib/iban'
import {
  buildTransferRequest,
  initiatePayment,
  isValid,
  validateTransfer,
  type TransferErrors,
} from '../../lib/payments'

interface Props {
  onBack: () => void
}

export function PaymentsView({ onBack }: Props) {
  const settings = useBudgetStore((s) => s.settings)
  const updateSettings = useBudgetStore((s) => s.updateSettings)

  const enabled = settings.paymentsEnabled === true
  const configured = isSyncConfigured()

  const [name, setName] = useState('')
  const [iban, setIban] = useState('')
  const [amountCents, setAmountCents] = useState<number | null>(null)
  const [remittance, setRemittance] = useState('')
  const [errors, setErrors] = useState<TransferErrors>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setApiError(null)
    const found = validateTransfer({ creditorName: name, iban, amountCents, remittance })
    setErrors(found)
    if (!isValid(found)) return

    const request = buildTransferRequest({ creditorName: name, iban, amountCents, remittance })
    try {
      setSubmitting(true)
      const { authUrl } = await initiatePayment(getSyncConfig(), request, window.location.href)
      if (authUrl) {
        // Weiter zur Bank-Freigabe (SCA).
        window.location.href = authUrl
      } else {
        setApiError('Keine Freigabe-URL von der Bank erhalten.')
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Überweisung fehlgeschlagen.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Gated: Feature aus ─────────────────────────────────────────────────────
  if (!enabled) {
    return (
      <div className="view-stack">
        <BackBar onBack={onBack} />
        <Card>
          <SectionTitle title="Überweisungen" hint="Direkt aus der App per PSD2" />
          <p className="settings-text">
            Du kannst Überweisungen direkt über deine verbundene Bank auslösen (Enable Banking,
            PSD2). Die Freigabe passiert wie gewohnt sicher in deiner Banking-App (SCA).
          </p>
          <p className="notice" style={{ marginBottom: 'var(--space-3)' }}>
            Diese Funktion ist neu und sollte zuerst mit der Sandbox getestet werden. Aktiviere sie
            nur, wenn dein Bank-Backend dafür eingerichtet ist.
          </p>
          <div className="settings-toggle-row">
            <span className="settings-toggle-label">Überweisungen aktivieren</span>
            <button
              type="button"
              role="switch"
              aria-checked={false}
              className="settings-toggle"
              onClick={() => updateSettings({ paymentsEnabled: true })}
            >
              <span className="settings-toggle__knob" />
            </button>
          </div>
        </Card>
      </div>
    )
  }

  // ── Gated: Backend fehlt ───────────────────────────────────────────────────
  if (!configured) {
    return (
      <div className="view-stack">
        <BackBar onBack={onBack} />
        <Card>
          <SectionTitle title="Überweisungen" hint="Bank-Backend erforderlich" />
          <p className="notice">
            Richte zuerst unter „Mehr → Bank-Sync" deine Backend-URL und dein Zugriffs-Token ein.
            Erst dann können Überweisungen ausgelöst werden.
          </p>
          <div className="settings-actions" style={{ marginTop: 'var(--space-3)' }}>
            <Button variant="outline" onClick={() => updateSettings({ paymentsEnabled: false })}>
              Funktion wieder deaktivieren
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const ibanValid = iban.trim() === '' || isValidIban(iban)

  // ── Aktiv: Überweisungsformular ────────────────────────────────────────────
  return (
    <div className="view-stack">
      <BackBar onBack={onBack} />
      <Card>
        <SectionTitle title="Überweisung" hint="Wird in deiner Bank freigegeben (SCA)" />

        <div className="field">
          <label className="field__label" htmlFor="pay-name">
            Empfänger
          </label>
          <input
            id="pay-name"
            className="field__input"
            value={name}
            placeholder="Name des Empfängers"
            onChange={(e) => setName(e.target.value)}
          />
          {errors.creditorName && <span className="field__error">{errors.creditorName}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="pay-iban">
            IBAN
          </label>
          <input
            id="pay-iban"
            className="field__input"
            value={iban}
            placeholder="DE.."
            autoCapitalize="characters"
            onChange={(e) => setIban(e.target.value)}
            onBlur={() => iban.trim() && setIban(formatIban(iban))}
          />
          {!ibanValid && <span className="field__error">IBAN sieht nicht gültig aus.</span>}
          {errors.iban && ibanValid && <span className="field__error">{errors.iban}</span>}
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="pay-amount">
              Betrag
            </label>
            <CentInput
              value={amountCents}
              ariaLabel="Überweisungsbetrag"
              placeholder="0,00"
              onCommit={(cents) => setAmountCents(cents)}
            />
            {errors.amount && <span className="field__error">{errors.amount}</span>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="pay-purpose">
              Verwendungszweck
            </label>
            <input
              id="pay-purpose"
              className="field__input"
              value={remittance}
              placeholder="z. B. Miete Juni"
              onChange={(e) => setRemittance(e.target.value)}
            />
          </div>
        </div>

        {apiError && (
          <p className="settings-msg is-bad" role="status">
            {apiError}
          </p>
        )}

        <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
          <IconSend /> {submitting ? 'Wird vorbereitet…' : 'Weiter zur Bank-Freigabe'}
        </Button>

        <p className="settings-text settings-text--faint" style={{ marginTop: 'var(--space-3)' }}>
          Es wird nichts ohne deine Bestätigung in der Bank gebucht. Daueraufträge folgen, sobald
          deine Bank sie über die Schnittstelle unterstützt.
        </p>
      </Card>
    </div>
  )
}
