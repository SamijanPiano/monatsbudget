import { useMemo } from 'react'
import { useSaldoStore } from '../../store/saldoStore'
import { computeBalances } from '../../lib/saldo'
import type { SaldoState } from '../../types/saldo'

/** Liefert den Saldo-State plus berechnete Salden pro Person. */
export function useSaldoState(): { state: SaldoState; balances: Record<string, number> } {
  const people = useSaldoStore((s) => s.people)
  const products = useSaldoStore((s) => s.products)
  const trips = useSaldoStore((s) => s.trips)

  return useMemo(() => {
    const state: SaldoState = { people, products, trips }
    return { state, balances: computeBalances(state) }
  }, [people, products, trips])
}
