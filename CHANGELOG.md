# Changelog

Versionen nach [SemVer](https://semver.org/lang/de/): neue Funktion → MINOR, Fehlerbehebung →
PATCH. Unter 1.0 noch nicht offiziell veröffentlicht. Die Version steht in `package.json` und in
der App unter Einstellungen → „Über jobpilot“.

## 0.2.0 – 2026-11-21

- Dublettenprüfung beim Anlegen und Bearbeiten einer Bewerbung: Gibt es die Stelle schon (gleiche
  Adresse der Anzeige, gleiche Firma und Position oder gleiche Firma mit fast gleichem
  Anzeigentext), erscheint ein Hinweis mit den vorhandenen Bewerbungen – „Öffnen“, „Weiter
  bearbeiten“ oder „Trotzdem speichern“.
- Versionsnummer unter Einstellungen → „Über jobpilot“.

## 0.1.0 – 2026-11-21

Stand vor Einführung der Versionsnummern (bis Commit 669ebab):

- Bewerbungen auf der zentralen Supabase-Datenbank: Übersicht, Liste mit Suche/Filter/Sortierung,
  Board mit Drag & Drop, Details mit Notizen, Kontakten, Terminen und Verlauf, Erinnerungen mit
  Systembenachrichtigungen, Auswertung, eigener KI-Key.
- Anmeldung und Registrierung mit Passwortregeln, Aussehen der mobile-app, App-Icon.
- Profil (Lebenslauf) mit Willkommensseite, Assistent, PDF-Import und KI-Check.
- Dokumente (Zeugnisse, Zertifikate, Anhänge) mit Zuordnung zu Stationen, Bewerbungsfoto.
