import { useState } from 'react'
import type { SaldoNav } from './navigation'
import { useSaldoState } from './useSaldoState'
import { itemName } from '../../lib/saldo'
import type { SaldoItem } from '../../types/saldo'
import { SubHeader } from './SubHeader'
import { Avatar } from './Avatar'
import { IconList, IconRefresh, IconCheckMark } from '../ui/icons'

const BAKERY = [
  'brötchen', 'croissant', 'baguette', 'brezel', 'laugen', 'hörnchen', 'donut',
  'berliner', 'krapfen', 'waffel', 'kuchen', 'torte', 'stollen', 'hefezopf',
  'zimtschnecke', 'plunder', 'teilchen', 'striezel', 'aufback', 'ciabatta',
  'focaccia', 'muffin', 'brot', 'toast',
]
const isBakery = (name: string) => {
  const l = name.toLowerCase()
  return BAKERY.some((k) => l.includes(k))
}

export function Shopping({ nav }: { nav: SaldoNav }) {
  const { state } = useSaldoState()
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const toggle = (itemId: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })

  const openOrders: { tripId: string; personId: string; name: string; items: SaldoItem[] }[] = []
  for (const trip of state.trips) {
    for (const order of trip.orders) {
      if (order.items.length === 0) continue
      if (order.paid || order.amountPaid != null) continue
      const person = state.people.find((p) => p.id === order.personId)
      if (!person) continue
      openOrders.push({ tripId: trip.id, personId: person.id, name: person.name, items: order.items })
    }
  }

  return (
    <div className="sal-view">
      <SubHeader eyebrow="Für heute" title="Einkaufsliste" onBack={() => nav.home()} />

      {openOrders.length === 0 ? (
        <div className="sal-empty">
          <span className="sal-empty__icon">
            <IconList size={36} />
          </span>
          <h3>Keine offenen Bestellungen</h3>
          <p>Tippe auf „Eintrag", um Bestellungen zu erfassen.</p>
        </div>
      ) : (
        <>
          {openOrders.map((g) => {
            const bakery = g.items.filter((it) => isBakery(itemName(state, it)))
            const rest = g.items.filter((it) => !isBakery(itemName(state, it)))
            return (
              <div className="sal-card sal-shopping-person" key={`${g.tripId}-${g.personId}`}>
                <div className="sal-shopping-head">
                  <Avatar name={g.name} />
                  <span className="sal-shopping-name">{g.name}</span>
                </div>
                <div className="sal-shopping-items">
                  {[...bakery, ...rest].map((item) => {
                    const on = checked.has(item.id)
                    const name = itemName(state, item)
                    return (
                      <button
                        key={item.id}
                        className={`sal-shopping-item ${on ? 'is-done' : ''}`}
                        aria-pressed={on}
                        onClick={() => toggle(item.id)}
                      >
                        <span className="sal-shopping-check" aria-hidden="true">
                          {on && <IconCheckMark size={14} />}
                        </span>
                        <span className="sal-shopping-item-name">{name}</span>
                        {item.qty > 1 && <span className="sal-shopping-item-qty">×{item.qty}</span>}
                        {bakery.includes(item) && <span className="sal-shopping-item-tag">Back</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <button className="sal-shopping-reset" onClick={() => setChecked(new Set())}>
            <IconRefresh size={16} /> Alle Häkchen zurücksetzen
          </button>
        </>
      )}
    </div>
  )
}
