import { useState } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import {
  getSyncConfig,
  setSyncConfig,
  isSyncConfigured,
  type SyncConfig,
} from '../../lib/syncConfig'
import { listAspsps, startConnect, fetchAccounts, fetchTransactions, type Aspsp } from '../../lib/bankApi'
import { toParsed } from '../../lib/sync'
import { Card, SectionTitle } from '../ui/Card'
import { BankPicker } from './BankPicker'

type Status = { tone: 'ok' | 'error' | 'info'; text: string }

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Unbekannter Fehler.'
}

export function BankSyncSection() {
  const importParsed = useBudgetStore((s) => s.importParsed)
  const accounts = useBudgetStore((s) => s.accounts)
  const setAccountBalance = useBudgetStore((s) => s.setAccountBalance)

  const [config, setLocalConfig] = useState<SyncConfig>(getSyncConfig())
  const [banks, setBanks] = useState<Aspsp[]>([])
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  // Initial-Status direkt aus der Redirect-URL ableiten (kein Effekt nötig).
  const [status, setStatus] = useState<Status | null>(() =>
    new URLSearchParams(window.location.search).get('bank') === 'connected'
      ? { tone: 'ok', text: 'Bank verbunden. Tippe auf „Jetzt synchronisieren".' }
      : null,
  )

  const configured = isSyncConfigured(config)

  async function openPicker() {
    setBusy(true)
    setStatus(null)
    try {
      const list = await listAspsps(config)
      setBanks(list)
      setPicking(true)
      if (list.length === 0) setStatus({ tone: 'info', text: 'Keine Banken gefunden.' })
    } catch (e) {
      setStatus({ tone: 'error', text: errMsg(e) })
    } finally {
      setBusy(false)
    }
  }

  async function connect(bank: Aspsp) {
    setBusy(true)
    try {
      const redirectUrl = window.location.origin + window.location.pathname
      const { authUrl } = await startConnect(config, bank, redirectUrl)
      window.location.href = authUrl
    } catch (e) {
      setStatus({ tone: 'error', text: errMsg(e) })
      setBusy(false)
    }
  }

  async function sync() {
    setBusy(true)
    setStatus({ tone: 'info', text: 'Synchronisiere…' })
    try {
      const accs = await fetchAccounts(config)
      const checking = accounts.find((a) => a.type === 'checking') ?? accounts[0]
      if (accs[0] && checking && accs[0].balance !== null) {
        setAccountBalance(checking.id, accs[0].balance)
      }
      const since = daysAgoIso(90)
      let total = 0
      for (const a of accs) {
        const rows = await fetchTransactions(config, a.id, since)
        total += importParsed(toParsed(rows))
      }
      setStatus({
        tone: 'ok',
        text: total > 0 ? `${total} neue Buchungen synchronisiert.` : 'Keine neuen Buchungen.',
      })
    } catch (e) {
      setStatus({ tone: 'error', text: errMsg(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <SectionTitle title="Bankkonto" hint="Online anmelden – Umsätze kommen automatisch" />

      {configured ? (
        <>
          {picking ? (
            <BankPicker banks={banks} busy={busy} onSelect={connect} onCancel={() => setPicking(false)} />
          ) : (
            <button type="button" className="bank-btn bank-btn--primary" onClick={openPicker} disabled={busy}>
              {busy ? 'Lade Banken…' : 'Bank verbinden'}
            </button>
          )}

          {!picking && (
            <button
              type="button"
              className="bank-btn bank-btn--ghost"
              onClick={sync}
              disabled={busy}
              style={{ marginTop: 'var(--space-3)' }}
            >
              Jetzt synchronisieren
            </button>
          )}
        </>
      ) : (
        <SetupFallback
          config={config}
          onChange={setLocalConfig}
          onSave={() => {
            setSyncConfig(config)
            setLocalConfig(getSyncConfig())
            setStatus({ tone: 'ok', text: 'Einrichtung gespeichert.' })
          }}
        />
      )}

      {status && <p className={`import__msg import__msg--${status.tone}`}>{status.text}</p>}
    </Card>
  )
}

interface SetupFallbackProps {
  config: SyncConfig
  onChange: (config: SyncConfig) => void
  onSave: () => void
}

/**
 * Einmalige technische Einrichtung. Erscheint nur, wenn weder Build-Env noch
 * localStorage ein Backend liefern — für den normalen Nutzer also nie.
 */
function SetupFallback({ config, onChange, onSave }: SetupFallbackProps) {
  return (
    <details className="bank-advanced" open>
      <summary>Einmalige Einrichtung</summary>
      <p className="sync-hint">
        Backend (Enable Banking + Cloudflare Worker) hinterlegen — siehe <code>backend/SETUP.md</code>.
        Danach verbindest du Banken auf Knopfdruck.
      </p>
      <div className="sync-field">
        <label className="sync-label">Backend-URL</label>
        <input
          className="sync-input"
          inputMode="url"
          placeholder="https://…workers.dev"
          value={config.url}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
        />
      </div>
      <div className="sync-field">
        <label className="sync-label">Zugriffs-Token</label>
        <input
          className="sync-input"
          type="password"
          placeholder="dein APP_TOKEN"
          value={config.token}
          onChange={(e) => onChange({ ...config, token: e.target.value })}
        />
      </div>
      <button type="button" className="bank-btn bank-btn--primary" onClick={onSave}>
        Speichern
      </button>
    </details>
  )
}
