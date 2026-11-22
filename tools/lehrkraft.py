#!/usr/bin/env python3
"""Lehrkraft-Modus: startet die App lokal und erlaubt das direkte Ändern der Vokabeldateien.

Start:  python3 tools/lehrkraft.py        (oder Doppelklick auf Lehrkraft-starten.command)

- Die App läuft unter http://localhost:8123 und ist nur von diesem Rechner aus erreichbar.
- In der Wortliste lassen sich Deutsch, Emoji und Niveau ändern; die Änderung wird sofort in
  data/units/*.js geschrieben. „Änderungen rückgängig“ nimmt die jeweils letzte Änderung zurück.
- Als Änderung gilt alles, was vom letzten Git-Commit abweicht (✎ in der Wortliste).
- Übersetzungen in andere Sprachen stehen in data/i18n/<sprache>.js; eine bearbeitete gilt als geprüft.
- Die PIN für den Schüler-Modus wird als Hash in data/pin.js gespeichert.
"""
import hashlib
import json
import os
import re
import secrets
import subprocess
import tempfile
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UNITS = ROOT / 'data' / 'units'
PIN_FILE = ROOT / 'data' / 'pin.js'
I18N = ROOT / 'data' / 'i18n'
HOST, PORT = '127.0.0.1', 8123
FIELDS = ('de', 'emoji', 'level')

STR = r"""(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")"""
LINE = re.compile(
    r"^(?P<pre>\s*\{ en: )(?P<en>%s)(?P<mid>,\s*de:\s*)(?P<de>%s)(?P<mid2>,\s*emoji:\s*)(?P<emoji>%s)"
    r"(?P<mid3>,\s*level:\s*)(?P<level>\d)(?P<post>.*)$" % (STR, STR, STR))

TR_LINE = re.compile(r'^\s*(?P<key>"(?:[^"\\]|\\.)*"): \[(?P<text>"(?:[^"\\]|\\.)*"), (?P<chk>[01])\],?\s*$')

lock = threading.Lock()
undo_stack = []          # Wort: {kind: 'word', unit, en, before} · Übersetzung: {kind: 'tr', lang, key, before: [text, chk] | None}
snapshot = {}            # Rückfall, falls kein Git: Dateistand beim Start


# ---------- JS-Literale ----------
def js_string(value):
    """Stringliteral im Stil der Dateien: einfache Anführungszeichen, sonst doppelte."""
    if "'" not in value:
        return "'" + value.replace('\\', '\\\\') + "'"
    return json.dumps(value, ensure_ascii=False)


def js_value(literal):
    if literal[0] == "'":
        return json.loads('"' + literal[1:-1].replace("\\'", "'").replace('"', '\\"') + '"')
    return json.loads(literal)


# ---------- Vokabeldateien ----------
def unit_files():
    files = {}
    for f in sorted(UNITS.glob('*.js')):
        m = re.search(r"id:\s*'([^']+)'", f.read_text(encoding='utf-8'))
        if m:
            files[m.group(1)] = f
    return files


def parse_words(text):
    """{en: {de, emoji, level}} aus dem Text einer Unit-Datei."""
    words = {}
    for line in text.split('\n'):
        m = LINE.match(line)
        if m:
            words[js_value(m.group('en'))] = {'de': js_value(m.group('de')), 'emoji': js_value(m.group('emoji')),
                                              'level': int(m.group('level'))}
    return words


def baseline(path):
    """Stand des letzten Commits (oder Dateistand beim Start, wenn Git fehlt)."""
    try:
        rel = path.relative_to(ROOT).as_posix()
        out = subprocess.run(['git', 'show', 'HEAD:' + rel], cwd=str(ROOT), capture_output=True, text=True, timeout=10)
        if out.returncode == 0:
            return parse_words(out.stdout)
    except Exception:
        pass
    return parse_words(snapshot.get(path, ''))


def write_atomic(path, text):
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix='.tmp-', suffix='.js')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        fh.write(text)
    os.replace(tmp, str(path))


