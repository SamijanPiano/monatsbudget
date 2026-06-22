/**
 * Thin Enable Banking API client for Cloudflare Workers.
 *
 * Auth: RS256 JWT signed with the application's RSA private key (PKCS8 PEM),
 * sent as `Authorization: Bearer <jwt>`. See:
 *  - https://enablebanking.com/docs/api/quick-start/
 *  - https://enablebanking.com/docs/api/reference/
 *
 * The pure parts (base64url, JWT header/claims building) are exported so they
 * can be unit-tested without network or crypto secrets.
 */

import type {
  EbAspsp,
  EbAccountResource,
  EbBalancesResponse,
  EbTransactionsResponse,
} from './normalize.js';

const API_BASE = 'https://api.enablebanking.com';
const ISS = 'enablebanking.com';
const AUD = 'api.enablebanking.com';

// JWT lifetime. Enable Banking caps token TTL at 86400s; keep it short.
const JWT_TTL_SECONDS = 3600;

// ---------------------------------------------------------------------------
// Pure encoding / claim helpers (testable)
// ---------------------------------------------------------------------------

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlEncodeJson(value: unknown): string {
  const json = JSON.stringify(value);
  return base64UrlEncode(new TextEncoder().encode(json));
}

export interface JwtHeader {
  typ: 'JWT';
  alg: 'RS256';
  kid: string;
}

export interface JwtClaims {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export function buildJwtHeader(appId: string): JwtHeader {
  return { typ: 'JWT', alg: 'RS256', kid: appId };
}

/** Build claims from a unix-seconds `nowSeconds` (injectable for tests). */
export function buildJwtClaims(nowSeconds: number, ttlSeconds: number = JWT_TTL_SECONDS): JwtClaims {
  return {
    iss: ISS,
    aud: AUD,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
}

/**
 * Strip PEM armor + whitespace and decode the base64 body to raw DER bytes.
 * Accepts a PKCS8 private key PEM ("BEGIN PRIVATE KEY").
 */
export function pemToPkcs8Der(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// JWT signing (Web Crypto)
// ---------------------------------------------------------------------------

async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  const der = pemToPkcs8Der(privateKeyPem);
  return crypto.subtle.importKey(
    'pkcs8',
    der as unknown as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

export async function signJwt(appId: string, privateKeyPem: string): Promise<string> {
  const header = buildJwtHeader(appId);
  const claims = buildJwtClaims(Math.floor(Date.now() / 1000));
  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(claims)}`;

  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export interface EbConfig {
  appId: string;
  privateKeyPem: string;
}

interface EbStartAuthResponse {
  url: string;
  authorization_id?: string;
  psu_id_hash?: string;
}

interface EbSessionAccount {
  uid?: string | null;
  account_id?: { iban?: string | null } | null;
}

interface EbAuthorizeSessionResponse {
  session_id: string;
  accounts?: Array<EbSessionAccount | string> | null;
  aspsp?: EbAspsp;
}

interface EbAspspsResponse {
  aspsps?: EbAspsp[] | null;
}

export class EnableBankingError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = 'EnableBankingError';
  }
}

export class EnableBankingClient {
  constructor(private readonly config: EbConfig) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const jwt = await signJwt(this.config.appId, this.config.privateKeyPem);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new EnableBankingError(
        `Enable Banking ${method} ${path} failed: ${res.status}`,
        res.status,
        text
      );
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** GET /aspsps?country=XX — available banks. */
  async listAspsps(country: string): Promise<EbAspsp[]> {
    const q = new URLSearchParams({ country });
    const data = await this.request<EbAspspsResponse>('GET', `/aspsps?${q.toString()}`);
    return Array.isArray(data.aspsps) ? data.aspsps : [];
  }

  /**
   * POST /auth — start consent. Returns the bank authorization URL.
   * `validUntil` is an RFC3339 datetime (when access expires, ~90 days max).
   */
  async startAuthorization(args: {
    aspsp: EbAspsp;
    state: string;
    redirectUrl: string;
    validUntil: string;
  }): Promise<EbStartAuthResponse> {
    return this.request<EbStartAuthResponse>('POST', '/auth', {
      access: { valid_until: args.validUntil },
      aspsp: { name: args.aspsp.name, country: args.aspsp.country },
      state: args.state,
      redirect_url: args.redirectUrl,
      psu_type: 'personal',
    });
  }

  /**
   * POST /sessions — exchange the authorization `code` for a session.
   * Normalizes the accounts array to a plain list of uid strings.
   */
  async createSession(code: string): Promise<{ sessionId: string; accountUids: string[] }> {
    const data = await this.request<EbAuthorizeSessionResponse>('POST', '/sessions', { code });
    const accountUids: string[] = [];
    for (const acc of data.accounts ?? []) {
      if (typeof acc === 'string') {
        accountUids.push(acc);
      } else if (acc && typeof acc.uid === 'string') {
        accountUids.push(acc.uid);
      }
    }
    return { sessionId: data.session_id, accountUids };
  }

  /** GET /accounts/{uid}/details */
  async getAccountDetails(uid: string): Promise<EbAccountResource> {
    return this.request<EbAccountResource>('GET', `/accounts/${encodeURIComponent(uid)}/details`);
  }

  /** GET /accounts/{uid}/balances */
  async getAccountBalances(uid: string): Promise<EbBalancesResponse> {
    return this.request<EbBalancesResponse>('GET', `/accounts/${encodeURIComponent(uid)}/balances`);
  }

  /** GET /accounts/{uid}/transactions?date_from=YYYY-MM-DD */
  async getAccountTransactions(uid: string, dateFrom: string): Promise<EbTransactionsResponse> {
    const q = new URLSearchParams({ date_from: dateFrom });
    return this.request<EbTransactionsResponse>(
      'GET',
      `/accounts/${encodeURIComponent(uid)}/transactions?${q.toString()}`
    );
  }
}
