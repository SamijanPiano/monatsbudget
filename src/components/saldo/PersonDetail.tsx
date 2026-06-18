import { useEffect } from 'react'
import type { SaldoNav } from './navigation'
import { useSaldoState } from './useSaldoState'
import { useSaldoStore } from '../../store/saldoStore'
import { orderTotal, orderLedger } from '../../lib/saldo'
import { euroCents, dateLabel } from '../../lib/euro'
import { SubHeader } from './SubHeader'
import { PaymentRow } from './PaymentRow'
import { IconUser, IconTrash, IconReceipt, IconCheckMark } from '../ui/icons'

export function PersonDetail({ id, nav }: { id: string; nav: SaldoNav }) {
  const { state, balances } = useSaldoState()
  const store = useSaldoStore
  const person = state.people.find((p) => p.id === id)

  useEffect(() => {
    if (!person) nav.home()
  }, [person, nav])
  if (!person) return null

  const balance = balances[person.id] ?? 0

  const openOrders: { tripId: string; date: string; n: number; total: number }[] = []
  const history: { tripId: string; date: string; total: number; settled: boolean; n: number }[] = []
  for (const trip of state.trips) {
    for (const order of trip.orders) {
      if (order.personId !== person.id) continue
      const total = orderTotal(order)
      const settled = order.paid || order.amountPaid != null
      history.push({ tripId: trip.id, date: trip.date, total, settled, n: order.items.length })
      if (!settled && order.items.length > 0)
        openOrders.push({ tripId: trip.id, date: trip.date, n: order.items.length, total })
    }
  }
  openOrders.sort((a, b) => b.date.localeCompare(a.date))
  history.sort((a, b) => b.date.localeCompare(a.date))

  const rename = () => {
    const name = prompt('Name ändern:', person.name)
    if (name && name.trim()) store.getState().renamePerson(person.id, name.trim())
  }

  const bp = balance < 0 ? 'debt' : balance > 0 ? 'credit' : 'even'
  const bpLabel =
    balance < 0 ? 'schuldet dir noch' : balance > 0 ? 'hat Guthaben' : 'ausgeglichen'
  const bpValue = euroCents(Math.abs(balance))

  return (
    <div className="sal-view">
      <SubHeader
        eyebrow="Person"
        title={person.name}
        onBack={() => nav.back()}
        action={
          <button type="button" className="sal-iconbtn" aria-label="Umbenennen" onClick={rename}>
            <IconUser size={20} />
          </button>
        }
      />

      <div className={`sal-balance-panel sal-bp-${bp}`}>
        <span className="sal-balance-panel__label">{bpLabel}</span>
        <span className="sal-balance-panel__value">{bpValue}</span>
      </div>

      {openOrders.length > 0 && (
        <section className="sal-section">
          <h3 className="sal-section-title">Zahlung</h3>
          {openOrders.map((o) => {
            const trip = state.trips.find((t) => t.id === o.tripId)!
            const order = trip.orders.find((or) => or.personId === person.id)!
            const ledger = orderLedger(state, trip.id, person.id)
            return (
              <div className="sal-card sal-open-order" key={o.tripId}>
                <div className="sal-open-order__head">
                  <strong>{dateLabel(o.date)}</strong>
                  <span className="text-muted">
                    {o.n} Posten · {euroCents(o.total)}
                  </span>
                </div>
                <PaymentRow tripId={trip.id} personId={person.id} order={order} ledger={ledger} />
              </div>
            )
          })}
        </section>
      )}

      <section className="sal-section">
        <h3 className="sal-section-title">Verlauf</h3>
        {history.length === 0 ? (
          <p className="text-muted">Noch keine Einträge.</p>
        ) : (
          <ul className="sal-cardlist">
            {history.map((row) => (
              <li key={row.tripId}>
                <button className="sal-histrow" onClick={() => nav.go({ name: 'trip', id: row.tripId })}>
                  <span className="sal-histrow__cal">
                    <IconReceipt size={20} />
                  </span>
                  <span className="sal-histrow__main">
                    <strong>{dateLabel(row.date)}</strong>
                    <span className="text-muted">
                      {row.n === 0 ? euroCents(row.total) : `${row.n} Posten · ${euroCents(row.total)}`}
                    </span>
                  </span>
                  {row.settled ? (
                    <span className="sal-badge sal-badge--done">
                      <IconCheckMark size={14} /> erhalten
                    </span>
                  ) : (
                    <span className="sal-badge sal-badge--open">offen</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        className="sal-text-danger"
        onClick={() => {
          if (confirm(`${person.name} und alle Bestellungen löschen?`)) {
            store.getState().removePerson(person.id)
            nav.home()
          }
        }}
      >
        <IconTrash size={16} /> Person löschen
      </button>
    </div>
  )
}
