import type { LineItem } from '../../types/budget'
import { NumberInput } from './NumberInput'
import { IconTrash } from './icons'

interface EditableRowProps {
  item: LineItem
  showKonto?: boolean
  showBar?: boolean
  onLabel: (label: string) => void
  onKonto: (value: number) => void
  onBar: (value: number) => void
  onRemove: () => void
}

export function EditableRow({
  item,
  showKonto = true,
  showBar = true,
  onLabel,
  onKonto,
  onBar,
  onRemove,
}: EditableRowProps) {
  return (
    <div className="row" data-cols={showKonto && showBar ? 'both' : 'one'}>
      <div className="row__label">
        <input
          className="row__label-input"
          type="text"
          value={item.label}
          placeholder="Bezeichnung"
          aria-label="Bezeichnung"
          onChange={(e) => onLabel(e.target.value)}
        />
        {item.note && <span className="row__note">{item.note}</span>}
      </div>

      <div className="row__amounts">
        {showKonto && (
          <div className="amount-field">
            <span className="amount-field__tag text-konto">Konto</span>
            <NumberInput
              value={item.konto}
              onChange={onKonto}
              channel="konto"
              ariaLabel={`${item.label} — Konto`}
              size="sm"
            />
          </div>
        )}
        {showBar && (
          <div className="amount-field">
            <span className="amount-field__tag text-bar">Bar</span>
            <NumberInput
              value={item.bar}
              onChange={onBar}
              channel="bar"
              ariaLabel={`${item.label} — Bar`}
              size="sm"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        className="row__remove"
        aria-label={`${item.label} löschen`}
        onClick={onRemove}
      >
        <IconTrash />
      </button>
    </div>
  )
}
