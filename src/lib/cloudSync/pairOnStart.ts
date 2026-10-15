// Beim Öffnen eines Kopplungs-Links: Einmal-Code gegen den Zugang tauschen und
// dieses Gerät als neu markieren (es übernimmt beim ersten Abgleich den
// Cloud-Stand; eigene Altdaten werden vorher gesichert).

import { readPairing } from '../pairing'
import { redeemPairCode } from '../bankApi'
import { getSyncConfig, setSyncConfig } from '../syncConfig'
import { useCloudMeta } from './engine'

export const JUST_PAIRED_KEY = 'mb-just-paired'

/** Liest #koppeln=… aus der Adresse, entfernt es sofort und löst den Code ein. */
export async function pairFromLocation(): Promise<void> {
  const invite = readPairing(window.location.hash)
  if (!invite) return
  // Fragment sofort aus Adresszeile und Verlauf entfernen.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)

  const existing = getSyncConfig()
  if (existing.url && existing.url !== invite.url) {
    const ok = window.confirm(
      `Dieses Gerät ist schon mit ${existing.url} verbunden.\n\nStattdessen mit ${invite.url} verbinden? ` +
        'Alle Daten gingen dann an diesen Server. Nur bestätigen, wenn du den Link selbst erzeugt hast.',
    )
    if (!ok) return
  }
  try {
    const token = await redeemPairCode(invite.url, invite.code)
    setSyncConfig({ url: invite.url, token })
    // Bereits mit genau diesem Stand verbunden: nicht erneut übernehmen.
    if (existing.url !== invite.url || existing.token !== token) useCloudMeta.setState({ revision: null })
    sessionStorage.setItem(JUST_PAIRED_KEY, 'ok')
  } catch (e) {
    sessionStorage.setItem(JUST_PAIRED_KEY, e instanceof Error ? e.message : 'Kopplung fehlgeschlagen.')
  }
}
