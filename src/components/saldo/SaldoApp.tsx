import { useMemo, useState } from 'react'
import type { SaldoNav, SaldoScreen } from './navigation'
import { Overview } from './Overview'
import { Entry } from './Entry'
import { Trip } from './Trip'
import { PersonDetail } from './PersonDetail'
import { Shopping } from './Shopping'

/**
 * Eigenständige „Sub-App" für Schulden/Auslagen mit interner Navigation
 * (Stack). Beim Verlassen des Tabs wird der Stack zurückgesetzt.
 */
export function SaldoApp() {
  const [stack, setStack] = useState<SaldoScreen[]>([{ name: 'overview' }])
  const current = stack[stack.length - 1]

  const nav: SaldoNav = useMemo(
    () => ({
      go: (screen) => setStack((s) => [...s, screen]),
      back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
      home: () => setStack([{ name: 'overview' }]),
    }),
    [],
  )

  switch (current.name) {
    case 'entry':
      return <Entry key="entry" nav={nav} />
    case 'trip':
      return <Trip key={current.id} id={current.id} nav={nav} />
    case 'person':
      return <PersonDetail key={current.id} id={current.id} nav={nav} />
    case 'shopping':
      return <Shopping key="shopping" nav={nav} />
    default:
      return <Overview key="overview" nav={nav} />
  }
}