def set_word(unit, en, patch):
    """Schreibt die Felder in patch in die Zeile des Wortes. Gibt (vorher, nachher) zurück."""
    path = unit_files().get(unit)
    if not path:
        raise ValueError('Unit nicht gefunden')
    lines = path.read_text(encoding='utf-8').split('\n')
    hits = [i for i, l in enumerate(lines) if LINE.match(l) and js_value(LINE.match(l).group('en')) == en]
    if len(hits) != 1:
        raise ValueError('Wort nicht eindeutig gefunden')
    m = LINE.match(lines[hits[0]])
    before = {'de': js_value(m.group('de')), 'emoji': js_value(m.group('emoji')), 'level': int(m.group('level'))}
    now = dict(before, **patch)
    lines[hits[0]] = (m.group('pre') + m.group('en') + m.group('mid') + js_string(now['de']) + m.group('mid2')
                      + js_string(now['emoji']) + m.group('mid3') + str(now['level']) + m.group('post'))
    write_atomic(path, '\n'.join(lines))
    return before, now


# ---------- Übersetzungsdateien data/i18n/<lang>.js ----------
def tr_file(lang):
    if not re.fullmatch(r'[a-z]{2,3}', lang or '') or lang in ('de', 'en'):
        raise ValueError('Unbekannte Sprache')
    path = I18N / (lang + '.js')
    if not path.exists():
        raise ValueError('Keine Übersetzungsdatei für ' + lang)
    return path


def parse_tr(text):
    out = {}
    for line in text.split('\n'):
        m = TR_LINE.match(line)
        if m:
            out[json.loads(m.group('key'))] = [json.loads(m.group('text')), int(m.group('chk'))]
    return out


def tr_line(key, val):
    return '  %s: [%s, %d],' % (json.dumps(key, ensure_ascii=False), json.dumps(val[0], ensure_ascii=False), val[1])


def set_tr(lang, key, val):
    """Setzt (oder entfernt bei val=None) eine Übersetzung. Gibt (vorher, nachher) zurück."""
    path = tr_file(lang)
    lines = path.read_text(encoding='utf-8').split('\n')
    idx = [i for i, l in enumerate(lines) if TR_LINE.match(l) and json.loads(TR_LINE.match(l).group('key')) == key]
    before = None
    if idx:
        m = TR_LINE.match(lines[idx[0]])
        before = [json.loads(m.group('text')), int(m.group('chk'))]
        if val is None:
            del lines[idx[0]]
        else:
            lines[idx[0]] = tr_line(key, val)
    elif val is not None:
        end = max(i for i, l in enumerate(lines) if l.startswith('});'))
        lines.insert(end, tr_line(key, val))
    write_atomic(path, '\n'.join(lines))
    return before, val


def tr_changes():
    out = []
    for path in sorted(I18N.glob('*.js')):
        lang = path.stem
        if lang.startswith('ui-'):
            continue
        cur = parse_tr(path.read_text(encoding='utf-8'))
        base = None
        try:
            rel = path.relative_to(ROOT).as_posix()
            res = subprocess.run(['git', 'show', 'HEAD:' + rel], cwd=str(ROOT), capture_output=True, text=True, timeout=10)
            if res.returncode == 0:
                base = parse_tr(res.stdout)
        except Exception:
            pass
        if base is None:
            base = parse_tr(snapshot.get(path, ''))
        for key in set(cur) | set(base):
            if cur.get(key) != base.get(key):
                out.append({'lang': lang, 'key': key, 'original': base.get(key), 'current': cur.get(key)})
    return out


def clean_text(v, what):
    if not isinstance(v, str) or not v.strip() or len(v) > 200 or re.search('[\x00-\x1f\u2028\u2029]', v):
        raise ValueError('Ungültiger Text für ' + what)
    return v.strip()


def clean_patch(data):
    patch = {}
    for f in FIELDS:
        if f not in data:
            continue
        v = data[f]
        if f == 'level':
            if isinstance(v, bool) or v not in (1, 2, 3):
                raise ValueError('Niveau muss 1, 2 oder 3 sein')
        else:
            v = clean_text(v, f)
        patch[f] = v
    if not patch:
        raise ValueError('Keine Änderung')
    return patch


def changes():
    out = []
    for unit, path in unit_files().items():
        cur, base = parse_words(path.read_text(encoding='utf-8')), baseline(path)
        for en, vals in cur.items():
            if en in base and vals != base[en]:
                out.append({'unit': unit, 'en': en, 'original': base[en], 'current': vals})
    return out


