import { useBudgetStore } from '../../store/budgetStore'
import { usePlanStore } from '../../store/planStore'
import { useDuplicatePairs } from '../../hooks/useDuplicatePairs'
import { formatCents } from '../../lib/format'
import { dateShort } from '../../lib/euro'
import { Card, SectionTitle } from '../ui/Card'
import { Button } from '../ui/Button'

/**
 * Prüfliste möglicher Doppelbuchungen. Erscheint nur, wenn es Vorschläge gibt.
 * Gelöscht wird immer die zuerst importierte Fassung, bewusst nur Paar für
 * Paar (zwei echte gleiche Einkäufe sehen genauso aus). „Kein Duplikat"
 * blendet ein Paar dauerhaft aus.
 */
export function DuplicatesSection() {
  const pairs = useDuplicatePairs()
  const removeTransactions = useBudgetStore((s) => s.removeTransactions)
  const dismissDuplicate = useBudgetStore((s) => s.dismissDuplicate)
  const forgetTransaction = usePlanStore((s) => s.forgetTransaction)

  if (pairs.length === 0) return null

  return (
    <Card>
      <SectionTitle
        title="Doppelte Buchungen prüfen"
        hint={`${pairs.length} ${pairs.length === 1 ? 'Paar sieht' : 'Paare sehen'} doppelt aus`}
      />
      <ul className="dup-list">
        {pairs.map((pair) => (
          <li key={pair.key} className="dup-pair">
            <div className="dup-pair__head">
              <span className="dup-pair__name">{pair.keep.counterparty || 'Ohne Empfänger'}</span>
              <span className="dup-pair__amount tnum">{formatCents(pair.keep.amount)}</span>
            </div>
            <p className="dup-pair__dates tnum">
              {dateShort(pair.remove.date)} (älter, wird gelöscht) · {dateShort(pair.keep.date)} (bleibt)
            </p>
            <div className="dup-pair__actions">
              <Button size="sm" variant="danger" onClick={() => {
                  // Eine manuelle Verschiebung der gelöschten Fassung geht auf die verbleibende über.
                  forgetTransaction(pair.remove.id, pair.keep.id)
                  removeTransactions([pair.remove.id])
                }}>
                Doppelte löschen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dismissDuplicate(pair.key)}>
                Kein Duplikat
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
