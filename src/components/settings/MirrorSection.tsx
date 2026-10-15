import { useState } from 'react'
import { useActivityStore } from '../../store/activityStore'
import { flushMirror } from '../../hooks/useMirrorSync'
import { isSyncConfigured } from '../../lib/syncConfig'
import { Card, SectionTitle } from '../ui/Card'
import { Button } from '../ui/Button'

function timeLabel(iso: string | null): string {
  if (!iso) return 'noch nie'
  const d = new Date(iso)
  return d.toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Zeigt, wann die App zuletzt an Claude gespiegelt wurde, und erlaubt das sofortige Senden. */
export function MirrorSection() {
  const lastMirrorAt = useActivityStore((s) => s.lastMirrorAt)
  const lastMirrorError = useActivityStore((s) => s.lastMirrorError)
  const pending = useActivityStore((s) => s.pending.length)
  const [busy, setBusy] = useState(false)

  return (
    <Card>
      <SectionTitle title="Für Claude" hint="Daten und Aktionen gehen an deinen eigenen Worker" />
      <p className="settings-text">
        Zuletzt gesendet: <strong>{timeLabel(lastMirrorAt)}</strong>
        {pending > 0 && ` · ${pending} ${pending === 1 ? 'Aktion wartet' : 'Aktionen warten'}`}
      </p>
      {lastMirrorError && <p className="import__msg import__msg--error">{lastMirrorError}</p>}
      {!isSyncConfigured() && (
        <p className="settings-text settings-text--muted">Erst den Bank-Sync einrichten, dann wird gespiegelt.</p>
      )}
      <div className="settings-actions">
        <Button
          variant="outline"
          disabled={busy || !isSyncConfigured()}
          onClick={async () => {
            setBusy(true)
            await flushMirror()
            setBusy(false)
          }}
        >
          {busy ? 'Sende…' : 'Jetzt senden'}
        </Button>
      </div>
    </Card>
  )
}
