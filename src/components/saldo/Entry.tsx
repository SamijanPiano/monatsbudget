import { useEffect, useRef, useState } from 'react'
import type { SaldoNav } from './navigation'
import { useSaldoState } from './useSaldoState'
import { useSaldoStore } from '../../store/saldoStore'
import { orderLedger, suggestProducts, itemName } from '../../lib/saldo'
import { euroCents, parseEuroCents, todayIso } from '../../lib/euro'
import { SubHeader } from './SubHeader'
import { Avatar } from './Avatar'
import { Autocomplete } from './Autocomplete'
import { ItemRow } from './ItemRow'
import { PaymentRow } from './PaymentRow'
import { IconPlus, IconCheckMark, IconCalendar, IconUser } from '../ui/icons'

interface EntryPtr {
  tripId: string
  personId: string
}

/** Entfernt eine leere (abgebrochene) Bestellung/Fahrt. Modul-Funktion → stabil. */
function cleanupIfEmpty(p: EntryPtr | null) {
  if (!p) return
  const s = useSaldoStore.getState()
  const trip = s.trips.find((t) => t.id === p.tripId)
  if (!trip) return
  const order = trip.orders.find((o) => o.personId === p.personId)
  if (!order || order.items.length === 0) {
    if (trip.orders.length <= 1) s.removeTrip(trip.id)
    else s.removeOrder(trip.id, p.personId)
  }
}

