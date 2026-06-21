import { useRef, useState } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import { parseCamt053, parseCsv, detectPreset, DE_BANK_PRESETS } from '../../lib/import'
import type { ParsedTransaction } from '../../lib/import/types'
import { IconUpload } from '../ui/icons'

/**
 * Liest einen Bankauszug (CAMT.053-XML oder CSV) lokal im Browser ein, erkennt
 * das Format, parst die Buchungen und übergibt sie an den Store (mit Dedup +
 * Auto-Kategorisierung). Es verlassen keine Daten das Gerät.
 */
export function ImportButton() {
  const fileRef = useRef<HTMLInputElement>(null)
  const importParsed = useBudgetStore((s) => s.importParsed)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'info' | 'error'; text: string } | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    let parsed: ParsedTransaction[] = []
    try {
      const text = await file.text()
      const isXml = file.name.toLowerCase().endsWith('.xml') || text.trimStart().startsWith('<')
      if (isXml) {
        parsed = parseCamt053(text)
      } else {
        const headerLine = text.split(/\r?\n/)[0] ?? ''
        const preset = detectPreset(headerLine) ?? 'generic'
        parsed = parseCsv(text, DE_BANK_PRESETS[preset])
      }
    } catch {
      setMsg({ tone: 'error', text: 'Die Datei konnte nicht gelesen werden.' })
      resetInput()
      return
    }

    if (parsed.length === 0) {
      setMsg({ tone: 'error', text: 'Keine Buchungen in der Datei gefunden.' })
      resetInput()
      return
    }

    const count = importParsed(parsed)
    setMsg(
      count > 0
        ? { tone: 'ok', text: `${count} neue Buchungen importiert.` }
        : { tone: 'info', text: 'Keine neuen Buchungen — alle waren schon vorhanden.' },
    )
    resetInput()
  }

  function resetInput() {
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="import">
      <input
        ref={fileRef}
        type="file"
        accept=".xml,.csv,text/csv,text/xml,application/xml"
        className="import__input"
        onChange={handleFile}
      />
      <button type="button" className="btn btn--primary" onClick={() => fileRef.current?.click()}>
        <IconUpload size={18} />
        Bankauszug importieren
      </button>
      {msg && <p className={`import__msg import__msg--${msg.tone}`}>{msg.text}</p>}
    </div>
  )
}
