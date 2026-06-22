/**
 * Cloudflare Worker: bank-sync backend for the Monatsbudget PWA.
 *
 * Routes (all under /api, all gated by the X-App-Token header except OPTIONS
 * preflight and the bank-driven /api/callback redirect):
 *   GET  /api/aspsps?country=DE
 *   POST /api/connect          { aspsp:{name,country}, redirectUrl }      -> { authUrl }
 *   GET  /api/callback?code=&state=                                       -> 302 redirect
 *   GET  /api/accounts                                                    -> [account]
 *   GET  /api/transactions?accountId=&dateFrom=YYYY-MM-DD                 -> [transaction]
 *
 * Single-user design: one shared X-App-Token, one stored bank session in KV.
 */

import { EnableBankingClient, EnableBankingError } from './enablebanking.js';
import {
  normalizeAspsps,
  normalizeAccount,
  normalizeTransactions,
  type AccountOut,
} from './normalize.js';

export interface Env {
  SESSIONS: KVNamespace;
  ENABLE_APP_ID: string;
  ENABLE_PRIVATE_KEY: string;
  APP_TOKEN: string;
  ALLOWED_ORIGIN: string;
}

// KV keys
const KV_SESSION = 'session'; // { sessionId, accountUids }
const KV_PENDING_PREFIX = 'pending:'; // pending:<state> -> { redirectUrl }

// Access window for a consent (Enable Banking allows ~90 days for AIS).
const ACCESS_VALID_DAYS = 89;
// Pending-consent state entries expire if the user never finishes the bank flow.
const PENDING_TTL_SECONDS = 60 * 30; // 30 minutes
// Default transactions lookback when the caller omits dateFrom.
const DEFAULT_LOOKBACK_DAYS = 90;

interface StoredSession {
  sessionId: string;
  accountUids: string[];
}

