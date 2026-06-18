import type { SaldoItem } from '../../types/saldo'
import { useSaldoStore } from '../../store/saldoStore'
import { euroCents } from '../../lib/euro'
import { EuroInput } from './EuroInput'
import { IconMinus, IconPlus, IconTrash } from '../ui/icons'

interface ItemRowProps {
  tripId: string
  personId: string
  item: SaldoItem
  name: string
}

export function ItemRow({ tripId, personId, item, name }: ItemRowProps) {
  const changeItemQty = useSaldoStore((s) => s.changeItemQty)
  const setItemPrice = useSaldoStore((s) => s.setItemPrice)

  const priceKnown = item.price != null
  const lineTotal = (item.price ?? 0) * item.qty

  return (
    <div className="sal-itemrow">
      <div className="sal-itemrow__top">
        <span className="sal-itemrow__name">{name}</span>
        {priceKnown ? (
          <span className="sal-itemrow__line">{euroCents(lineTotal)}</span>
        ) : (
          <span className="sal-itemrow__line sal-itemrow__missing">Preis fehlt</span>
        )}
      </div>
      <div className="sal-itemrow__bottom">
        <EuroInput
          value={item.price}
          onCommit={(cents) => setItemPrice(tripId, personId, item.id, cents)}
          ariaLabel={`Preis für ${name}`}
          placeholder="Preis"
          className="sal-itemrow__price"
        />
        <div className="sal-stepper" role="group" aria-label={`Menge für ${name}`}>
          <button
            type="button"
            className="sal-stepper__btn"
            aria-label={item.qty <= 1 ? 'Artikel entfernen' : 'Menge verringern'}
            onClick={() => changeItemQty(tripId, personId, item.id, -1)}
          >
            {item.qty <= 1 ? <IconTrash size={18} /> : <IconMinus size={18} />}
          </button>
          <span className="sal-stepper__qty" aria-live="polite" aria-label={`Menge: ${item.qty}`}>
            {item.qty}
          </span>
          <button
            type="button"
            className="sal-stepper__btn"
            aria-label="Menge erhöhen"
            onClick={() => changeItemQty(tripId, personId, item.id, 1)}
          >
            <IconPlus size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
