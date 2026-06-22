// Lokale Konfiguration des Bank-Sync-Backends (Worker-URL + Zugriffs-Token).
// Bewusst getrennt vom Budget-Store: enthält Zugangsdaten, keine Budget-Daten.

const URL_KEY = 'mb-sync-backend-url'
const TOKEN_KEY = 'mb-sync-token'

export interface SyncConfig {
  url: string
  token: string
}

export function getSyncConfig(): SyncConfig {
  return {
    url: localStorage.getItem(URL_KEY) ?? '',
    token: localStorage.getItem(TOKEN_KEY) ?? '',
  }
}

export function setSyncConfig(config: SyncConfig): void {
  localStorage.setItem(URL_KEY, config.url.trim().replace(/\/$/, ''))
  localStorage.setItem(TOKEN_KEY, config.token.trim())
}

export function isSyncConfigured(config: SyncConfig = getSyncConfig()): boolean {
  return config.url.length > 0 && config.token.length > 0
}