interface PendingConsent {
  redirectUrl: string;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function errorJson(message: string, env: Env, status: number): Response {
  return json({ error: message }, env, status);
}

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------

function isAuthorized(request: Request, env: Env): boolean {
  const token = request.headers.get('X-App-Token');
  return typeof token === 'string' && token.length > 0 && token === env.APP_TOKEN;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rfc3339DaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function client(env: Env): EnableBankingClient {
  return new EnableBankingClient({
    appId: env.ENABLE_APP_ID,
    privateKeyPem: env.ENABLE_PRIVATE_KEY,
  });
}

async function loadSession(env: Env): Promise<StoredSession | null> {
  const raw = await env.SESSIONS.get(KV_SESSION);
  return raw ? (JSON.parse(raw) as StoredSession) : null;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleAspsps(url: URL, env: Env): Promise<Response> {
  const country = url.searchParams.get('country') || 'DE';
  const aspsps = await client(env).listAspsps(country);
  return json(normalizeAspsps(aspsps), env);
}

async function handleConnect(request: Request, env: Env): Promise<Response> {
  let body: { aspsp?: { name?: string; country?: string }; redirectUrl?: string };
  try {
    body = await request.json();
  } catch {
    return errorJson('Invalid JSON body', env, 400);
  }

  const name = body.aspsp?.name;
  const country = body.aspsp?.country;
  const redirectUrl = body.redirectUrl;
  if (!name || !country || !redirectUrl) {
    return errorJson('Missing aspsp.name, aspsp.country, or redirectUrl', env, 400);
  }

  // Opaque CSRF state; also the key under which we stash the PWA's redirect URL.
  const state = crypto.randomUUID();
  const pending: PendingConsent = { redirectUrl };
  await env.SESSIONS.put(KV_PENDING_PREFIX + state, JSON.stringify(pending), {
    expirationTtl: PENDING_TTL_SECONDS,
  });

  // The redirect_url sent to Enable Banking is THIS worker's /api/callback
  // (must match what is registered in the Enable Banking app config).
  const callbackUrl = new URL('/api/callback', request.url).toString();

  const resp = await client(env).startAuthorization({
    aspsp: { name, country },
    state,
    redirectUrl: callbackUrl,
    validUntil: rfc3339DaysFromNow(ACCESS_VALID_DAYS),
  });

  return json({ authUrl: resp.url }, env);
}

async function handleCallback(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Recover the PWA redirect target stashed at /connect time.
  let redirectTarget = env.ALLOWED_ORIGIN;
  if (state) {
    const raw = await env.SESSIONS.get(KV_PENDING_PREFIX + state);
    if (raw) {
      redirectTarget = (JSON.parse(raw) as PendingConsent).redirectUrl;
      await env.SESSIONS.delete(KV_PENDING_PREFIX + state);
    }
  }

  if (!code) {
    return redirectWithFlag(redirectTarget, 'error');
  }

  try {
    const { sessionId, accountUids } = await client(env).createSession(code);
    const stored: StoredSession = { sessionId, accountUids };
    await env.SESSIONS.put(KV_SESSION, JSON.stringify(stored));
  } catch {
    return redirectWithFlag(redirectTarget, 'error');
  }

  return redirectWithFlag(redirectTarget, 'connected');
}

function redirectWithFlag(target: string, status: 'connected' | 'error'): Response {
  let location: string;
  try {
    const u = new URL(target);
    u.searchParams.set('bank', status);
    location = u.toString();
  } catch {
    // target was not a valid absolute URL — append crudely.
    const sep = target.includes('?') ? '&' : '?';
    location = `${target}${sep}bank=${status}`;
  }
  return new Response(null, { status: 302, headers: { Location: location } });
}

async function handleAccounts(env: Env): Promise<Response> {
  const session = await loadSession(env);
  if (!session) return errorJson('No bank session. Connect a bank first.', env, 409);

  const eb = client(env);
  const accounts: AccountOut[] = [];
  for (const uid of session.accountUids) {
    const [details, balances] = await Promise.all([
      eb.getAccountDetails(uid).catch(() => null),
      eb.getAccountBalances(uid).catch(() => null),
    ]);
    accounts.push(normalizeAccount(uid, details, balances));
  }
  return json(accounts, env);
}

async function handleTransactions(url: URL, env: Env): Promise<Response> {
  const accountId = url.searchParams.get('accountId');
  if (!accountId) return errorJson('Missing accountId', env, 400);

  const session = await loadSession(env);
  if (!session) return errorJson('No bank session. Connect a bank first.', env, 409);
  if (!session.accountUids.includes(accountId)) {
    return errorJson('Unknown accountId for the current session', env, 404);
  }

  const dateFrom = url.searchParams.get('dateFrom') || isoDateDaysAgo(DEFAULT_LOOKBACK_DAYS);
  const data = await client(env).getAccountTransactions(accountId, dateFrom);
  return json(normalizeTransactions(data), env);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    // The bank redirects the user's browser here directly (no X-App-Token).
    // It performs its own validation via the opaque `state` it stored.
    if (url.pathname === '/api/callback' && request.method === 'GET') {
      try {
        return await handleCallback(url, env);
      } catch {
        return redirectWithFlag(env.ALLOWED_ORIGIN, 'error');
      }
    }

    // Everything else requires the shared app token.
    if (!isAuthorized(request, env)) {
      return errorJson('Unauthorized', env, 401);
    }

    try {
      if (url.pathname === '/api/aspsps' && request.method === 'GET') {
        return await handleAspsps(url, env);
      }
      if (url.pathname === '/api/connect' && request.method === 'POST') {
        return await handleConnect(request, env);
      }
      if (url.pathname === '/api/accounts' && request.method === 'GET') {
        return await handleAccounts(env);
      }
      if (url.pathname === '/api/transactions' && request.method === 'GET') {
        return await handleTransactions(url, env);
      }
      return errorJson('Not found', env, 404);
    } catch (err) {
      if (err instanceof EnableBankingError) {
        // Surface upstream status but never leak the raw body to the client.
        const status = err.status >= 400 && err.status < 600 ? err.status : 502;
        return errorJson('Bank API request failed', env, status);
      }
      return errorJson('Internal error', env, 500);
    }
  },
};
