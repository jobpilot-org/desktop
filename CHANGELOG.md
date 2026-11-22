# Changelog

Versionen nach [SemVer](https://semver.org/lang/de/): neue Funktion → MINOR, Fehlerbehebung →
PATCH. Unter 1.0 noch nicht offiziell veröffentlicht. Die Version steht in `package.json` und in
der App unter Einstellungen → „Über jobpilot“.

## 0.12.1 – 2026-11-22

- Rückfragen (Löschen, KI-Zustimmung, Anschreiben neu erstellen bzw. neu beginnen) erscheinen im
  jobpilot-Stil mit deutschen Knöpfen statt als Systemdialog mit „Cancel“/„OK“.

## 0.12.0 – 2026-11-22

- Anschreiben: Du/Sie, Anrede, Tonalität und Länge lassen sich auch nach dem Erstellen über den
  Abschnitten und in der Vorschau ändern. Die Anrede gilt sofort; bei anderem Ton, anderer Länge
  oder Du/Sie wird das Anschreiben auf Knopfdruck mit der neuen Auswahl neu erstellt.

## 0.11.0 – 2026-11-22

- Anschreiben: „Neu beginnen“ verwirft ein vorhandenes Anschreiben und startet den Assistenten
  von vorn.
- Vorschau wie ein Brief: Ort und Datum rechtsbündig, Betreff fett.

## 0.10.0 – 2026-11-22

- Anschreiben: Du oder Sie wählbar – vorgeschlagen wird, wie die Stellenanzeige selbst anspricht;
  die Anrede-Vorschläge passen sich an („Hallo Julia“ bzw. „Sehr geehrte Frau …“).
- Mehr Tonalitäten: Förmlich, Konservativ, Modern & sachlich, Persönlich & warm, Begeistert,
  Kreativ, Frech & mutig.

## 0.9.0 – 2026-11-22

- Anschreiben-Assistent an jedem Stellenangebot und jeder Bewerbung: Ansprache wählen (aus der
  Ansprechperson der Anzeige), Ton, Länge und Stärken festlegen, dann schlägt die KI Betreff und
  Abschnitt für Abschnitt vor – jeder Abschnitt lässt sich ändern oder mit einem Wunsch neu
  vorschlagen. Vorschau als Brief mit Absender aus dem Profil, Text zum Kopieren.
- Das Anschreiben gehört zur Anzeige und wandert mit, wenn daraus eine Bewerbung wird.

## 0.8.1 – 2026-11-22

- Passung als Ring statt kleinem Abzeichen: links vor jedem Stellenangebot in Liste und Übersicht,
  groß oben rechts in der Detailseite; noch nicht bewertete Angebote mit Platzhalter.

## 0.8.0 – 2026-11-22

- Stellenangebote mit **mehreren Quellen** (Jobportal und Firmenseite): Die Angaben der Firmenseite
  haben Vorrang, Abweichungen bei Position, Firma, Ort und Gehalt werden angezeigt; Quellen lassen
  sich entfernen.
- Neuer Abschnitt „Bewerbung & Ansprechpartner“ mit Ansprechperson, Bewerbungs-E-Mail (öffnet das
  Mailprogramm) und Bewerbungsseite.
- „Auf Firmenseite suchen ↗“ sucht die Anzeige auf der Website der Firma.
- E-Mail-Links (mailto) öffnen jetzt das Mailprogramm.

## 0.7.0 – 2026-11-22

- Profil: **Links** zu LinkedIn, XING, GitHub, GitLab, Website und Sonstigem – Art wird an der
  Adresse erkannt, „https://“ ergänzt, Klick öffnet im Browser.
- Profil: neuer Abschnitt **Ehrenamt** neben Berufserfahrung und Ausbildung; Dokumente lassen sich
  auch einem Ehrenamt zuordnen.
- PDF-Import liest Ehrenamt und Links mit; Assistent fragt sie ab; KI-Check und Passung
  berücksichtigen das Ehrenamt.

## 0.6.0 – 2026-11-22

- **Passung** für Stellenangebote: Die KI vergleicht dein Profil mit der Anzeige – Score 0–100,
  was dafür und dagegen spricht, eine Prognose deiner Aussichten und was du betonen solltest.
  Score als Abzeichen in der Übersicht und der Stellenangebotsliste, ausführlich im Detail.
- Ändert sich dein Profil oder die Anzeige, erscheint die Bewertung als „veraltet“; „Neu
  bewerten“ rechnet sie neu.
- Einstellungen → KI: neue Stellenangebote automatisch bewerten oder nur auf Knopfdruck.

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
