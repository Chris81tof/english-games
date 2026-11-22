#!/usr/bin/env python3
"""Erzeugt data/i18n/<lang>.js aus einer TSV-Datei (Schlüssel<TAB>Übersetzung), alle als „automatisch übersetzt“.

Aufruf:  python3 tools/uebersetzung-schreiben.py <lang> <datei.tsv>
Bereits geprüfte Einträge (1) in einer vorhandenen Datei bleiben erhalten. Prüft, dass jeder Schlüssel existiert.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from lehrkraft import parse_tr, tr_line  # noqa: E402

NAMES = {'ar': 'Arabisch', 'fr': 'Französisch', 'es': 'Spanisch', 'it': 'Italienisch', 'tr': 'Türkisch',
         'ku': 'Kurdisch (Kurmancî)', 'bg': 'Bulgarisch', 'uk': 'Ukrainisch', 'ru': 'Russisch', 'ro': 'Rumänisch',
         'pl': 'Polnisch', 'el': 'Griechisch', 'bhs': 'Bosnisch/Kroatisch/Serbisch', 'sq': 'Albanisch'}


def all_keys():
    js = r"""
global.window = global; global.EG = { units: [], commands: [], categories: [], contractions: [],
  registerUnit(u) { this.units.push(u); }, registerCommands(l) { this.commands.push(...l); },
  registerCategories(l) { this.categories.push(...l); }, registerContractions(l) { this.contractions.push(...l); } };
const fs = require('fs'), path = require('path');
for (const f of ['data/contractions.js', 'data/commands.js', 'data/categories.js'].concat(
  fs.readdirSync('data/units').filter((x) => x.endsWith('.js')).sort().map((x) => 'data/units/' + x))) require(path.resolve(f));
const keys = [];
EG.units.forEach((u) => u.words.forEach((w) => keys.push(u.id + '|' + w.en)));
EG.commands.forEach((c) => keys.push('cmd|' + c.text));
EG.categories.forEach((c) => keys.push('cat|' + c.name));
EG.contractions.forEach((c) => keys.push('zip|' + c.long));
console.log(JSON.stringify(keys));
"""
    return json.loads(subprocess.run(['node', '-e', js], cwd=str(ROOT), capture_output=True, text=True, check=True).stdout)


def main():
    lang, tsv = sys.argv[1], Path(sys.argv[2])
    keys = all_keys()
    new = {}
    for n, line in enumerate(tsv.read_text(encoding='utf-8').splitlines(), 1):
        if not line.strip():
            continue
        k, _, v = line.partition('\t')
        if not v.strip():
            sys.exit('Zeile %d: keine Übersetzung' % n)
        new[k] = v.strip()
    unknown = [k for k in new if k not in keys]
    missing = [k for k in keys if k not in new]
    if unknown:
        sys.exit('Unbekannte Schlüssel: %s' % unknown[:10])
    out = ROOT / 'data' / 'i18n' / (lang + '.js')
    old = parse_tr(out.read_text(encoding='utf-8')) if out.exists() else {}
    lines = ['// Übersetzungen %s. [Text, 0 = automatisch übersetzt | 1 = geprüft]. Fehlt ein Eintrag, zeigt die App Deutsch.' % NAMES.get(lang, lang),
             "EG.registerTranslations('%s', {" % lang]
    for k in keys:
        if k in old and old[k][1] == 1:
            lines.append(tr_line(k, old[k]))          # geprüft: nicht überschreiben
        elif k in new:
            lines.append(tr_line(k, [new[k], 0]))
    lines.append('});\n')
    out.write_text('\n'.join(lines), encoding='utf-8')
    print('%s: %d Einträge geschrieben, %d fehlen.' % (out.relative_to(ROOT), len(lines) - 3, len(missing)))
    if missing:
        print('Fehlend:', missing[:20])


if __name__ == '__main__':
    main()
