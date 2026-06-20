import { useRef, useState } from 'react'
import { useBudgetStore, useCashEnabled } from '../../store/budgetStore'
import { useActiveMonth } from '../../hooks/useActiveMonth'
import { Card, SectionTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { NumberInput } from '../ui/NumberInput'
import { IconDownload, IconUpload } from '../ui/icons'
import { GoalCard } from '../goals/GoalCard'
import { serializeBackup, parseUnifiedBackup } from '../../lib/backup'
import { formatMonthId } from '../../lib/format'
import { useSaldoStore, saldoSnapshot } from '../../store/saldoStore'

export function SettingsView() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const settings = useBudgetStore((s) => s.settings)
  const updateSettings = useBudgetStore((s) => s.updateSettings)
  const resetMonth = useBudgetStore((s) => s.resetMonth)
  const deleteMonth = useBudgetStore((s) => s.deleteMonth)
  const replaceState = useBudgetStore((s) => s.replaceState)
  const setCashEnabled = useBudgetStore((s) => s.setCashEnabled)
  const restartOnboarding = useBudgetStore((s) => s.restartOnboarding)
  const goals = useBudgetStore((s) => s.profile.goals)
  const replaceSaldo = useSaldoStore((s) => s.replaceSaldo)
  const { activeMonthId } = useActiveMonth()
  const cashEnabled = useCashEnabled()

  const handleExport = () => {
    const { months, activeMonthId, settings } = useBudgetStore.getState()
    const json = serializeBackup({ months, activeMonthId, settings }, saldoSnapshot())
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `monatsbudget-backup-${date}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setMessage({ text: 'Backup wurde heruntergeladen (Budget + Schulden).', ok: true })
  }

  const handleImportClick = () => fileRef.current?.click()

  const handleFile = async (file: File) => {
    try {
      const text = await file.text()
      const { budget, saldo } = parseUnifiedBackup(text)
      if (budget) replaceState(budget)
      if (saldo) replaceSaldo(saldo)
      const what =
        budget && saldo ? 'Budget + Schulden' : budget ? 'Budget' : 'Schulden'
      setMessage({ text: `${what} erfolgreich importiert.`, ok: true })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Import fehlgeschlagen.'
      setMessage({ text: msg, ok: false })
    }
  }

  return (
    <div className="view-stack">
      <Card>
        <SectionTitle title="Sparziel" hint="Optionales langfristiges Ziel (0 = aus)" />
        <div className="savings-field savings-field--wide">
          <label htmlFor="savings-goal" className="savings-field__label">
            Gesamt-Sparziel
          </label>
          <NumberInput
            id="savings-goal"
            value={settings.savingsGoal}
            onChange={(v) => updateSettings({ savingsGoal: v })}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle title="Backup" hint="Daten sichern oder auf ein neues Gerät übertragen" />
        <p className="settings-text">
          Deine Daten liegen nur auf diesem Gerät. Exportiere regelmäßig ein Backup
          (z. B. in iCloud) und importiere es bei Bedarf wieder.
        </p>
        <div className="settings-actions">
          <Button variant="primary" onClick={handleExport}>
            <IconDownload /> Backup exportieren
          </Button>
          <Button variant="outline" onClick={handleImportClick}>
            <IconUpload /> Backup importieren
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            aria-label="JSON-Backup-Datei auswählen"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
        </div>
        {message && (
          <p className={`settings-msg ${message.ok ? 'is-ok' : 'is-bad'}`} role="status">
            {message.text}
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="Aktiver Monat"
          hint={`Aktionen für ${formatMonthId(activeMonthId)}`}
        />
        <div className="settings-actions">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm(`${formatMonthId(activeMonthId)} auf Null zurücksetzen?`)) {
                resetMonth(activeMonthId)
                setMessage({ text: 'Monat zurückgesetzt.', ok: true })
              }
            }}
          >
            Monat zurücksetzen
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(`${formatMonthId(activeMonthId)} wirklich löschen?`)) {
                deleteMonth(activeMonthId)
                setMessage({ text: 'Monat gelöscht.', ok: true })
              }
            }}
          >
            Monat löschen
          </Button>
        </div>
      </Card>

      {goals.length > 0 && (
        <Card>
          <SectionTitle title="Meine Ziele" hint="Ziele verwalten" />
          <div className="goals-list">
            {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>
          <p className="settings-text" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
            Neue Ziele kannst du über den Einrichtungsassistenten hinzufügen.
          </p>
        </Card>
      )}

      <Card>
        <SectionTitle title="Bargeld-Modus" hint="Bar-Kanal ein- oder ausblenden" />
        <p className="settings-text">
          Im Einfach-Modus siehst du nur den Konto-Kanal. Aktiviere Bar-Tracking, wenn du
          regelmäßig mit Scheinen oder Münzen zahlst.
        </p>
        <div className="settings-toggle-row">
          <span className="settings-toggle-label">Bar-Tracking aktiv</span>
          <button
            type="button"
            role="switch"
            aria-checked={cashEnabled}
            className={`settings-toggle ${cashEnabled ? 'settings-toggle--on' : ''}`}
            onClick={() => setCashEnabled(!cashEnabled)}
          >
            <span className="settings-toggle__knob" />
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Einrichtung" hint="Wizard erneut starten" />
        <p className="settings-text">
          Starte den Einrichtungsassistenten neu, um deine Ziele oder Präferenzen zu ändern.
          Deine Monatsdaten bleiben erhalten.
        </p>
        <div className="settings-actions">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('Einrichtungsassistenten neu starten? Monatsdaten bleiben erhalten.')) {
                restartOnboarding()
              }
            }}
          >
            Einrichtung neu starten
          </Button>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Als App installieren" />
        <p className="settings-text">
          In Safari auf <strong>Teilen</strong> → <strong>Zum Home-Bildschirm</strong> tippen.
          Danach startet Monatsbudget wie eine echte App — auch offline.
        </p>
        <p className="settings-text settings-text--faint">Monatsbudget · v2.0</p>
      </Card>
    </div>
  )
}
