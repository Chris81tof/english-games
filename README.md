# English Games

Web-App für den Englischunterricht (Klasse 5–10). Reines HTML/CSS/JS, kein Build, keine Anmeldung.

**Starten:** `index.html` im Browser öffnen, oder `python3 -m http.server 8123` und http://localhost:8123.
**Veröffentlichen:** Ordner in ein GitHub-Repo legen, Pages auf den Hauptzweig stellen.

## Neues Spiel
1. `js/games/mein-spiel.js` anlegen und `EG.registerGame({ id, name, emoji, tagline, mount(ctx) {…} })` aufrufen (Vorlage: `zip-it.js`).
2. Eine `<script>`-Zeile in `index.html` ergänzen. Das Spiel erscheint automatisch in Einstellungen und Spielauswahl.

`ctx` enthält: `el` (Spielfläche), `mode`, `board` (Punkte), `year`, `words` (alle Wörter der Auswahl, je Wort mit `level` und `section`), `levels` (gewählte Niveaus), `maxLevel`, `exit()`, `restart()`.
Braucht ein Spiel Vokabeln, gib `minWords: n` an – bei weniger Wörtern zeigt die Spielauswahl einen Hinweis.

## Neue Unit
`data/units/jgX-name.js` mit `EG.registerUnit({ year, id, title, book, sections: [{ id, name }], words: [{ en, de, emoji, level, section }] })` und eine `<script>`-Zeile in `index.html`. Abschnitte ohne Wörter werden nicht angezeigt.

## Zwei Modi
**Lehrkraft-Modus (lokal auf dem Laptop):** Doppelklick auf `Lehrkraft-starten.command` (oder `python3 tools/lehrkraft.py`). Die App öffnet sich unter http://localhost:8123. Beenden mit Strg+C.
- Wortliste: Deutsch, Emoji und Niveau direkt in der Tabelle ändern. Jede Änderung wird sofort in `data/units/*.js` geschrieben und gilt in allen Spielen. ✎ markiert Zeilen, die sich vom letzten Commit unterscheiden. „Änderungen rückgängig“ nimmt die jeweils letzte Änderung zurück.
- Einstellungen sind offen; dort wird auch die PIN für den Schüler-Modus festgelegt (Hash in `data/pin.js`).

**Schüler-Modus (GitHub Pages oder jede Seite ohne den lokalen Server):** Wortliste nur lesbar. Statt des Zahnrads steht ein 🔒; 5× schnell darauf tippen öffnet die PIN-Abfrage, nach 3 falschen Eingaben ist sie 5 Minuten gesperrt. Die PIN ist eine Hürde für Kinder, kein echter Schutz (der Hash steht in einer öffentlichen Datei).

## Änderungen online bringen
```bash
git add -A && git commit -m "Wortliste angepasst" && git push
```
GitHub Pages veröffentlicht den neuen Stand nach etwa einer Minute.

## Sprachen
Oben rechts wählt der Globus die Sprache (Standard: Englisch, britisch). Sie gilt für alle Menütexte und Anweisungen; Texte, die nur die Lehrkraft sieht, bleiben Deutsch. Die Übersetzung in Wortliste und Spielen folgt der Sprache (bei Englisch: Deutsch). Fehlt eine Übersetzung, erscheint das deutsche Wort. Die App merkt sich die Sprache.
- Menütexte: `data/i18n/ui-<sprache>.js`
- Übersetzungen: `data/i18n/<sprache>.js`, je Eintrag `[Text, 0 = automatisch übersetzt | 1 = geprüft]`. Schlüssel: `unitId|englisch`, `cmd|…`, `cat|…`, `zip|…`.
- Im Lehrkraft-Modus ist die Übersetzungsspalte bearbeitbar; 🤖 markiert automatisch übersetzte Einträge, eine bearbeitete Übersetzung gilt als geprüft.
- Neue Unit: alle Sprachen mitübersetzen (`python3 tools/uebersetzung-schreiben.py <sprache> <datei.tsv>`, Zeilen `schlüssel<TAB>übersetzung`).

## Alle Sprachen (Schritt 2)
Jetzt stehen alle 16 Sprachen aus der Anfrage zur Verfügung: Englisch, Deutsch, Französisch, Spanisch, Italienisch, Türkisch, Kurdisch (Kurmancî), Arabisch, Bulgarisch, Ukrainisch, Russisch, Rumänisch, Polnisch, Griechisch, Bosnisch/Kroatisch/Serbisch, Albanisch. Alle 364 Einträge (Vokabeln, Befehle, Kategorien, Kurzformen) sind in jede Sprache automatisch übersetzt; alle Menütexte ebenso.

## Drei weitere Spiele
- **What's missing?** – Karten zeigen, eine verdeckt sich, raten was fehlt. Kartenzahl (5/6/7) richtet sich nach dem höchsten gewählten Niveau.
- **Memory** – Wort- und Bildkarten umdrehen und Paare finden. Bei Spieler/Teams wechselt bei einem Fehlversuch die Seite; bei Ganzer Klasse zählt jeder Treffer für die Klasse.
- **Word scramble** – Buchstaben eines Wortes sind gemischt, die Lösung wird per Knopf aufgedeckt.

Alle drei nutzen dieselbe Auswahl (Units/Abschnitte/Niveaus) und sind in allen 16 Sprachen verfügbar.

## Spiele an-/abhaken gilt für alle Geräte
Die Einstellung, welche Spiele pro Jahrgang angezeigt werden, steht in `data/settings.js` und ist damit Teil des veröffentlichten Standes – nicht mehr nur auf einem Gerät gespeichert. Ändern lässt sie sich nur im Lehrkraft-Modus (Einstellungen → Tabelle); überall sonst (auch in den Schul-iPads und auf GitHub Pages) ist sie nur lesbar. Nach einer Änderung bitte committen und pushen, damit sie online ankommt.
