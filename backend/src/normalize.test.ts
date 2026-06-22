import { describe, it, expect } from 'vitest';
import {
  toCents,
  normalizeAspsps,
  normalizeAccount,
  normalizeTransaction,
  normalizeTransactions,
  type EbTransaction,
} from './normalize.js';
import {
  base64UrlEncode,
  base64UrlEncodeJson,
  buildJwtHeader,
  buildJwtClaims,
  pemToPkcs8Der,
} from './enablebanking.js';

// ---------------------------------------------------------------------------
// toCents
// ---------------------------------------------------------------------------

describe('toCents', () => {
  it('converts decimal euro strings to integer cents', () => {
    expect(toCents('1.23')).toBe(123);
    expect(toCents('0.01')).toBe(1);
    expect(toCents('1000')).toBe(100000);
    expect(toCents('19.99')).toBe(1999);
  });

  it('handles float-drift-prone values correctly', () => {
    expect(toCents('0.10')).toBe(10);
    expect(toCents('29.30')).toBe(2930);
    expect(toCents(0.29)).toBe(29);
  });

  it('accepts numeric input', () => {
    expect(toCents(1.23)).toBe(123);
  });

  it('returns null for missing or unparseable values', () => {
    expect(toCents(null)).toBeNull();
    expect(toCents(undefined)).toBeNull();
    expect(toCents('')).toBeNull();
    expect(toCents('  ')).toBeNull();
    expect(toCents('abc')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeAspsps
// ---------------------------------------------------------------------------

describe('normalizeAspsps', () => {
  it('maps EB aspsps to {name, country} dropping extra fields', () => {
    const input = [
      { name: 'Sparkasse', country: 'DE', logo: 'x', bic: 'y', auth_methods: ['redirect'] },
      { name: 'Deutsche Bank', country: 'DE', psu_types: ['personal'] },
    ];
    expect(normalizeAspsps(input as never)).toEqual([
      { name: 'Sparkasse', country: 'DE' },
      { name: 'Deutsche Bank', country: 'DE' },
    ]);
  });

  it('returns [] for null / non-array input', () => {
    expect(normalizeAspsps(null)).toEqual([]);
    expect(normalizeAspsps(undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normalizeAccount
// ---------------------------------------------------------------------------

describe('normalizeAccount', () => {
  const uid = '07cc67f4-45d6-494b-adac-09b5cbc7e2b5';

  it('maps details + balances to the contract shape with balance in cents', () => {
    const details = {
      uid,
      name: 'Girokonto',
      account_id: { iban: 'DE89370400440532013000' },
    };
    const balances = {
      balances: [
        { balance_type: 'CLBD', balance_amount: { amount: '1234.56', currency: 'EUR' } },
        { balance_type: 'XPCD', balance_amount: { amount: '1200.00', currency: 'EUR' } },
      ],
    };
    expect(normalizeAccount(uid, details, balances)).toEqual({
      id: uid,
      name: 'Girokonto',
      iban: 'DE89370400440532013000',
      balance: 123456,
    });
  });

  it('prefers closing booked (CLBD) over other balance types', () => {
    const balances = {
      balances: [
        { balance_type: 'XPCD', balance_amount: { amount: '50.00' } },
        { balance_type: 'CLBD', balance_amount: { amount: '42.00' } },
      ],
    };
    expect(normalizeAccount(uid, { uid }, balances).balance).toBe(4200);
  });

  it('falls back to IBAN then uid for the name, and null balance/iban when missing', () => {
    const withIban = normalizeAccount(uid, { account_id: { iban: 'DE111' } }, { balances: [] });
    expect(withIban.name).toBe('DE111');
    expect(withIban.iban).toBe('DE111');
    expect(withIban.balance).toBeNull();

    const bare = normalizeAccount(uid, null, null);
    expect(bare).toEqual({ id: uid, name: uid, iban: null, balance: null });
  });

  it('reads IBAN from account_id.other when iban is absent', () => {
    const details = { account_id: { other: { identification: '1234567890' } } };
    expect(normalizeAccount(uid, details, null).iban).toBe('1234567890');
  });
});

// ---------------------------------------------------------------------------
// normalizeTransaction — signed cents, counterparty, purpose, date
// ---------------------------------------------------------------------------

describe('normalizeTransaction', () => {
  it('signs DBIT (outgoing) as negative and picks the creditor as counterparty', () => {
    const tx: EbTransaction = {
      transaction_amount: { amount: '29.30', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
      booking_date: '2026-06-01',
      creditor: { name: 'REWE Markt GmbH' },
      debtor: { name: 'Samuel Sempf' },
      remittance_information: ['Einkauf', 'Lebensmittel'],
    };
    expect(normalizeTransaction(tx)).toEqual({
      date: '2026-06-01',
      amount: -2930,
      counterparty: 'REWE Markt GmbH',
      purpose: 'Einkauf Lebensmittel',
    });
  });

  it('signs CRDT (incoming) as positive and picks the debtor as counterparty', () => {
    const tx: EbTransaction = {
      transaction_amount: { amount: '2500.00', currency: 'EUR' },
      credit_debit_indicator: 'CRDT',
      booking_date: '2026-06-15',
      creditor: { name: 'Samuel Sempf' },
      debtor: { name: 'Arbeitgeber AG' },
      remittance_information: ['Gehalt Juni'],
    };
    expect(normalizeTransaction(tx)).toEqual({
      date: '2026-06-15',
      amount: 250000,
      counterparty: 'Arbeitgeber AG',
      purpose: 'Gehalt Juni',
    });
  });

  it('handles remittance_information as a plain string', () => {
    const tx: EbTransaction = {
      transaction_amount: { amount: '5.00' },
      credit_debit_indicator: 'DBIT',
      booking_date: '2026-06-02',
      remittance_information: 'Kaffee',
    };
    expect(normalizeTransaction(tx)?.purpose).toBe('Kaffee');
  });

  it('falls back to value_date when booking_date is missing', () => {
    const tx: EbTransaction = {
      transaction_amount: { amount: '1.00' },
      credit_debit_indicator: 'CRDT',
      value_date: '2026-05-31',
    };
    expect(normalizeTransaction(tx)?.date).toBe('2026-05-31');
  });

  it('defaults to positive and empty counterparty/purpose for unknown indicator and no parties', () => {
    const tx: EbTransaction = {
      transaction_amount: { amount: '10.00' },
      booking_date: '2026-06-03',
    };
    expect(normalizeTransaction(tx)).toEqual({
      date: '2026-06-03',
      amount: 1000,
      counterparty: '',
      purpose: '',
    });
  });

  it('returns null when there is no usable amount', () => {
    expect(normalizeTransaction({ credit_debit_indicator: 'DBIT' })).toBeNull();
    expect(normalizeTransaction(null)).toBeNull();
  });
});

describe('normalizeTransactions', () => {
  it('maps a HalTransactions response and drops amount-less entries', () => {
    const response = {
      transactions: [
        {
          transaction_amount: { amount: '1.00' },
          credit_debit_indicator: 'DBIT',
          booking_date: '2026-06-01',
          creditor: { name: 'Shop' },
          remittance_information: ['x'],
        },
        { credit_debit_indicator: 'DBIT', booking_date: '2026-06-02' }, // no amount -> dropped
      ],
    };
    const out = normalizeTransactions(response as never);
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(-100);
  });

  it('returns [] for empty / missing input', () => {
    expect(normalizeTransactions(null)).toEqual([]);
    expect(normalizeTransactions({ transactions: [] })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// JWT building (pure parts of enablebanking.ts)
// ---------------------------------------------------------------------------

describe('JWT helpers', () => {
  it('base64UrlEncode produces url-safe output with no padding', () => {
    // bytes that would normally yield + / and = in standard base64
    const bytes = new Uint8Array([251, 255, 191]);
    const out = base64UrlEncode(bytes);
    expect(out).not.toMatch(/[+/=]/);
  });

  it('round-trips JSON through base64UrlEncodeJson into a decodable claim', () => {
    const claims = buildJwtClaims(1_700_000_000, 3600);
    const encoded = base64UrlEncodeJson(claims);
    const decoded = JSON.parse(
      atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
    );
    expect(decoded).toEqual(claims);
  });

  it('builds the JWT header with the app id as kid', () => {
    expect(buildJwtHeader('app-123')).toEqual({ typ: 'JWT', alg: 'RS256', kid: 'app-123' });
  });

  it('builds claims with the fixed iss/aud and iat/exp from the injected clock', () => {
    const now = 1_700_000_000;
    expect(buildJwtClaims(now, 3600)).toEqual({
      iss: 'enablebanking.com',
      aud: 'api.enablebanking.com',
      iat: now,
      exp: now + 3600,
    });
  });

  it('pemToPkcs8Der strips armor/whitespace and decodes base64 to bytes', () => {
    // "Zm9vYmFy" is base64 for "foobar"
    const pem = '-----BEGIN PRIVATE KEY-----\nZm9v\nYmFy\n-----END PRIVATE KEY-----\n';
    const der = pemToPkcs8Der(pem);
    expect(Array.from(der)).toEqual([...'foobar'].map((c) => c.charCodeAt(0)));
  });
});
