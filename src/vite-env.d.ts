/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend-URL des Bank-Sync-Workers (z. B. https://…workers.dev). */
  readonly VITE_SYNC_BACKEND_URL?: string
  /** Zugriffs-Token (X-App-Token) für das Bank-Sync-Backend. */
  readonly VITE_SYNC_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
