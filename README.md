# Monatsbudget

Eine installierbare Web-App (PWA) zur monatlichen Budgetplanung mit Zwei-Kanal-System
(**Konto** & **Bar**), Mehr-Monats-Verlauf und „Reicht mein Konto diesen Monat?"-Check.
Dark-Luxury-Design, deutschsprachig.

## Datenschutz

Alle Daten bleiben **lokal im Browser** (localStorage) — kein Konto, kein Server, kein Tracking.
Backups lassen sich als JSON-Datei exportieren und wieder importieren.

## Funktionen

- Einnahmen, feste Abzüge und variable Ausgaben je Kanal (Konto/Bar) frei bearbeitbar
- Live-Kalkulation: Sparbeträge, Sicherheitspuffer, frei verfügbares Geld
- „Reicht es?"-Check: Bargeld zahlt zuerst, das Konto springt für den Rest ein
- Mehrere Monate mit Verlaufs-Charts und Monatsvergleich
- Backup-Export/-Import (JSON)
- Offline-fähig, „Zum Home-Bildschirm" hinzufügbar

## Entwicklung

```bash
npm install
npm run dev      # Dev-Server
npm run test     # Unit-Tests (Vitest)
npm run build    # Produktions-Build
```

Stack: Vite · React · TypeScript · Zustand · vite-plugin-pwa.
