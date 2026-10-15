import { useEffect } from 'react'
import { useBudgetStore } from '../store/budgetStore'
import { usePlanStore } from '../store/planStore'
import { useSaldoStore } from '../store/saldoStore'
import { markLocalChange, reconcile, startEngineClock, useCloudMeta, withRemoteAsync } from '../lib/cloudSync/engine'
import { isBlankMonth, type Section } from '../lib/cloudSync/doc'
import type { BudgetState } from '../types/budget'

/** Nach einer Änderung kurz warten, damit Tippen nicht jeden Buchstaben hochlädt. */
const PUSH_DEBOUNCE_MS = 2_000
/** So oft holt ein offenes Gerät den neuesten Stand. */
const PULL_INTERVAL_MS = 30_000

/** Welches Feld des Budget-Stores zu welchem Abgleich-Bereich gehört (angezeigter Monat: keinem). */
const BUDGET_SECTIONS: [keyof BudgetState, Section][] = [
  ['settings', 'settings'],
  ['transactions', 'transactions'],
  ['categories', 'categories'],
  ['accounts', 'accounts'],
  ['contracts', 'contracts'],
  ['bankPending', 'misc'],
  ['dismissedDuplicates', 'misc'],
  ['deletedTransactionIds', 'transactions'],
  ['profile', 'profile'],
]

/** Nur echte Monatsänderungen zählen; ein durch Blättern angelegter leerer Monat nicht. */
function monthsChanged(next: BudgetState['months'], prev: BudgetState['months']): boolean {
  if (next === prev) return false
  const ids = new Set([...Object.keys(next), ...Object.keys(prev)])
  for (const id of ids) {
    if (next[id] === prev[id]) continue
    if (!prev[id] && next[id] && isBlankMonth(next[id])) continue
    return true
  }
  return false
}

function budgetSections(s: BudgetState, p: BudgetState): Section[] {
  const sections = BUDGET_SECTIONS.filter(([k]) => s[k] !== p[k]).map(([, sec]) => sec)
  if (monthsChanged(s.months, p.months)) sections.push('months')
  return [...new Set(sections)]
}

/** Stores, deren Speicher ein anderer Tab desselben Geräts geändert hat, neu laden. */
const STORAGE_KEYS: Record<string, () => Promise<void>> = {
  'monatsbudget-v1': () => Promise.resolve(useBudgetStore.persist.rehydrate()),
  'monatsbudget-plan-v1': () => Promise.resolve(usePlanStore.persist.rehydrate()),
  'saldo-v1': () => Promise.resolve(useSaldoStore.persist.rehydrate()),
  'monatsbudget-cloud-v2': () => Promise.resolve(useCloudMeta.persist.rehydrate()),
}

/**
 * Hält dieses Gerät mit allen anderen gleich: beim Start, alle 30 s, beim
 * Zurückkehren in die App, beim Verlassen und 2 s nach jeder eigenen Änderung.
 */
export function useCloudSync(): void {
  useEffect(() => {
    startEngineClock()
    let debounce: ReturnType<typeof setTimeout> | undefined
    const soon = () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => void reconcile(), PUSH_DEBOUNCE_MS)
    }
    const changed = (sections: Section[]) => {
      if (sections.length === 0) return
      markLocalChange(sections)
      soon()
    }

    const unsubscribe = [
      useBudgetStore.subscribe((s, p) => changed(budgetSections(s, p))),
      usePlanStore.subscribe((s, p) => changed(s.plan !== p.plan || s.overrides !== p.overrides ? ['plan'] : [])),
      useSaldoStore.subscribe((s, p) =>
        changed(s.people !== p.people || s.products !== p.products || s.trips !== p.trips ? ['saldo'] : []),
      ),
    ]

    const onVisibility = () => void reconcile()
    // Beim Wegwischen der App noch schnell hochladen.
    const onPageHide = () => {
      clearTimeout(debounce)
      void reconcile()
    }
    // Zweiter Tab derselben App: dessen Stand übernehmen statt ihn zu überschreiben.
    const onStorage = (e: StorageEvent) => {
      const reload = e.key ? STORAGE_KEYS[e.key] : undefined
      if (reload) void withRemoteAsync(reload)
    }
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void reconcile()
    }, PULL_INTERVAL_MS)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('storage', onStorage)
    void reconcile()

    return () => {
      clearTimeout(debounce)
      clearInterval(interval)
      unsubscribe.forEach((u) => u())
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
}
