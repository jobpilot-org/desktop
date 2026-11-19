# JobPilot Desktop

Electron-App (Electron Forge, Vite, TypeScript, React) zum Verwalten von Bewerbungen. Sie arbeitet –
wie alle JobPilot-Apps – direkt auf der zentralen Supabase-Datenbank aus `../backend`; lokal wird
nichts außer der Login-Session und der Benachrichtigungs-Einstellung gespeichert.

## Funktionen

- Anmeldung mit Supabase-Konto (Sign-ups sind abgeschaltet, Konten im Dashboard anlegen)
- Übersicht: Zähler je Filter, heute fällige Erinnerungen, Termine der nächsten 14 Tage
- Bewerbungen als Tabelle (Suche, Filter, Sortierung) oder Board – Karten per Drag & Drop in eine
  andere Spalte ziehen ändert den Status („Abgeschlossen“ setzt „Abgesagt“)
- Detail: Status, Eckdaten, Erinnerungen (Erledigt/Später/eigene), Termine, Kontakte, Notizen,
  Verlauf; Löschen ist weich und lässt sich per Toast rückgängig machen
- Auswertung: Funnel, Rückmeldequote, Bewerbungen pro Woche, Erfolg nach Quelle
- Erinnerungen: Abgleich mit den Regeln nach jeder Änderung und stündlich; fällige Erinnerungen
  optional als Systembenachrichtigung (Einstellung je Rechner)

Noch nicht enthalten: KI-Assistent, Import/Export (Backup, CSV), Demo-Modus.

## Entwicklung

```bash
npm install
npm start                  # Dev-Modus mit Hot Reload
npm run check              # lint + typecheck + test – vor "fertig" ausführen
npm run test:integration   # Repositories gegen die lokale Supabase (siehe unten)
npm run make               # Installer/Pakete für die aktuelle Plattform
```

Supabase: Standard ist die lokale Instanz (`supabase start` in `../backend`). Für eine andere
Instanz `.env.example` nach `.env` kopieren. Die Integrationstests melden sich mit dem lokalen
Testkonto `test@jobpilot.local` / `jobpilot-test` an (überschreibbar mit `SUPABASE_TEST_EMAIL` /
`SUPABASE_TEST_PASSWORD`) und löschen ihre Testdaten danach wieder.

## Aufbau

- `src/main.ts` – Main-Prozess: Fenster mit `contextIsolation` + `sandbox`, externe Links öffnen im
  Standardbrowser, IPC `window:focus` für Klicks auf Benachrichtigungen
- `src/preload.ts` – einzige Brücke zum Renderer (`window.desktop`)
- `src/domain/` – **unveränderte Kopie** aus `../mobile-app/src/domain` (inkl. Tests). Änderungen
  dort hier nachziehen; oxfmt ignoriert den Ordner, damit ein Diff gegen das Original sauber bleibt
- `src/data/` – Supabase-Client, Mapper (`snake_case`/`timestamptz` ↔ Domain-Typen mit ISO-`Z`) und
  asynchrone Repositories mit derselben API wie in der mobile-app. `user_id` setzt die Datenbank,
  RLS beschränkt auf eigene Zeilen. Bewerbung und Statusereignis werden ohne Transaktion
  nacheinander geschrieben
- `src/renderer/` – React-UI (HashRouter, weil die gebaute App per `file://` lädt). Nach jedem
  Schreiben `notifyChange()`; `useData` lädt dann neu, ebenso beim Zurückkehren ins Fenster
