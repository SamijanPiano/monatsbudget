import { useState } from 'react'
import type { SaldoNav } from './navigation'
import { useSaldoState } from './useSaldoState'
import { useSaldoStore } from '../../store/saldoStore'
import { orderTotal, itemName } from '../../lib/saldo'
import { euroCents, todayIso, dateLabel } from '../../lib/euro'
import type { SaldoItem, SaldoState } from '../../types/saldo'
import { Avatar } from './Avatar'
import { IconPlus, IconUsers, IconList, IconReceipt, IconCalendar, IconWallet } from '../ui/icons'

function subline(state: SaldoState, personId: string): string {
  const rows: { date: string; items: SaldoItem[] }[] = []
  for (const trip of state.trips)
    for (const order of trip.orders)
      if (order.personId === personId) rows.push({ date: trip.date, items: order.items })
  if (rows.length === 0) return 'Noch keine Einträge'
  rows.sort((a, b) => b.date.localeCompare(a.date))
  const latest = rows.find((r) => r.items.length > 0) || rows[0]
  if (latest.items.length === 0) return dateLabel(latest.date)
  const names = latest.items.slice(0, 3).map((it) => {
    const n = itemName(state, it)
    return it.qty > 1 ? `${n} ×${it.qty}` : n
  })
  return names.join(', ') + (latest.items.length > 3 ? ' …' : '')
}

export function Overview({ nav }: { nav: SaldoNav }) {
  const { state, balances } = useSaldoState()
  const addTrip = useSaldoStore((s) => s.addTrip)
  const [tab, setTab] = useState<'people' | 'day'>('people')

  let owedToYou = 0
  let youOwe = 0
  for (const p of state.people) {
    const b = balances[p.id] ?? 0
    if (b < 0) owedToYou += -b
    else if (b > 0) youOwe += b
  }

  const activeIds = new Set<string>()
  state.trips.forEach((t) => t.orders.forEach((o) => activeIds.add(o.personId)))
  const people = state.people
    .filter((p) => (balances[p.id] ?? 0) !== 0 || activeIds.has(p.id))
    .sort(
      (a, b) =>
        (balances[a.id] ?? 0) - (balances[b.id] ?? 0) || a.name.localeCompare(b.name, 'de'),
    )

  return (
    <div className="sal-view">
      <div className="sal-ov-topbar">
        <button
          type="button"
          className="sal-iconbtn"
          aria-label="Produkte verwalten"
          title="Produkte"
          onClick={() => nav.go({ name: 'products' })}
        >
          <IconWallet size={20} />
        </button>
      </div>

      <div className="sal-summary">
        <p className="sal-summary__label">Dir wird geschuldet</p>
        <p className={`sal-summary__value ${owedToYou > 0 ? 'text-positive' : 'text-muted'}`}>
          {euroCents(owedToYou)}
        </p>
        {youOwe > 0 ? (
          <p className="sal-summary__sub text-negative">Du schuldest {euroCents(youOwe)}</p>
        ) : owedToYou === 0 ? (
          <p className="sal-summary__sub text-muted">Alles ausgeglichen.</p>
        ) : null}
      </div>

      <div className="sal-actions">
        <button className="sal-action sal-action--primary" onClick={() => nav.go({ name: 'entry' })}>
          <IconPlus size={20} />
          <span>Eintrag</span>
        </button>
        <button
          className="sal-action sal-action--secondary"
          onClick={() => nav.go({ name: 'trip', id: addTrip(todayIso()) })}
        >
          <IconUsers size={20} />
          <span>Mehrere</span>
        </button>
        <button
          className="sal-action sal-action--secondary"
          onClick={() => nav.go({ name: 'shopping' })}
        >
          <IconList size={20} />
          <span>Einkaufsliste</span>
        </button>
      </div>

      <div className="sal-segmented" role="group" aria-label="Ansicht wechseln">
        <button
          className={`sal-seg ${tab === 'people' ? 'is-on' : ''}`}
          aria-pressed={tab === 'people'}
          onClick={() => setTab('people')}
        >
          Personen
        </button>
        <button
          className={`sal-seg ${tab === 'day' ? 'is-on' : ''}`}
          aria-pressed={tab === 'day'}
          onClick={() => setTab('day')}
        >
          Heute
        </button>
      </div>

      {tab === 'people' ? (
        people.length === 0 ? (
          <EmptyState
            icon={<IconReceipt size={36} />}
            title="Noch nichts erfasst"
            text={'Tippe auf „Eintrag", sobald du das nächste Mal etwas für jemanden auslegst.'}
          />
        ) : (
          <ul className="sal-cardlist">
            {people.map((p) => {
              const b = balances[p.id] ?? 0
              const amount = b < 0 ? euroCents(-b) : b > 0 ? euroCents(b) : 'ausgeglichen'
              const kind = b < 0 ? 'text-positive' : b > 0 ? 'text-negative' : 'text-muted'
              const label = b < 0 ? 'schuldet dir' : b > 0 ? 'du schuldest' : null
              return (
                <li key={p.id}>
                  <button className="sal-balrow" onClick={() => nav.go({ name: 'person', id: p.id })}>
                    <Avatar name={p.name} />
                    <span className="sal-balrow__main">
                      <span className="sal-balrow__name">{p.name}</span>
                      <span className="sal-balrow__sub">{subline(state, p.id)}</span>
                    </span>
                    <span className="sal-balrow__amount">
                      <span className={`sal-balrow__value ${kind}`}>{amount}</span>
                      {label && <span className="sal-balrow__amount-sub">{label}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : (
        <DayView nav={nav} state={state} />
      )}
    </div>
  )
}

function DayView({ nav, state }: { nav: SaldoNav; state: SaldoState }) {
  const today = todayIso()
  const groups = new Map<string, { name: string; items: SaldoItem[]; total: number }>()
  for (const trip of state.trips) {
    if (trip.date !== today) continue
    for (const order of trip.orders) {
      if (order.items.length === 0) continue
      const person = state.people.find((p) => p.id === order.personId)
      if (!person) continue
      const g = groups.get(person.id) ?? { name: person.name, items: [], total: 0 }
      g.items.push(...order.items)
      g.total += orderTotal(order)
      groups.set(person.id, g)
    }
  }

  if (groups.size === 0) {
    return (
      <EmptyState
        icon={<IconCalendar size={36} />}
        title="Noch nichts für heute"
        text={'Tippe auf „Eintrag", um den ersten Kauf des Tages zu erfassen.'}
      />
    )
  }

  return (
    <>
      <h3 className="sal-section-title">{dateLabel(today)}</h3>
      <ul className="sal-cardlist">
        {[...groups.entries()].map(([id, g]) => (
          <li key={id}>
            <button className="sal-balrow" onClick={() => nav.go({ name: 'person', id })}>
              <Avatar name={g.name} />
              <span className="sal-balrow__main">
                <span className="sal-balrow__name">{g.name}</span>
                <span className="sal-balrow__sub">
                  {g.items
                    .slice(0, 3)
                    .map((it) => (it.qty > 1 ? `${itemName(state, it)} ×${it.qty}` : itemName(state, it)))
                    .join(', ')}
                  {g.items.length > 3 ? ' …' : ''}
                </span>
              </span>
              <span className="sal-balrow__amount">
                <span className="sal-balrow__value text-positive">{euroCents(g.total)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="sal-empty">
      <span className="sal-empty__icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}
