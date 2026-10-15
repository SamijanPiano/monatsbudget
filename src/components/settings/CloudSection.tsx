import { useState } from 'react'
import { useCloudMeta, reconcile, PRE_PAIRING_BACKUP_KEY } from '../../lib/cloudSync/engine'
import { buildPairingLink } from '../../lib/pairing'
import { createPairCode } from '../../lib/bankApi'
import { JUST_PAIRED_KEY } from '../../lib/cloudSync/pairOnStart'
import { getSyncConfig, isSyncConfigured } from '../../lib/syncConfig'
import { Card, SectionTitle } from '../ui/Card'
import { Button } from '../ui/Button'

function timeLabel(iso: string | null): string {
  if (!iso) return 'noch nie'
  return new Date(iso).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Ergebnis einer Kopplung beim Öffnen: 'ok', eine Fehlermeldung oder null. */
function readJustPaired(): string | null {
  try {
    const value = sessionStorage.getItem(JUST_PAIRED_KEY)
    sessionStorage.removeItem(JUST_PAIRED_KEY)
    return value
  } catch {
    return null
  }
}

function hasPairingBackup(): boolean {
  try {
    return localStorage.getItem(PRE_PAIRING_BACKUP_KEY) !== null
  } catch {
    return false
  }
}

/** Alle Geräte gleich: Status des Abgleichs und Link zum Koppeln weiterer Geräte. */
export function CloudSection() {
  const lastSyncAt = useCloudMeta((s) => s.lastSyncAt)
  const lastError = useCloudMeta((s) => s.lastError)
  const revision = useCloudMeta((s) => s.revision)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(() => {
    const paired = readJustPaired()
    if (paired === null) return null
    return paired === 'ok' ? 'Gerät verbunden. Deine Daten werden geladen.' : paired
  })
  const configured = isSyncConfigured()

  const shareLink = async () => {
    try {
      const config = getSyncConfig()
      const { code } = await createPairCode(config)
      const link = buildPairingLink(window.location.href, { url: config.url, code })
      if (navigator.share) {
        await navigator.share({ title: 'Monatsbudget koppeln', url: link })
        return
      }
      await navigator.clipboard.writeText(link)
      setMessage('Link kopiert. Innerhalb von 10 Minuten auf dem anderen Gerät öffnen.')
    } catch (e) {
      setMessage(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Teilen abgebrochen.')
    }
  }

  const downloadBackup = () => {
    const raw = localStorage.getItem(PRE_PAIRING_BACKUP_KEY)
    if (!raw) return
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'monatsbudget-altdaten-vor-kopplung.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <SectionTitle title="Alle Geräte" hint="Handy, Mac und Browser zeigen denselben Stand" />
      {configured ? (
        <p className="settings-text">
          Zuletzt abgeglichen: <strong>{timeLabel(lastSyncAt)}</strong>
          {revision !== null && <span className="settings-text--muted"> · Stand {revision}</span>}
        </p>
      ) : (
        <p className="settings-text">
          Noch nicht verbunden. Öffne auf einem verbundenen Gerät „Weiteres Gerät verbinden“ und
          öffne den Link hier.
        </p>
      )}
      {lastError && <p className="import__msg import__msg--error">{lastError}</p>}
      {message && <p className="import__msg import__msg--ok">{message}</p>}
      {configured && (
        <div className="settings-actions">
          <Button variant="primary" onClick={shareLink}>
            Weiteres Gerät verbinden
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await reconcile()
              setBusy(false)
            }}
          >
            {busy ? 'Gleiche ab…' : 'Jetzt abgleichen'}
          </Button>
        </div>
      )}
      <p className="settings-text settings-text--muted">
        Der Link gilt 10 Minuten und nur ein einziges Mal. Nur an eigene Geräte schicken
        (z. B. per AirDrop).
      </p>
      {hasPairingBackup() && (
        <div className="settings-actions">
          <Button variant="ghost" onClick={downloadBackup}>
            Alte Daten dieses Geräts (vor dem Verbinden) herunterladen
          </Button>
        </div>
      )}
    </Card>
  )
}
