import { euroCents } from '../../lib/euro'

export function BalanceBadge({ balance }: { balance: number }) {
  if (balance < 0)
    return <span className="sal-badge sal-badge--debt">schuldet {euroCents(-balance)}</span>
  if (balance > 0)
    return <span className="sal-badge sal-badge--credit">{euroCents(balance)} gut</span>
  return <span className="sal-badge sal-badge--muted">ausgeglichen</span>
}
