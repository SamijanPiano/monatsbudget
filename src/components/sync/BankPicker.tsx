import { useMemo, useState } from 'react'
import type { Aspsp } from '../../lib/bankApi'

interface BankPickerProps {
  banks: Aspsp[]
  busy?: boolean
  onSelect: (bank: Aspsp) => void
  onCancel: () => void
}

/**
 * Banksuche: Suchfeld plus große, antippbare Bank-Kacheln.
 * Ersetzt das frühere Dropdown — mobil-freundlich und gut erreichbar.
 */
export function BankPicker({ banks, busy = false, onSelect, onCancel }: BankPickerProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return banks
    return banks.filter((b) => b.name.toLowerCase().includes(q))
  }, [banks, query])

  return (
    <div className="bank-picker">
      <input
        className="bank-search"
        type="search"
        inputMode="search"
        placeholder="Bank suchen…"
        aria-label="Bank suchen"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {filtered.length === 0 ? (
        <p className="bank-empty">Keine Bank gefunden.</p>
      ) : (
        <div className="bank-tiles" role="list">
          {filtered.map((bank) => (
            <button
              key={bank.name}
              type="button"
              role="listitem"
              className="bank-tile"
              disabled={busy}
              onClick={() => onSelect(bank)}
            >
              <span className="bank-tile__name">{bank.name}</span>
              <span className="bank-tile__country">{bank.country}</span>
            </button>
          ))}
        </div>
      )}

      <div className="bank-picker__foot">
        <button type="button" className="bank-btn bank-btn--ghost bank-btn--inline" onClick={onCancel} disabled={busy}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}
