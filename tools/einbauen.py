#!/usr/bin/env python3
"""Baut eine exportierte Änderungsdatei (english-games-aenderungen-*.json) in die Vokabeldateien ein.

Aufruf:  python3 tools/einbauen.py <datei.json> [--dry-run]
Ersetzt je Wort Deutsch, Emoji und Niveau in data/units/*.js. Englisch, Unit und Abschnitt bleiben unverändert.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UNITS = ROOT / 'data' / 'units'
STR = r"""(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")"""
LINE = re.compile(r"^(?P<pre>\s*\{ en: )(?P<en>%s)(?P<mid>,\s*de:\s*)(?P<de>%s)(?P<mid2>,\s*emoji:\s*)(?P<emoji>%s)(?P<mid3>,\s*level:\s*)(?P<level>\d)(?P<post>.*)$" % (STR, STR, STR))


def js_string(value):
    """JS-Stringliteral im Stil der Dateien: einfache Anführungszeichen, sonst doppelte."""
    if "'" not in value:
        return "'" + value.replace('\\', '\\\\') + "'"
    return json.dumps(value, ensure_ascii=False)


def js_value(literal):
    q = literal[0]
    body = literal[1:-1]
    return json.loads('"' + body.replace('\\' + "'", "'").replace('"', '\\"') + '"') if q == "'" else json.loads(literal)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    if not args:
        sys.exit(__doc__)
    changes = json.loads(Path(args[0]).read_text(encoding='utf-8'))['changes']

    files = {}
    for f in UNITS.glob('*.js'):
        m = re.search(r"id:\s*'([^']+)'", f.read_text(encoding='utf-8'))
        if m:
            files[m.group(1)] = f

    done, problems = 0, []
    for unit_id in sorted({c['unit'] for c in changes}):
        if unit_id not in files:
            problems.append(f"Unit '{unit_id}' nicht gefunden")
            continue
        path = files[unit_id]
        lines = path.read_text(encoding='utf-8').split('\n')
        for c in [c for c in changes if c['unit'] == unit_id]:
            hits = [i for i, l in enumerate(lines) if (m := LINE.match(l)) and js_value(m['en']) == c['en']]
            if len(hits) != 1:
                problems.append(f"{unit_id}: '{c['en']}' {'nicht gefunden' if not hits else 'mehrfach vorhanden'}")
                continue
            m = LINE.match(lines[hits[0]])
            if c['level'] not in (1, 2, 3):
                problems.append(f"{unit_id}: '{c['en']}' ungültiges Niveau {c['level']}")
                continue
            lines[hits[0]] = (m['pre'] + m['en'] + m['mid'] + js_string(c['de']) + m['mid2'] + js_string(c['emoji'])
                              + m['mid3'] + str(c['level']) + m['post'])
            done += 1
            print(f"✎ {unit_id}: {c['en']}")
        if not dry:
            path.write_text('\n'.join(lines), encoding='utf-8')

    print(f"\n{done} von {len(changes)} Änderungen {'geprüft' if dry else 'eingebaut'}.")
    for p in problems:
        print('⚠️', p)
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
