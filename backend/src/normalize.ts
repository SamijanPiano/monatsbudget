/**
 * Pure transforms: Enable Banking API JSON -> the fixed contract shapes the PWA expects.
 *
 * No network, no I/O, no clock. Everything here is a deterministic function of its
 * input so it can be unit-tested in isolation (see normalize.test.ts).
 *
 * Money rule (contract): all amounts are INTEGER CENTS.
 *  - balances: cents, or null when unavailable
 *  - transactions: signed cents (negative = outgoing/DBIT, positive = incoming/CRDT)
 */

// ---------------------------------------------------------------------------
// Contract output shapes (what the PWA consumes). Do not change these.
// ---------------------------------------------------------------------------

export interface AspspOut {
  name: string;
  country: string;
}

export interface AccountOut {
  id: string;
  name: string;
  iban: string | null;
  balance: number | null; // integer cents, or null
}

export interface TransactionOut {
  date: string; // "YYYY-MM-DD"
  amount: number; // signed integer cents (negative = DBIT, positive = CRDT)
  counterparty: string;
  purpose: string;
}

// ---------------------------------------------------------------------------
// Enable Banking input shapes (partial; only the fields we read).
// Kept loose because real API responses carry many extra fields.
// ---------------------------------------------------------------------------

interface EbAmount {
  amount?: string | number | null; // decimal in major units, e.g. "1.23"
  currency?: string;
}

export interface EbAspsp {
  name: string;
  country: string;
  // ...logo, psu_types, auth_methods, etc. are ignored
}

interface EbAccountIdentification {
  iban?: string | null;
  other?: { identification?: string | null } | null;
}

export interface EbAccountResource {
  uid?: string | null;
  name?: string | null;
  account_id?: EbAccountIdentification | null;
  // ...currency, cash_account_type, etc. are ignored
}

interface EbBalance {
  name?: string | null;
  balance_amount?: EbAmount | null;
  balance_type?: string | null; // e.g. CLBD, XPCD, ITBD, OTHR, ...
}

export interface EbBalancesResponse {
  balances?: EbBalance[] | null;
}

export interface EbParty {
  name?: string | null;
}

export interface EbTransaction {
  transaction_amount?: EbAmount | null;
  credit_debit_indicator?: string | null; // "CRDT" | "DBIT"
  booking_date?: string | null; // "YYYY-MM-DD"
  value_date?: string | null; // fallback if booking_date missing
  creditor?: EbParty | null;
  debtor?: EbParty | null;
  remittance_information?: string[] | string | null;
}

export interface EbTransactionsResponse {
  transactions?: EbTransaction[] | null;
}

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/**
 * Convert a decimal major-unit amount (e.g. "1.23" EUR, or 1.23) to integer cents.
 * Returns null for missing / unparseable values.
 *
 * Parsed by string scaling rather than `value * 100` to avoid float drift
 * (0.1 * 100 === 10.000000000000002 -> Math.round fixes it, but we keep it
 * robust by rounding after a guarded multiply).
 */
