// Baut aus fachlichen Objekten (Transaktion, Posten …) die Lernsignale, die der
// Store aufnimmt. Reine Mapping-Funktionen — die einzige Stelle, an der Domänen-
// daten in Signale übersetzt werden. So bleibt die Verdrahtung in der UI dünn.

import type { LineItem, Transaction } from '../../types/budget'
import type {
  BudgetSetSignal,
  CategoryAssignedSignal,
  ItemCreatedSignal,
  RecurringConfirmedSignal,
  SignalSource,
} from './signals'
import { normalizeKey, tokenize } from './signals'

type CategoryAssignedInput = Omit<CategoryAssignedSignal, 'id' | 'ts'>
type ItemCreatedInput = Omit<ItemCreatedSignal, 'id' | 'ts'>
type BudgetSetInput = Omit<BudgetSetSignal, 'id' | 'ts'>
type RecurringConfirmedInput = Omit<RecurringConfirmedSignal, 'id' | 'ts'>

/** Signal aus einer manuellen/vorgeschlagenen Kategoriezuordnung. */
export function categoryAssignedEvent(
  tx: Pick<Transaction, 'counterparty' | 'purpose'>,
  categoryId: string,
  source: SignalSource = 'manual',
): CategoryAssignedInput {
  return {
    type: 'category-assigned',
    counterpartyKey: normalizeKey(tx.counterparty),
    purposeTokens: tokenize(tx.purpose),
    categoryId,
    source,
  }
}

/** Signal aus dem Anlegen eines Budget-Postens (Einnahme/Abo/Ausgabe). */
export function itemCreatedEvent(
  item: Pick<LineItem, 'label'>,
  section: ItemCreatedSignal['section'],
  amountCent: number,
  categoryId: string | null = null,
  recurring = false,
): ItemCreatedInput {
  return {
    type: 'item-created',
    section,
    labelKey: normalizeKey(item.label),
    amountCent,
    categoryId,
    recurring,
  }
}

/** Signal aus dem Setzen eines Kategorie-Monatsbudgets (Cent). */
export function budgetSetEvent(
  categoryId: string,
  amountCent: number,
  monthId: string,
): BudgetSetInput {
  return { type: 'budget-set', categoryId, amountCent, monthId }
}

/** Signal aus dem Bestätigen einer wiederkehrenden Zahlung (Cent, Tag im Monat). */
export function recurringConfirmedEvent(
  counterparty: string,
  amountCent: number,
  dayOfMonth: number,
): RecurringConfirmedInput {
  return {
    type: 'recurring-confirmed',
    counterpartyKey: normalizeKey(counterparty),
    amountCent,
    dayOfMonth,
  }
}
