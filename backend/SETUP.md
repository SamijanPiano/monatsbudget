# Monatsbudget Bank-Sync Backend — Setup

A small Cloudflare Worker that connects the Monatsbudget PWA to your own bank
accounts through the [Enable Banking](https://enablebanking.com) aggregator
(PSD2 / Open Banking). Single user, one shared secret. No third-party data is
stored beyond the bank session and account ids in Cloudflare KV.

This guide is for a solo developer connecting **their own** accounts.

---

## 0. What you'll end up with

- A Worker URL, e.g. `https://monatsbudget-bank-backend.<you>.workers.dev`
- An `APP_TOKEN` (a random secret) you paste into the PWA settings
- A consent flow: PWA → Worker `/api/connect` → bank login → Worker
  `/api/callback` → back to the PWA with `?bank=connected`

---

## 1. Enable Banking account + application

1. Sign up at <https://enablebanking.com> and open the
   [Control Panel](https://enablebanking.com/cp/).
2. **Create an application.** You'll register two environments:
   - **Sandbox** — for testing against mock banks first.
   - **Production (restricted to your own accounts)** — Enable Banking offers a
     free tier for connecting your *own* personal accounts. Select the
     country (DE) and the AIS (account information) service.
3. During registration you set one or more **redirect URLs**. Use your Worker's
   callback (you can add it now as a placeholder and fix it after step 5):
   ```
   https://monatsbudget-bank-backend.<you>.workers.dev/api/callback
   ```
4. After creating the app you get an **Application ID** (this becomes
   `ENABLE_APP_ID`, used as the JWT `kid`).
5. **Download the private key** (RSA, PKCS8 PEM — the file starting with
   `-----BEGIN PRIVATE KEY-----`). Enable Banking only shows/serves it once.
   Keep it safe; this becomes `ENABLE_PRIVATE_KEY`.

Docs: <https://enablebanking.com/docs/api/quick-start/>

---

## 2. Cloudflare / Wrangler

```bash
cd backend
npm install
npx wrangler login        # opens browser, authorize Wrangler
```

(You need a free Cloudflare account. `npm create cloudflare` is **not** needed —
this project is already scaffolded.)

---

## 3. Create the KV namespace

```bash
npx wrangler kv namespace create SESSIONS
```

This prints an `id`. Run it again with `--preview` for local `wrangler dev`:

```bash
npx wrangler kv namespace create SESSIONS --preview
```

Paste both into `wrangler.toml`, replacing the placeholders:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "<id from first command>"
preview_id = "<preview_id from second command>"
```

---

## 4. Set secrets and config

Secrets (never committed, stored encrypted by Cloudflare):

```bash
npx wrangler secret put ENABLE_APP_ID
# paste the Application ID

npx wrangler secret put ENABLE_PRIVATE_KEY
# paste the FULL private key PEM, including the
# -----BEGIN PRIVATE KEY----- / -----END PRIVATE KEY----- lines.
# Multi-line paste is fine; finish with Ctrl-D if your shell needs it.

npx wrangler secret put APP_TOKEN
# paste a long random string — generate one with:  openssl rand -hex 32
```

`ALLOWED_ORIGIN` is **not** a secret. It's set in `wrangler.toml` under
`[vars]`. Default is `https://samijanpiano.github.io`. Change it if the PWA is
hosted elsewhere.

> For local development (`wrangler dev`), put the same values in a
> `.dev.vars` file in `backend/` (git-ignored) instead of `wrangler secret put`:
> ```
> ENABLE_APP_ID=...
> ENABLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
> APP_TOKEN=...
> ```

---

## 5. Deploy

```bash
npx wrangler deploy
```

Note the printed Worker URL, e.g.
`https://monatsbudget-bank-backend.<you>.workers.dev`.

---

## 6. Register the real callback URL in Enable Banking

Go back to the Enable Banking application config and make sure the **redirect
URL** is exactly:

```
https://monatsbudget-bank-backend.<you>.workers.dev/api/callback
```

This must match — Enable Banking rejects redirects to URLs not on the list.
The Worker derives this callback URL from its own request host automatically, so
no extra config is needed on the Worker side.

---

## 7. Connect the PWA

In the PWA settings, paste:

- **Backend URL**: `https://monatsbudget-bank-backend.<you>.workers.dev`
- **App token**: the `APP_TOKEN` value from step 4

The PWA sends every request with the `X-App-Token: <APP_TOKEN>` header. Requests
without the correct token get `401`.

Flow from the PWA's perspective:

1. `GET /api/aspsps?country=DE` → list of banks `[{ name, country }]`
2. `POST /api/connect` with `{ aspsp: {name, country}, redirectUrl }` →
   `{ authUrl }`. The PWA redirects the browser to `authUrl`.
3. User logs in at their bank. Bank → Worker `/api/callback?code=…&state=…`.
4. Worker exchanges the code, stores the session in KV, and 302-redirects the
   browser back to the PWA's `redirectUrl` with `?bank=connected` appended
   (or `?bank=error` on failure).
5. `GET /api/accounts` → `[{ id, name, iban, balance }]` (balance in **cents**).
6. `GET /api/transactions?accountId=<id>&dateFrom=YYYY-MM-DD` →
   `[{ date, amount, counterparty, purpose }]` (amount in **signed cents**,
   negative = outgoing).

---

## 8. ~90-day re-consent (important)

PSD2 limits unattended access (SCA exemption) to about **90 days**. The consent
this backend requests is valid for ~89 days. After that the bank will start
returning `401`/`403` and `GET /api/accounts` / `/api/transactions` will fail.

When that happens you simply **reconnect**: run the connect flow again
(step 7.2) and complete the bank login. The new session overwrites the old one
in KV. There is no automatic background refresh — by design this is a manual,
single-user app.

---

## Environment summary

| Name                 | Type        | Where set                  | Purpose                              |
|----------------------|-------------|----------------------------|--------------------------------------|
| `ENABLE_APP_ID`      | secret      | `wrangler secret put`      | JWT `kid`, identifies your EB app    |
| `ENABLE_PRIVATE_KEY` | secret      | `wrangler secret put`      | RSA PKCS8 PEM, signs the JWT (RS256) |
| `APP_TOKEN`          | secret      | `wrangler secret put`      | Shared `X-App-Token` gate            |
| `ALLOWED_ORIGIN`     | var         | `wrangler.toml [vars]`     | CORS origin of the PWA               |
| `SESSIONS`           | KV binding  | `wrangler.toml`            | Stores bank session + account uids   |

## Local test

```bash
cd backend
npm test          # vitest: normalization + JWT-claim building
```
