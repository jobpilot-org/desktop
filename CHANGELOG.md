# Changelog

Versionen nach [SemVer](https://semver.org/lang/de/): neue Funktion → MINOR, Fehlerbehebung →
PATCH. Unter 1.0 noch nicht offiziell veröffentlicht. Die Version steht in `package.json` und in
der App unter Einstellungen → „Über jobpilot“.

## 0.5.0 – 2026-11-22

- Löschen direkt am Datensatz: Papierkorb in jeder Zeile der Bewerbungsliste, auf jeder Karte im
  Board und in jeder Zeile der Stellenangebote – mit „Rückgängig“ statt Rückfrage.
- „Stellenangebot löschen“ auf der Detailseite ebenfalls mit „Rückgängig“.

## 0.4.0 – 2026-11-22

- Übersicht: neue erste Kachel „Stellenangebote“ (offene Angebote) und Abschnitt „Neue
  Stellenangebote“ mit den fünf neuesten offenen Angeboten.
- Einstellungen → „Darstellung“: System, Hell oder Dunkel – gilt für diesen Rechner, auch für
  Fensterrahmen und Menüs.

## 0.3.0 – 2026-11-22

- Neuer Menüpunkt **„Stellenangebote“**: gemerkte Anzeigen (z. B. aus der Browser-Extension) sind
  keine Bewerbungen mehr, sondern Stellenangebote – mit Filter Offen/Beworben/Verworfen, Detailseite
  mit Eckdaten, Anzeigentext, Ansprechpartner und Link zur Anzeige.
- „Bewerbung anlegen“ füllt das Bewerbungsformular aus dem Stellenangebot vor (Status „Beworben“);
  danach zeigt das Stellenangebot „Bewerbung angelegt“ mit Link, die Bewerbung „Aus Stellenangebot
  vom …“ mit Link zurück. Der Ansprechpartner wird als Kontakt übernommen.
- „Nicht interessant“ verwirft ein Stellenangebot, „Wieder öffnen“ holt es zurück.

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
