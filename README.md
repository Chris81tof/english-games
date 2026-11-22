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

## Wörter bearbeiten und einbauen
In der Wortliste (Auswahlseite → „Wörter ansehen“) lassen sich Deutsch, Emoji und Niveau direkt ändern. Die Änderungen liegen nur in diesem Browser und gelten sofort in allen Spielen. „Änderungen exportieren“ lädt eine JSON-Datei herunter. Zum Einbauen in die Vokabeldateien:

```bash
python3 tools/einbauen.py english-games-aenderungen-JJJJ-MM-TT.json
```
