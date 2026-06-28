// Konfiguration des Bank-Sync-Backends (Worker-URL + Zugriffs-Token).
// Bewusst getrennt vom Budget-Store: enthält Zugangsdaten, keine Budget-Daten.
//
// Auflösungsreihenfolge: Build-Env (VITE_SYNC_*) → localStorage-Fallback.
// Dadurch sieht der normale Nutzer keine technischen Felder mehr — die App
// bringt die Konfiguration über `.env.local` bereits mit. localStorage bleibt
// als einmaliger Einrichtungs-Fallback, falls keine Env gesetzt ist.

const URL_KEY = 'mb-sync-backend-url'
const TOKEN_KEY = 'mb-sync-token'

const ENV_URL = (import.meta.env.VITE_SYNC_BACKEND_URL ?? '').trim().replace(/\/$/, '')
const ENV_TOKEN = (import.meta.env.VITE_SYNC_TOKEN ?? '').trim()

export interface SyncConfig {
  url: string
  token: string
}

export function getSyncConfig(): SyncConfig {
  return {
    url: ENV_URL || (localStorage.getItem(URL_KEY) ?? ''),
    token: ENV_TOKEN || (localStorage.getItem(TOKEN_KEY) ?? ''),
  }
}

export function setSyncConfig(config: SyncConfig): void {
  localStorage.setItem(URL_KEY, config.url.trim().replace(/\/$/, ''))
  localStorage.setItem(TOKEN_KEY, config.token.trim())
}

export function isSyncConfigured(config: SyncConfig = getSyncConfig()): boolean {
  return config.url.length > 0 && config.token.length > 0
}

/** Ob die Konfiguration aus der Build-Env stammt (dann ist kein Setup-UI nötig). */
export function isConfiguredViaEnv(): boolean {
  return ENV_URL.length > 0 && ENV_TOKEN.length > 0
}
