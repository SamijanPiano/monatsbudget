// Weiteres Gerät koppeln, ohne etwas abzutippen: ein verbundenes Gerät holt
// beim Worker einen Einmal-Code (10 Minuten gültig, genau einmal einlösbar)
// und baut daraus einen Link. Der Code steht im URL-Fragment (#…), das nie an
// einen Server geht; das neue Gerät tauscht ihn beim Öffnen gegen den Zugang
// und entfernt das Fragment sofort. Der dauerhafte Zugang steht nie im Link.

const PREFIX = '#koppeln='
const CODE_RE = /^[0-9a-f]{32}$/

export interface PairingInvite {
  /** Worker-Adresse. */
  url: string
  /** Einmal-Code. */
  code: string
}

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  return atob(value.replace(/-/g, '+').replace(/_/g, '/'))
}

/** Link für ein weiteres Gerät. `appUrl` = Adresse der App (ein Fragment wird ersetzt). */
export function buildPairingLink(appUrl: string, invite: PairingInvite): string {
  const base = appUrl.split('#')[0]
  return `${base}${PREFIX}${toBase64Url(JSON.stringify({ u: invite.url, c: invite.code }))}`
}

/** Liest eine Einladung aus einem Fragment; null bei fremden oder ungültigen Inhalten. */
export function readPairing(hash: string): PairingInvite | null {
  if (!hash.startsWith(PREFIX)) return null
  try {
    const data = JSON.parse(fromBase64Url(hash.slice(PREFIX.length))) as { u?: unknown; c?: unknown }
    const url = typeof data.u === 'string' ? data.u.trim().replace(/\/$/, '') : ''
    const code = typeof data.c === 'string' ? data.c.trim() : ''
    // Nur verschlüsselte Backends annehmen; http nur für lokale Entwicklung (gleiche Regel wie im API-Client).
    const secure = url.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)
    if (!secure || !CODE_RE.test(code)) return null
    return { url, code }
  } catch {
    return null
  }
}
