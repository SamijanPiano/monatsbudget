import type { OrderLedger, SaldoOrder } from '../../types/saldo'
import { useSaldoStore } from '../../store/saldoStore'
import { euroCents } from '../../lib/euro'
import { EuroInput } from './EuroInput'
import { IconCheckMark } from '../ui/icons'

interface PaymentRowProps {
  tripId: string
  personId: string
  order: SaldoOrder
  ledger: OrderLedger
}

function status(order: SaldoOrder, ledger: OrderLedger): { kind: string; text: string } {
  if (order.amountPaid != null) {
    if (ledger.diff > 0) return { kind: 'over', text: `${euroCents(ledger.diff)} zu viel` }
    if (ledger.diff < 0) return { kind: 'under', text: `${euroCents(-ledger.diff)} zu wenig` }
    return { kind: 'ok', text: 'Passt genau' }
  }
  if (order.paid) return { kind: 'ok', text: 'Erhalten' }
  return { kind: 'open', text: 'Offen' }
}

export function PaymentRow({ tripId, personId, order, ledger }: PaymentRowProps) {
  const setPayment = useSaldoStore((s) => s.setPayment)
  const settled = order.paid || order.amountPaid != null
  const st = status(order, ledger)

  return (
    <div className="sal-pay">
      {ledger.prevBalance !== 0 && (
        <p className="sal-pay__carry">
          {ledger.prevBalance > 0
            ? `${euroCents(ledger.prevBalance)} Guthaben verrechnet → `
            : `${euroCents(-ledger.prevBalance)} Altschuld → `}
          <strong>zu zahlen {euroCents(Math.max(ledger.expected, 0))}</strong>
        </p>
      )}
      <div className="sal-pay__controls">
        <EuroInput
          value={order.amountPaid}
          onCommit={(cents) =>
            setPayment(tripId, personId, {
              amountPaid: cents,
              paid: cents != null ? true : order.paid,
            })
          }
          ariaLabel="Erhaltener Betrag"
          placeholder={euroCents(Math.max(ledger.expected, 0)).replace(' €', '')}
          className="sal-pay__input"
        />
        <button
          type="button"
          className={`sal-paytoggle ${settled ? 'is-on' : ''}`}
          aria-pressed={settled}
          aria-label="Als bezahlt markieren"
          onClick={() =>
            settled
              ? setPayment(tripId, personId, { paid: false, amountPaid: null })
              : setPayment(tripId, personId, { paid: true })
          }
        >
          <IconCheckMark size={18} />
          {settled ? 'Erhalten' : 'Offen'}
        </button>
      </div>
      <div className={`sal-pay__status sal-status-${st.kind}`}>
        <span className="sal-status__dot" aria-hidden="true" />
        {st.text}
      </div>
    </div>
  )
}
