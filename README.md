# English Games

Web-App für den Englischunterricht (Klasse 5–10). Reines HTML/CSS/JS, kein Build, keine Anmeldung.

**Starten:** `index.html` im Browser öffnen, oder `python3 -m http.server 8123` und http://localhost:8123.
**Veröffentlichen:** Ordner in ein GitHub-Repo legen, Pages auf den Hauptzweig stellen.

## Neues Spiel
1. `js/games/mein-spiel.js` anlegen und `EG.registerGame({ id, name, emoji, tagline, mount(ctx) {…} })` aufrufen (Vorlage: `zip-it.js`).
2. Eine `<script>`-Zeile in `index.html` ergänzen. Das Spiel erscheint automatisch in Einstellungen und Spielauswahl.

`ctx` enthält: `el` (Spielfläche), `mode`, `board` (Punkte), `year`, `unit`, `level` (1–3), `exit()`, `restart()`.

## Neue Unit
`data/units/jgX-name.js` mit `EG.registerUnit({ year, id, title, book, words: [{ en, de, emoji, level }] })` und eine `<script>`-Zeile in `index.html`.
