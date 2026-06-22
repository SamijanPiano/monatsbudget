import { useEffect, useState } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import { getSyncConfig, setSyncConfig, isSyncConfigured, type SyncConfig } from '../../lib/syncConfig'
import { listAspsps, startConnect, fetchAccounts, fetchTransactions, type Aspsp } from '../../lib/bankApi'
import { toParsed } from '../../lib/sync'
import { Card, SectionTitle } from '../ui/Card'

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
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)

  const configured = isSyncConfigured(config)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('bank') === 'connected') {
      setStatus({ tone: 'ok', text: 'Bank verbunden. Tippe auf „Jetzt synchronisieren".' })
    }
  }, [])

  function save() {
    setSyncConfig(config)
    setLocalConfig(getSyncConfig())
    setStatus({ tone: 'ok', text: 'Backend gespeichert.' })
  }

  async function loadBanks() {
    setBusy(true)
    setStatus(null)
    try {
      const list = await listAspsps(config)
      setBanks(list)
      if (list[0]) setSelected(list[0].name)
      if (list.length === 0) setStatus({ tone: 'info', text: 'Keine Banken zurückgegeben.' })
    } catch (e) {
      setStatus({ tone: 'error', text: errMsg(e) })
    } finally {
      setBusy(false)
    }
  }

  async function connect() {
    const bank = banks.find((b) => b.name === selected)
    if (!bank) return
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
      <SectionTitle title="Bank-Sync (live)" hint="Automatischer Abruf via Enable Banking" />

      <div className="sync-field">
        <label className="sync-label">Backend-URL (dein Worker)</label>
        <input
          className="sync-input"
          inputMode="url"
          placeholder="https://…workers.dev"
          value={config.url}
          onChange={(e) => setLocalConfig({ ...config, url: e.target.value })}
        />
      </div>
      <div className="sync-field">
        <label className="sync-label">Zugriffs-Token</label>
        <input
          className="sync-input"
          type="password"
          placeholder="dein APP_TOKEN"
          value={config.token}
          onChange={(e) => setLocalConfig({ ...config, token: e.target.value })}
        />
      </div>
      <div className="sync-actions">
        <button type="button" className="btn btn--outline" onClick={save}>
          Speichern
        </button>
        {configured && (
          <button type="button" className="btn btn--outline" onClick={loadBanks} disabled={busy}>
            Banken laden
          </button>
        )}
      </div>

      {configured && banks.length > 0 && (
        <div className="sync-field">
          <label className="sync-label">Bank wählen</label>
          <div className="sync-actions">
            <select className="sync-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {banks.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn--primary" onClick={connect} disabled={busy}>
              Bank verbinden
            </button>
          </div>
        </div>
      )}

      {configured && (
        <div className="sync-actions" style={{ marginTop: 'var(--space-3)' }}>
          <button type="button" className="btn btn--primary" onClick={sync} disabled={busy}>
            Jetzt synchronisieren
          </button>
        </div>
      )}

      {status && <p className={`import__msg import__msg--${status.tone}`}>{status.text}</p>}

      {!configured && (
        <p className="sync-hint">
          Noch kein Backend? Die Einrichtung (Enable Banking + Cloudflare Worker) steht in
          <code> backend/SETUP.md</code>. ~15 Min einmalig — danach syncst du auf Knopfdruck.
        </p>
      )}
    </Card>
  )
}
