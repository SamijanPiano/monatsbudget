// Deutsches Starter-Set an Kategorien mit Seed-Regeln für gängige Händler.
// Reine Factory ohne Seiteneffekte. Matching ist case-insensitive, daher sind
// lowercase contains-Werte ausreichend. budget bleibt überall null (Nutzer
// setzt es später selbst).
import type { Category, CategoryKind, CategoryRule } from '../types/budget'
import { createId } from './id'

/** Baut eine contains-Regel auf den counterparty. */
function cp(value: string): CategoryRule {
  return { field: 'counterparty', match: 'contains', value }
}

/** Baut eine contains-Regel auf den Verwendungszweck. */
function pp(value: string): CategoryRule {
  return { field: 'purpose', match: 'contains', value }
}

interface SeedSpec {
  label: string
  kind: CategoryKind
  icon?: string
  rules: CategoryRule[]
}

// Reihenfolge ist bewusst gewählt: spezifische Kategorien zuerst, der
// regellose Fallback „Sonstiges" zuletzt (greift nie automatisch).
const SEEDS: SeedSpec[] = [
  {
    label: 'Einkommen',
    kind: 'income',
    icon: '💰',
    rules: [cp('gehalt'), cp('lohn'), pp('gehalt'), pp('lohn'), pp('gutschrift')],
  },
  {
    label: 'Miete',
    kind: 'fixed',
    icon: '🏠',
    rules: [cp('vermiet'), pp('miete'), pp('kaltmiete'), pp('warmmiete')],
  },
  {
    label: 'Lebensmittel',
    kind: 'variable',
    icon: '🛒',
    rules: [
      cp('rewe'),
      cp('edeka'),
      cp('aldi'),
      cp('lidl'),
      cp('kaufland'),
      cp('penny'),
      cp('netto'),
    ],
  },
  {
    label: 'Mobilität',
    kind: 'variable',
    icon: '🚗',
    rules: [cp('db vertrieb'), cp('deutsche bahn'), cp('tankstelle'), cp('aral'), cp('shell')],
  },
  {
    label: 'Telekommunikation',
    kind: 'fixed',
    icon: '📱',
    rules: [cp('telekom'), cp('vodafone'), cp('o2'), cp('telefónica')],
  },
  {
    label: 'Abos & Streaming',
    kind: 'fixed',
    icon: '🎬',
    rules: [cp('netflix'), cp('spotify'), cp('disney'), cp('amazon prime'), cp('prime video')],
  },
  {
    label: 'Versicherung',
    kind: 'fixed',
    icon: '🛡️',
    rules: [cp('versicherung'), pp('versicherung'), pp('beitrag')],
  },
  {
    label: 'Sparen',
    kind: 'savings',
    icon: '🐖',
    rules: [pp('sparplan'), pp('sparen'), pp('rücklage')],
  },
  {
    // Fallback-Topf ohne Regeln — wird nie automatisch zugeordnet.
    label: 'Sonstiges',
    kind: 'variable',
    icon: '📦',
    rules: [],
  },
]

/** Liefert ein frisches deutsches Starter-Set mit stabilen, eindeutigen ids. */
export function defaultCategories(): Category[] {
  return SEEDS.map((seed) => ({
    id: createId(),
    label: seed.label,
    kind: seed.kind,
    budget: null,
    rules: seed.rules,
    icon: seed.icon,
  }))
}
