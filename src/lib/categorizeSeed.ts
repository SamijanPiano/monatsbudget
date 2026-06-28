// Deutsches Starter-Set an Ausgaben-Kategorien mit Seed-Regeln für gängige
// Händler. Reine Factory ohne Seiteneffekte. Matching ist case-insensitive,
// daher reichen lowercase contains-Werte. budget bleibt überall null (Nutzer
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

// Reihenfolge ist bewusst gewählt: spezifische Kategorien zuerst, der regellose
// Fallback „Sonstiges" zuletzt (greift nie automatisch). categorize() nimmt den
// ERSTEN Treffer, daher stehen eindeutige Abos vor breiten Einkaufs-Regeln.
const SEEDS: SeedSpec[] = [
  {
    label: 'Einkommen',
    kind: 'income',
    icon: '💰',
    rules: [cp('gehalt'), cp('lohn'), cp('arbeitgeber'), pp('gehalt'), pp('lohn'), pp('gutschrift')],
  },
  {
    label: 'Wohnen & Nebenkosten',
    kind: 'fixed',
    icon: '🏠',
    rules: [
      cp('vermiet'),
      cp('stadtwerke'),
      cp('vattenfall'),
      cp('e.on'),
      cp('eon energie'),
      pp('miete'),
      pp('kaltmiete'),
      pp('warmmiete'),
      pp('nebenkosten'),
      pp('strom'),
    ],
  },
  {
    label: 'Handy & Internet',
    kind: 'fixed',
    icon: '📱',
    rules: [
      cp('telekom'),
      cp('vodafone'),
      cp('o2'),
      cp('telefónica'),
      cp('aldi talk'),
      cp('congstar'),
      cp('1&1'),
      cp('mobilcom'),
      cp('drillisch'),
    ],
  },
  {
    label: 'Abos & Streaming',
    kind: 'fixed',
    icon: '🎬',
    rules: [
      cp('netflix'),
      cp('spotify'),
      cp('disney'),
      cp('amazon prime'),
      cp('prime video'),
      cp('youtube premium'),
      cp('dazn'),
      cp('sky '),
      cp('apple.com/bill'),
      cp('icloud'),
    ],
  },
  {
    label: 'Versicherung',
    kind: 'fixed',
    icon: '🛡️',
    rules: [cp('versicherung'), cp('allianz'), cp('huk'), cp('axa'), cp('ergo'), pp('versicherung'), pp('beitrag')],
  },
  {
    label: 'Einkauf',
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
      cp('real'),
      cp('norma'),
      cp('dm '),
      cp('dm-drogerie'),
      cp('rossmann'),
      cp('müller'),
    ],
  },
  {
    label: 'Tanken & Mobilität',
    kind: 'variable',
    icon: '⛽',
    rules: [
      cp('tankstelle'),
      cp('aral'),
      cp('shell'),
      cp('esso'),
      cp('jet '),
      cp('total'),
      cp('db vertrieb'),
      cp('deutsche bahn'),
      cp('flixbus'),
      cp('bvg'),
      cp('mvg'),
      cp('hvv'),
      cp('uber'),
    ],
  },
  {
    label: 'Freizeit',
    kind: 'variable',
    icon: '🎉',
    rules: [
      cp('restaurant'),
      cp('mcdonald'),
      cp('burger king'),
      cp('kfc'),
      cp('subway'),
      cp('kino'),
      cp('cinemaxx'),
      cp('cineplex'),
      cp('steam'),
      cp('playstation'),
      cp('nintendo'),
      cp('fitness'),
      cp('mcfit'),
      pp('freizeit'),
    ],
  },
  {
    label: 'Sparen',
    kind: 'savings',
    icon: '🐖',
    rules: [cp('trade republic'), cp('scalable'), pp('sparplan'), pp('sparen'), pp('rücklage'), pp('etf')],
  },
  {
    // Fallback-Topf ohne Regeln — wird nie automatisch zugeordnet, dient aber
    // als Auffang für sonst unzuordenbare Buchungen (fallbackCategoryId).
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