def set_pin(pin):
    if not re.fullmatch(r'\d{4}', pin):
        raise ValueError('Die PIN muss aus genau 4 Ziffern bestehen')
    salt = secrets.token_hex(8)
    digest = hashlib.sha256((salt + pin).encode('utf-8')).hexdigest()
    write_atomic(PIN_FILE, '// Von tools/lehrkraft.py erzeugt: PIN-Hash für den Schüler-Modus (keine Klartext-PIN).\n'
                 'EG.pin = { salt: "%s", hash: "%s" };\n' % (salt, digest))


# ---------- HTTP ----------
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        if self.path.startswith('/api/'):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    # Schutz: nur localhost, keine fremden Webseiten (DNS-Rebinding / CSRF)
    def local_ok(self):
        host = (self.headers.get('Host') or '').lower()
        if host not in ('localhost:%d' % PORT, '127.0.0.1:%d' % PORT):
            return False
        origin = self.headers.get('Origin')
        return origin is None or origin in ('http://localhost:%d' % PORT, 'http://127.0.0.1:%d' % PORT)

    def send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.local_ok():
            return self.send_json(403, {'error': 'nur lokal'})
        path = self.path.split('?')[0]
        if path == '/api/ping':
            return self.send_json(200, {'teacher': True})
        if path == '/api/changes':
            with lock:
                return self.send_json(200, {'changes': changes(), 'translations': tr_changes(), 'undo': len(undo_stack)})
        if any(part.startswith('.') for part in path.split('/') if part):
            return self.send_json(404, {'error': 'nicht gefunden'})   # .git usw. nie ausliefern
        return super().do_GET()

    def do_POST(self):
        if not self.local_ok() or self.headers.get('X-EG') != '1':
            return self.send_json(403, {'error': 'nicht erlaubt'})
        try:
            length = int(self.headers.get('Content-Length') or 0)
            if length > 10000:
                raise ValueError('Anfrage zu groß')
            data = json.loads(self.rfile.read(length) or b'{}')
            path = self.path.split('?')[0]
            with lock:
                if path == '/api/edit':
                    patch = clean_patch(data)
                    before, now = set_word(str(data.get('unit')), str(data.get('en')), patch)
                    if before != now:
                        undo_stack.append({'kind': 'word', 'unit': str(data['unit']), 'en': str(data['en']), 'before': before})
                    return self.send_json(200, {'ok': True, 'current': now, 'undo': len(undo_stack)})
                if path == '/api/undo':
                    if not undo_stack:
                        raise ValueError('Nichts zum Rückgängigmachen')
                    last = undo_stack.pop()
                    if last['kind'] == 'tr':
                        _, now = set_tr(last['lang'], last['key'], last['before'])
                        return self.send_json(200, {'ok': True, 'kind': 'tr', 'lang': last['lang'], 'key': last['key'],
                                                    'current': now, 'undo': len(undo_stack)})
                    _, now = set_word(last['unit'], last['en'], last['before'])
                    return self.send_json(200, {'ok': True, 'kind': 'word', 'unit': last['unit'], 'en': last['en'],
                                                'current': now, 'undo': len(undo_stack)})
                if path == '/api/translate':
                    lang, key = str(data.get('lang')), str(data.get('key'))
                    if '|' not in key or len(key) > 300:
                        raise ValueError('Ungültiger Schlüssel')
                    before, now = set_tr(lang, key, [clean_text(data.get('text'), 'Übersetzung'), 1])
                    if before != now:
                        undo_stack.append({'kind': 'tr', 'lang': lang, 'key': key, 'before': before})
                    return self.send_json(200, {'ok': True, 'current': now, 'undo': len(undo_stack)})
                if path == '/api/pin':
                    set_pin(str(data.get('pin', '')))
                    return self.send_json(200, {'ok': True})
            self.send_json(404, {'error': 'unbekannt'})
        except (ValueError, json.JSONDecodeError) as e:
            self.send_json(400, {'error': str(e)})


def main():
    for p in list(unit_files().values()) + sorted(I18N.glob('*.js')):
        snapshot[p] = p.read_text(encoding='utf-8')
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        raise SystemExit('Port %d ist belegt – läuft die App schon? Dann einfach http://localhost:%d öffnen.' % (PORT, PORT))
    url = 'http://localhost:%d' % PORT
    print('\n🧑‍🏫  English Games – Lehrkraft-Modus\n    %s\n    Beenden mit Strg+C (oder Fenster schließen).\n' % url)
    if not os.environ.get('EG_NO_BROWSER'):
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nBeendet.')


if __name__ == '__main__':
    main()