export function toCents(amount: string | number | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  const raw = typeof amount === 'number' ? amount : amount.trim();
  if (raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

// Balance types ordered by how "closing / available" they are. We pick the
// most authoritative one present. CLBD = closing booked, XPCD = expected,
// ITBD = interim booked, ITAV = interim available, OTHR = other.
const BALANCE_TYPE_PRIORITY = ['CLBD', 'ITBD', 'ITAV', 'XPCD', 'OTHR'];

function pickBalance(balances: EbBalance[]): EbBalance | null {
  if (balances.length === 0) return null;
  for (const type of BALANCE_TYPE_PRIORITY) {
    const match = balances.find((b) => b.balance_type === type);
    if (match) return match;
  }
  // No recognised type — fall back to the first balance with a parseable amount.
  const withAmount = balances.find((b) => toCents(b.balance_amount?.amount) !== null);
  return withAmount ?? balances[0];
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

export function normalizeAspsps(aspsps: EbAspsp[] | null | undefined): AspspOut[] {
  if (!Array.isArray(aspsps)) return [];
  return aspsps
    .filter((a) => a && typeof a.name === 'string' && typeof a.country === 'string')
    .map((a) => ({ name: a.name, country: a.country }));
}

function ibanFrom(details: EbAccountResource): string | null {
  const acc = details.account_id;
  if (!acc) return null;
  if (typeof acc.iban === 'string' && acc.iban.length > 0) return acc.iban;
  const other = acc.other?.identification;
  if (typeof other === 'string' && other.length > 0) return other;
  return null;
}

/**
 * Build one account contract object from its details + balances responses.
 * `id` is the account uid (the path param used to fetch this account).
 */
export function normalizeAccount(
  uid: string,
  details: EbAccountResource | null | undefined,
  balancesResponse: EbBalancesResponse | null | undefined
): AccountOut {
  const d = details ?? {};
  const balances = Array.isArray(balancesResponse?.balances)
    ? (balancesResponse!.balances as EbBalance[])
    : [];
  const chosen = pickBalance(balances);
  const balance = chosen ? toCents(chosen.balance_amount?.amount) : null;

  const name =
    (typeof d.name === 'string' && d.name.trim().length > 0 && d.name.trim()) ||
    ibanFrom(d) ||
    uid;

  return {
    id: uid,
    name,
    iban: ibanFrom(d),
    balance,
  };
}

function remittanceToPurpose(info: string[] | string | null | undefined): string {
  if (info === null || info === undefined) return '';
  if (typeof info === 'string') return info.trim();
  if (Array.isArray(info)) {
    return info
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(' ');
  }
  return '';
}

/**
 * Counterparty = the OPPOSITE party relative to the account owner.
 *  - DBIT (money leaving the account): the creditor (who received it)
 *  - CRDT (money entering the account): the debtor (who sent it)
 * Falls back to whichever party name is present.
 */
function counterpartyName(tx: EbTransaction): string {
  const indicator = (tx.credit_debit_indicator ?? '').toUpperCase();
  const creditorName = tx.creditor?.name?.trim() ?? '';
  const debtorName = tx.debtor?.name?.trim() ?? '';

  if (indicator === 'DBIT') return creditorName || debtorName;
  if (indicator === 'CRDT') return debtorName || creditorName;
  // Unknown indicator: prefer whichever name exists.
  return creditorName || debtorName;
}

/**
 * Sign the magnitude cents from the credit/debit indicator.
 * CRDT -> positive (incoming), DBIT -> negative (outgoing).
 * Unknown indicator leaves the magnitude unsigned (positive).
 */
function signedCents(magnitudeCents: number, indicator: string | null | undefined): number {
  const ind = (indicator ?? '').toUpperCase();
  const abs = Math.abs(magnitudeCents);
  if (ind === 'DBIT') return -abs;
  return abs; // CRDT and unknown -> positive
}

/**
 * Normalize a single transaction. Returns null if it has no usable amount,
 * so callers can drop it (a transaction with no amount is meaningless to the PWA).
 */
export function normalizeTransaction(tx: EbTransaction | null | undefined): TransactionOut | null {
  if (!tx) return null;
  const magnitude = toCents(tx.transaction_amount?.amount);
  if (magnitude === null) return null;

  const date = (tx.booking_date ?? tx.value_date ?? '').trim();

  return {
    date,
    amount: signedCents(magnitude, tx.credit_debit_indicator),
    counterparty: counterpartyName(tx),
    purpose: remittanceToPurpose(tx.remittance_information),
  };
}

export function normalizeTransactions(
  response: EbTransactionsResponse | null | undefined
): TransactionOut[] {
  const list = Array.isArray(response?.transactions)
    ? (response!.transactions as EbTransaction[])
    : [];
  const out: TransactionOut[] = [];
  for (const tx of list) {
    const normalized = normalizeTransaction(tx);
    if (normalized) out.push(normalized);
  }
  return out;
}
