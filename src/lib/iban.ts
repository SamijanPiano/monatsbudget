// IBAN-Validierung (ISO 13616, Prüfsumme Modulo-97) + Normalisierung/Formatierung.
// Rein funktional. Verhindert offensichtliche Tippfehler VOR dem Absenden einer
// Überweisung — die Bank prüft beim SCA-Schritt endgültig.

// Erwartete Gesamtlänge je Land (Auswahl gängiger SEPA-Länder). Fehlt ein Land,
// wird nur die Prüfsumme (Mod-97) geprüft.
const IBAN_LENGTHS: Record<string, number> = {
  DE: 22,
  AT: 20,
  CH: 21,
  NL: 18,
  FR: 27,
  ES: 24,
  IT: 27,
  BE: 16,
  LU: 20,
  PL: 28,
  PT: 25,
}

/** Whitespace entfernen, Großbuchstaben. */
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

/** Gruppiert die IBAN in Vierer-Blöcke ("DE89 3704 0044 …"). */
export function formatIban(input: string): string {
  return normalizeIban(input)
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

/**
 * Prüft eine IBAN: Grundstruktur, optionale Längen-Prüfung je Land und die
 * Modulo-97-Prüfsumme (Ergebnis muss 1 sein). Ziffernweise gerechnet, daher
 * ohne BigInt.
 */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)) return false

  const expectedLength = IBAN_LENGTHS[iban.slice(0, 2)]
  if (expectedLength && iban.length !== expectedLength) return false

  // Erste vier Zeichen ans Ende, Buchstaben -> Zahlen (A=10 … Z=35).
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const code = char.charCodeAt(0)
    const piece = code >= 65 ? (code - 55).toString() : char // Buchstabe -> 2 Ziffern, Ziffer -> sich selbst
    for (const digit of piece) {
      remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97
    }
  }
  return remainder === 1
}
