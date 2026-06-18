export type SaldoScreen =
  | { name: 'overview' }
  | { name: 'entry' }
  | { name: 'trip'; id: string }
  | { name: 'person'; id: string }
  | { name: 'shopping' }

export interface SaldoNav {
  go: (screen: SaldoScreen) => void
  back: () => void
  home: () => void
}