export function Entry({ nav }: { nav: SaldoNav }) {
  const { state } = useSaldoState()
  const [ptr, setPtr] = useState<EntryPtr | null>(null)
  const [mode, setMode] = useState<'item' | 'amount'>('item')
  const [resuming, setResuming] = useState(false)

  // Verwaiste Zeiger (z. B. extern gelöschte Fahrt) fängt der Render-Guard
  // weiter unten ab — dann erscheint wieder die Personen-Auswahl.
  const trip = ptr ? state.trips.find((t) => t.id === ptr.tripId) : undefined
  const person = ptr ? state.people.find((p) => p.id === ptr.personId) : undefined

  // Beim Verlassen (Tab-Wechsel/Unmount) leere Fahrt aufräumen.
  const ptrRef = useRef(ptr)
  useEffect(() => {
    ptrRef.current = ptr
  })
  useEffect(() => () => cleanupIfEmpty(ptrRef.current), [])

  const leave = () => {
    cleanupIfEmpty(ptr)
    nav.home()
  }

  const pickPerson = (name: string, id: string | null, isNew: boolean) => {
    const s = useSaldoStore.getState()
    const pid = isNew || !id ? s.addPerson(name) : id
    const today = todayIso()

    if (!isNew && id) {
      const fresh = useSaldoStore.getState()
      for (let i = fresh.trips.length - 1; i >= 0; i--) {
        const t = fresh.trips[i]
        if (t.date !== today) continue
        const ord = t.orders.find((o) => o.personId === pid && !o.paid && o.amountPaid == null)
        if (ord) {
          setResuming(true)
          setMode('item')
          setPtr({ tripId: t.id, personId: pid })
          return
        }
      }
    }

    setResuming(false)
    setMode('item')
    const store = useSaldoStore.getState()
    const tid = store.addTrip(today)
    store.addPersonToTrip(tid, pid)
    setPtr({ tripId: tid, personId: pid })
  }

  // Schritt 1: Person wählen
  if (!ptr || !trip || !person) {
    const people = [...state.people].sort((a, b) => a.name.localeCompare(b.name, 'de'))
    return (
      <div className="sal-view">
        <SubHeader title="Neuer Eintrag" onBack={leave} />
        <p className="sal-pick-label">Für wen hast du etwas gekauft?</p>
        <div className="sal-addperson">
          <span className="sal-addperson__icon">
            <IconUser size={20} />
          </span>
          <Autocomplete
            placeholder="Für wen? Name eingeben …"
            ariaLabel="Person wählen"
            listLabel="Personen"
            autoFocus
            getSuggestions={(q) =>
              people
                .filter((p) => q === '' || p.name.toLowerCase().includes(q.toLowerCase()))
                .map((p) => ({ id: p.id, name: p.name }))
            }
            createLabel={(q) => `„${q}" neu anlegen`}
            onPick={({ name, id, isNew }) => pickPerson(name, id, isNew)}
          />
        </div>
      </div>
    )
  }

  // Schritt 2: Eintrag erfassen
  const order = trip.orders.find((o) => o.personId === person.id)!
  const ledger = orderLedger(state, trip.id, person.id)

  return (
    <div className="sal-view">
      <SubHeader title={resuming ? 'Bestellung bearbeiten' : 'Neuer Eintrag'} onBack={leave} />

      <div className="sal-card sal-entry-head">
        <button className="sal-person-id" onClick={() => nav.go({ name: 'person', id: person.id })}>
          <Avatar name={person.name} />
          <span className="sal-person-name">{person.name}</span>
        </button>
        <label className="sal-date-field">
          <IconCalendar size={18} />
          <input
            type="date"
            className="sal-date-input"
            value={trip.date}
            max={todayIso()}
            aria-label="Datum des Eintrags"
            onChange={(e) =>
              e.target.value && useSaldoStore.getState().setTripDate(trip.id, e.target.value)
            }
          />
        </label>
      </div>

      <div className="sal-card sal-entry-items">
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

      <div className="sal-segmented" role="group" aria-label="Art des Eintrags">
        <button
          className={`sal-seg ${mode === 'item' ? 'is-on' : ''}`}
          aria-pressed={mode === 'item'}
          onClick={() => setMode('item')}
        >
          Artikel
        </button>
        <button
          className={`sal-seg ${mode === 'amount' ? 'is-on' : ''}`}
          aria-pressed={mode === 'amount'}
          onClick={() => setMode('amount')}
        >
          Betrag
        </button>
      </div>

      {mode === 'item' ? (
        <div className="sal-adder">
          <Autocomplete
            placeholder="Artikel hinzufügen …"
            ariaLabel={`Artikel für ${person.name}`}
            listLabel="Artikel-Vorschläge"
            getSuggestions={(q) =>
              suggestProducts(state, person.id, q).map((p) => ({
                id: p.id,
                name: p.name,
                hint: p.lastPrice != null ? euroCents(p.lastPrice) : undefined,
              }))
            }
            createLabel={(q) => `„${q}" hinzufügen`}
            onPick={({ name }) => useSaldoStore.getState().addItem(trip.id, person.id, name, null, 1)}
          />
        </div>
      ) : (
        <AmountAdder tripId={trip.id} personId={person.id} />
      )}

      <div className="sal-card sal-entry-pay">
        <PaymentRow tripId={trip.id} personId={person.id} order={order} ledger={ledger} />
      </div>

      <button className="sal-btn sal-btn--primary sal-entry-done" onClick={leave}>
        <IconCheckMark size={18} /> Fertig
      </button>
    </div>
  )
}

function AmountAdder({ tripId, personId }: { tripId: string; personId: string }) {
  const addFreeItem = useSaldoStore((s) => s.addFreeItem)
  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('')
  const labelRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const text = label.trim()
    if (!text) {
      labelRef.current?.focus()
      return
    }
    addFreeItem(tripId, personId, text, parseEuroCents(price))
    setLabel('')
    setPrice('')
    labelRef.current?.focus()
  }

  return (
    <div className="sal-adder sal-amount-adder">
      <input
        ref={labelRef}
        className="sal-amount-label"
        type="text"
        placeholder="Wofür? z. B. Konzertticket"
        aria-label="Bezeichnung der Auslage"
        autoCapitalize="sentences"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            priceRef.current?.focus()
          }
        }}
      />
      <label className="sal-amount-field">
        <span className="sal-amount-cur">€</span>
        <input
          ref={priceRef}
          className="sal-amount-price"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          aria-label="Betrag in Euro"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
      </label>
      <button className="sal-btn sal-btn--secondary" onClick={submit}>
        <IconPlus size={18} /> Hinzufügen
      </button>
    </div>
  )
}
