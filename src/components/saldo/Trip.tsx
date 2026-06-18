import { useEffect } from 'react'
import type { SaldoNav } from './navigation'
import { useSaldoState } from './useSaldoState'
import { useSaldoStore } from '../../store/saldoStore'
import { orderTotal, orderLedger, suggestProducts, itemName } from '../../lib/saldo'
import { euroCents, dateLabel } from '../../lib/euro'
import { SubHeader } from './SubHeader'
import { Avatar } from './Avatar'
import { Autocomplete } from './Autocomplete'
import { ItemRow } from './ItemRow'
import { PaymentRow } from './PaymentRow'
import { BalanceBadge } from './BalanceBadge'
import { IconTrash, IconUser } from '../ui/icons'

export function Trip({ id, nav }: { id: string; nav: SaldoNav }) {
  const { state, balances } = useSaldoState()
  const store = useSaldoStore

  const trip = state.trips.find((t) => t.id === id)

  useEffect(() => {
    if (!trip) nav.home()
  }, [trip, nav])
  if (!trip) return null

  const total = trip.orders.reduce((sum, o) => sum + orderTotal(o), 0)
  const inTrip = new Set(trip.orders.map((o) => o.personId))
  const available = state.people.filter((p) => !inTrip.has(p.id))

  return (
    <div className="sal-view">
      <SubHeader
        eyebrow="Sammeleinkauf"
        title={dateLabel(trip.date)}
        onBack={() => nav.home()}
        action={
          <button
            type="button"
            className="sal-iconbtn sal-iconbtn--danger"
            aria-label="Einkauf löschen"
            onClick={() => {
              if (confirm('Diesen Einkauf wirklich löschen?')) {
                store.getState().removeTrip(trip.id)
                nav.home()
              }
            }}
          >
            <IconTrash size={20} />
          </button>
        }
      />

      {trip.orders.length > 0 && (
        <div className="sal-trip-summary">
          <span className="sal-trip-summary__label">Summe</span>
          <span className="sal-trip-summary__value">{euroCents(total)}</span>
        </div>
      )}

      {trip.orders.map((order) => {
        const person = state.people.find((p) => p.id === order.personId)
        if (!person) return null
        const ledger = orderLedger(state, trip.id, person.id)
        return (
          <div className="sal-card sal-person-card" key={person.id}>
            <div className="sal-person-head">
              <button
                className="sal-person-id"
                onClick={() => nav.go({ name: 'person', id: person.id })}
              >
                <Avatar name={person.name} />
                <span className="sal-person-name">{person.name}</span>
              </button>
              <BalanceBadge balance={balances[person.id] ?? 0} />
              <button
                type="button"
                className="sal-iconbtn sal-iconbtn--danger sal-iconbtn--tiny"
                aria-label="Person aus Einkauf entfernen"
                onClick={() => {
                  if (confirm(`${person.name} aus diesem Einkauf entfernen?`))
                    store.getState().removeOrder(trip.id, person.id)
                }}
              >
                <IconTrash size={18} />
              </button>
            </div>

            <div className="sal-items">
              {order.items.length === 0 ? (
                <p className="sal-items-empty">Noch nichts erfasst.</p>
              ) : (
                order.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    tripId={trip.id}
                    personId={person.id}
                    item={item}
                    name={itemName(state, item)}
                  />
                ))
              )}
            </div>

            <div className="sal-adder">
              <Autocomplete
                placeholder="Artikel hinzufügen …"
                ariaLabel={`Artikel für ${person.name} hinzufügen`}
                listLabel="Artikel-Vorschläge"
                getSuggestions={(q) =>
                  suggestProducts(state, person.id, q).map((p) => ({
                    id: p.id,
                    name: p.name,
                    hint: p.lastPrice != null ? euroCents(p.lastPrice) : undefined,
                  }))
                }
                createLabel={(q) => `„${q}" hinzufügen`}
                onPick={({ name }) => store.getState().addItem(trip.id, person.id, name, null, 1)}
              />
            </div>

            <PaymentRow tripId={trip.id} personId={person.id} order={order} ledger={ledger} />
          </div>
        )
      })}

      <div className="sal-addperson">
        <span className="sal-addperson__icon">
          <IconUser size={20} />
        </span>
        <Autocomplete
          placeholder="Person hinzufügen …"
          ariaLabel="Person zum Einkauf hinzufügen"
          listLabel="Personen-Vorschläge"
          getSuggestions={(q) =>
            available
              .filter((p) => q === '' || p.name.toLowerCase().includes(q.toLowerCase()))
              .map((p) => {
                const b = balances[p.id] ?? 0
                return {
                  id: p.id,
                  name: p.name,
                  hint: b < 0 ? `schuldet ${euroCents(-b)}` : b > 0 ? `${euroCents(b)} gut` : undefined,
                }
              })
          }
          createLabel={(q) => `„${q}" neu anlegen`}
          onPick={({ name, id, isNew }) => {
            const pid = isNew || !id ? store.getState().addPerson(name) : id
            store.getState().addPersonToTrip(trip.id, pid)
          }}
        />
      </div>
    </div>
  )
}
