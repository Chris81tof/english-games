// Oberfläche: Jahrgang → Auswahl (Units, Abschnitte, Niveaus) → Spiel → Modus → Spiel. Plus Einstellungen.
(() => {
  const { h } = EG;
  const root = document.getElementById('app');
  // flow.state = { units: { unitId: [sectionId, …] }, levels: [1,2,3] } – wird je Jahrgang gemerkt
  const flow = { year: null, state: null, words: [], game: null };
  const PALETTE = ['c-mustard', 'c-blue', 'c-pink', 'c-red', 'c-green'];
  const pal = (i) => PALETTE[i % PALETTE.length];
  let current = () => showYears(); // aktuelle Ansicht, wird beim Sprachwechsel neu gezeichnet

  // ---------- Auswahl: Daten ----------
  const unitsOf = (year) => EG.units.filter((u) => u.year === year);
  const sectionsOf = (u) => {
    if (!u.sections) return [{ id: 'all', name: 'Alle Wörter' }];
    const used = new Set(u.words.map((w) => w.section));
    return u.sections.filter((s) => used.has(s.id)); // fehlende Abschnitte nicht anzeigen
  };
  const defaultState = (year) => ({
    units: Object.fromEntries(unitsOf(year).map((u) => [u.id, sectionsOf(u).map((s) => s.id)])),
    levels: EG.levels.map((l) => l.id),
  });
  function loadState(year) {
    const saved = EG.store.getSel(year);
    if (!saved) return defaultState(year);
    const state = { units: {}, levels: (saved.levels || []).filter((l) => EG.levels.some((x) => x.id === l)) };
    unitsOf(year).forEach((u) => {
      const valid = sectionsOf(u).map((s) => s.id);
      const chosen = ((saved.units || {})[u.id] || []).filter((id) => valid.includes(id));
      if (chosen.length) state.units[u.id] = chosen;
    });
    if (!state.levels.length) state.levels = EG.levels.map((l) => l.id);
    return state;
  }
  const wordsFor = (year, state) => unitsOf(year)
    .filter((u) => state.units[u.id])
    .flatMap((u) => u.words
      .filter((w) => state.units[u.id].includes(w.section || 'all') && state.levels.includes(w.level))
      .map((w) => ({ ...w, unitId: u.id, unitTitle: u.title })));

  // ---------- Bausteine ----------
  function muteButton() {
    const b = h('button', { class: 'btn-icon', type: 'button', onclick: () => {
      EG.store.setMuted(!EG.store.isMuted());
      if (EG.store.isMuted() && window.speechSynthesis) speechSynthesis.cancel();
      paint(); if (!EG.store.isMuted()) EG.sound('click');
    } });
    paint();
    function paint() {
      const m = EG.store.isMuted();
      b.textContent = m ? '🔇' : '🔊';
      b.setAttribute('aria-label', m ? EG.t('mute.off') : EG.t('mute.on'));
      b.title = m ? EG.t('mute.offT') : EG.t('mute.onT');
    }
    return b;
  }

  // Globus mit Kürzel der aktiven Sprache; Klick öffnet die Liste (jede Sprache in ihrer Schrift)
  function langButton() {
    const info = EG.langInfo();
    let list = null;
    const btn = h('button', { class: 'btn btn-plain lang-btn', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false',
      'aria-label': EG.t('lang.choose') + ': ' + info.name, title: EG.t('lang.choose'), onclick: () => (list ? close() : open()) },
      h('span', { 'aria-hidden': 'true' }, '🌐'), h('span', { class: 'lang-code' }, info.code));
    const wrap = h('div', { class: 'lang-wrap' }, btn);
    const outside = (e) => { if (!wrap.contains(e.target)) close(); };
    const esc = (e) => { if (e.key === 'Escape') { close(); btn.focus(); } };
    function close() {
      if (!list) return;
      list.remove(); list = null; btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', esc);
    }
    function open() {
      list = h('div', { class: 'lang-list', role: 'menu', 'aria-label': EG.t('lang.choose') }, EG.availableLanguages().map((l) =>
        h('button', { type: 'button', role: 'menuitemradio', 'aria-checked': String(l.id === info.id), class: l.id === info.id ? 'on' : '',
          lang: l.id === 'bhs' ? 'sh' : l.id, dir: l.dir || 'ltr', onclick: () => {
            close();
            if (l.id === info.id) return;
            EG.store.setLang(l.id); EG.applyLang(); current();
          } },
          h('span', { class: 'lang-mark', 'aria-hidden': 'true' }, l.id === info.id ? '✓' : ''),
          h('span', { class: 'lang-name' }, l.name), h('span', { class: 'lang-code' }, l.code))));
      wrap.append(list); btn.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', esc);
      (list.querySelector('.on') || list.querySelector('button')).focus();
    }
    return wrap;
  }

  function topbar({ title, back, extra }) {
    return h('header', { class: 'topbar' },
      back ? h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { EG.sound('click'); back(); } }, EG.t('back')) : h('span'),
      h('h1', {}, title),
      h('div', { class: 'topbar-right' }, app.teacher ? h('span', { class: 'chip chip-teacher' }, '🧑‍🏫 Lehrkraft-Modus') : null, extra, langButton(), muteButton(), settingsButton()),
    );
  }

  function screen(...kids) {
    root.replaceChildren(h('div', { class: 'screen' }, kids, h('div', { class: 'deco', 'aria-hidden': 'true' })));
    window.scrollTo(0, 0);
  }

  const levelsLabel = (levels) => levels.slice().sort().map((l) => 'N' + l).join(' + ');

  function crumbs() {
    const parts = [];
    if (flow.year) parts.push(EG.t('crumb.class', { n: flow.year }));
    if (flow.state) {
      const ids = Object.keys(flow.state.units);
      const secs = ids.reduce((n, id) => n + flow.state.units[id].length, 0);
      parts.push(EG.t('crumb.units', { u: ids.length, s: secs }));
      parts.push('★ ' + levelsLabel(flow.state.levels));
      parts.push(EG.t('crumb.words', { n: flow.words.length }));
    }
    return h('div', { class: 'crumbs' }, parts.map((p) => h('span', { class: 'chip' }, p)));
  }

  function tile({ cls, icon, title, sub, onclick, disabled }) {
    return h('button', { class: 'tile ' + cls, type: 'button', disabled, onclick: () => { EG.sound('click'); onclick && onclick(); } },
      h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'tile-title' }, title),
      sub ? h('span', { class: 'tile-sub' }, sub) : null);
  }

  // Ankreuzfeld als Knopf: echtes Kontrollkästchen, Haken im Kästchen (nicht nur Farbe)
  function opt(checked, label, onchange, cls = '') {
    const input = h('input', { type: 'checkbox' });
    input.checked = checked;
    input.addEventListener('change', () => { EG.sound('click'); onchange(input.checked); });
    return h('label', { class: 'opt ' + cls + (checked ? ' on' : '') }, input,
      h('span', { class: 'box', 'aria-hidden': 'true' }), h('span', { class: 'opt-label' }, label));
  }

  // 1) Jahrgang
  function showYears() {
    current = showYears;
    Object.assign(flow, { year: null, state: null, words: [], game: null });
    screen(
      topbar({ title: 'English Games' }),
      h('h2', { class: 'step' }, EG.t('whichClass')),
      h('div', { class: 'grid grid-3' }, EG.years.map((y, i) =>
        tile({ cls: pal(i), icon: String(y), title: EG.t('classN', { n: y }),
          sub: EG.t('unitsN', { n: unitsOf(y).length }), onclick: () => { flow.year = y; flow.state = loadState(y); showSelect(); } }))),
    );
  }

  // 2) Auswahl: Units, Abschnitte, Niveaus
  function showSelect() {
    current = showSelect;
    const year = flow.year;
    const units = unitsOf(year);
    const state = flow.state;
    const body = h('div', { class: 'select' });
    const foot = h('div', { class: 'select-foot' });

    const commit = () => { EG.store.setSel(year, state); flow.words = wordsFor(year, state); render(); };

    function render() {
      flow.words = wordsFor(year, state);

      const levelRow = h('div', { class: 'card' },
        h('h2', { class: 'step' }, EG.t('select.levels')),
        h('div', { class: 'opts' }, EG.levels.map((l) => opt(state.levels.includes(l.id), `${l.stars} ${l.name} · ${l.title}`, (on) => {
          const set = new Set(state.levels); on ? set.add(l.id) : set.delete(l.id);
          if (set.size) state.levels = [...set].sort(); // mindestens ein Niveau bleibt gewählt
          commit();
        }))),
        h('p', { class: 'hint-line' }, EG.t('select.levelHint')));

      const unitCards = units.map((u) => {
        const secs = sectionsOf(u);
        const chosen = state.units[u.id];
        const countIn = (sid) => u.words.filter((w) => (w.section || 'all') === sid && state.levels.includes(w.level)).length;
        return h('div', { class: 'card unit-card' },
          h('div', { class: 'unit-head' },
            opt(!!chosen, [h('strong', {}, '📖 ' + u.title), u.book ? ' · ' + u.book : ''], (on) => {
              if (on) state.units[u.id] = secs.map((s) => s.id); else delete state.units[u.id];
              commit();
            }, 'opt-unit'),
            h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { EG.sound('click'); state.units[u.id] = secs.map((s) => s.id); commit(); } }, EG.t('select.all'))),
          chosen && u.sections ? h('div', { class: 'opts sections' }, secs.map((s) =>
            opt(chosen.includes(s.id), `${s.name} (${countIn(s.id)})`, (on) => {
              const set = new Set(chosen); on ? set.add(s.id) : set.delete(s.id);
              if (set.size) state.units[u.id] = secs.map((x) => x.id).filter((id) => set.has(id)); else delete state.units[u.id];
              commit();
            }))) : null);
      });

      body.replaceChildren(
        h('h2', { class: 'step' }, EG.t('select.units')),
        ...(units.length ? unitCards : [h('p', { class: 'empty card' }, EG.t('select.noUnits'))]),
        levelRow);

      const n = flow.words.length;
      foot.replaceChildren(
        h('span', { class: 'foot-count' }, n ? EG.t('select.count', { n }) : EG.t('select.none')),
        h('div', { class: 'foot-btns' },
          h('button', { class: 'btn btn-plain btn-big', type: 'button', onclick: () => { EG.sound('click'); showWords(); } }, EG.t('select.viewWords')),
          h('button', { class: 'btn btn-big', type: 'button', onclick: () => { EG.sound('click'); showGames(); } }, EG.t('next'))));
    }

    screen(topbar({ title: EG.t('select.title'), back: showYears }), h('div', { class: 'crumbs' }, h('span', { class: 'chip' }, EG.t('crumb.class', { n: year }))), body, foot);
    render();
  }

  // ---------- Lehrkraft-Modus (nur mit lokalem Server: tools/lehrkraft.py) ----------
  // Ohne den Server (z. B. GitHub Pages) ist die App im Schüler-Modus: Wortliste nur lesbar, Einstellungen mit PIN.
  const app = { teacher: false, undo: 0 };
  const api = (path, body) => fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: { 'X-EG': '1', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    .then((r) => r.json().catch(() => ({})).then((j) => { if (!r.ok || j.error) throw new Error(j.error || 'Fehler ' + r.status); return j; }));
  const FIELDS = ['de', 'emoji', 'level'];
  const findWord = (unitId, en) => { const u = EG.units.find((x) => x.id === unitId); return u && u.words.find((w) => w.en === en); };
  // Stand des letzten Commits für geänderte Übersetzungen: trOrig[lang][key] = [Text, geprüft] oder null (gab es nicht)
  const trOrig = {};
  const trCur = (lang, key) => (EG.translations[lang] || {})[key] || null;
  const trChanged = (lang, key) => {
    const o = (trOrig[lang] || {})[key];
    return o !== undefined && JSON.stringify(o) !== JSON.stringify(trCur(lang, key));
  };
  const isChanged = (w, lang = EG.contentLang()) => (!!w._orig && FIELDS.some((f) => w[f] !== w._orig[f])) || (lang !== 'de' && trChanged(lang, w._key));
  const changeCount = () => EG.units.reduce((sum, u) => sum + u.words.filter((w) => w._orig && FIELDS.some((f) => w[f] !== w._orig[f])).length, 0)
    + Object.keys(trOrig).reduce((sum, l) => sum + Object.keys(trOrig[l]).filter((k) => trChanged(l, k)).length, 0);

  async function detectMode() {
    EG.units.forEach((u) => u.words.forEach((w) => { w._orig = { de: w.de, emoji: w.emoji, level: w.level }; }));
    try {
      const r = await fetch('/api/ping', { cache: 'no-store', headers: { 'X-EG': '1' } });
      if (!r.ok || !(await r.json()).teacher) return;
      const c = await api('/api/changes');
      c.changes.forEach((ch) => { const w = findWord(ch.unit, ch.en); if (w) w._orig = ch.original; }); // Stand des letzten Commits
      (c.translations || []).forEach((t) => { (trOrig[t.lang] = trOrig[t.lang] || {})[t.key] = t.original; });
      app.teacher = true; app.undo = c.undo;
    } catch (e) { /* kein lokaler Server: Schüler-Modus */ }
  }

  function overlay(...kids) {
    const box = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'card dialog' }, kids));
    box.close = () => box.remove();
    root.append(box);
    return box;
  }
  const notice = (text) => { const o = overlay(h('p', {}, '🔒 ' + text), h('button', { class: 'btn btn-big', type: 'button', onclick: () => o.close() }, 'OK')); };
  const clock = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  // Einstellungen im Schüler-Modus: erst nach der PIN
  function askPin() {
    if (!EG.lock.hasPin()) return notice('Die Einstellungen sind gesperrt. Es ist noch keine PIN festgelegt.');
    if (EG.lock.lockedUntil()) return notice(`Zu viele falsche Eingaben. Gesperrt bis ${clock(EG.lock.lockedUntil())} Uhr.`);
    const msg = h('p', { class: 'dlg-msg', role: 'alert' });
    const input = h('input', { class: 'edit pin-input', type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4',
      autocomplete: 'off', 'aria-label': 'PIN mit 4 Ziffern' });
    const o = overlay(h('p', {}, '🔒 Bitte PIN eingeben'),
      h('form', { class: 'pin-form', onsubmit: (e) => {
        e.preventDefault();
        const res = EG.lock.verify(input.value);
        input.value = '';
        if (res.ok) { o.close(); showSettings(); return; }
        EG.sound('wrong');
        if (res.locked) { o.close(); notice(`Zu viele falsche Eingaben. Gesperrt bis ${clock(res.until)} Uhr.`); return; }
        msg.textContent = `✗ Falsche PIN. Noch ${res.left} Versuch(e).`;
        input.focus();
      } }, input,
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-big', type: 'submit' }, 'OK'),
          h('button', { class: 'btn btn-plain btn-big', type: 'button', onclick: () => o.close() }, 'Abbrechen'))),
      msg);
    input.focus();
  }

  // Zahnrad (Lehrkraft) oder Schloss (Schüler): 5× schnell tippen öffnet die PIN-Abfrage
  function settingsButton() {
    if (app.teacher) return h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Einstellungen', title: 'Einstellungen', onclick: showSettings }, '⚙️');
    let taps = [];
    return h('button', { class: 'btn-icon', type: 'button', 'aria-label': EG.t('locked'), title: EG.t('locked'), onclick: () => {
      const now = Date.now();
      taps = taps.filter((t) => now - t < 3000).concat(now);
      if (taps.length >= 5) { taps = []; askPin(); }
    } }, '🔒');
  }

  // Wortliste: alle ausgewählten Wörter als Tabelle, filter- und sortierbar.
  // Übersetzungsspalte in der Inhaltssprache (Englisch als Menüsprache → Deutsch).
  // Lehrkraft-Modus: Übersetzung, Emoji und Niveau direkt änderbar (wird sofort in die Dateien geschrieben).
  function showWords() {
    current = showWords;
    const editable = app.teacher;
    const L = EG.contentLang();
    const all = flow.words.map((w, idx) => {
      const unit = EG.units.find((u) => u.id === w.unitId);
      const secs = unit.sections || [];
      const sec = secs.find((s) => s.id === w.section);
      return { ...w, idx, unitTitle: unit.title, secName: sec ? sec.name : '–', secIdx: sec ? secs.indexOf(sec) : 0,
        unitIdx: EG.units.indexOf(unit) };
    });
    const glossOf = (w) => EG.glossInfo(findWord(w.unitId, w.en));
    const f = { level: '', unit: '', section: '' };
    let sort = { key: null, dir: 1 };
    const body = h('div', { class: 'wl' });
    const metaEl = h('div', { class: 'wl-count' });
    const errEl = h('p', { class: 'verdict v-trick', role: 'alert', hidden: true });
    const tableBox = h('div', { class: 'card wl-wrap' });
    const shown = h('div', { class: 'hint-line' });
    const filters = h('div', { class: 'wl-filters' });
    const undoBtn = h('button', { class: 'btn', type: 'button', onclick: async () => {
      try {
        const res = await api('/api/undo', {});
        if (res.kind === 'tr') {
          const map = EG.translations[res.lang] = EG.translations[res.lang] || {};
          if (res.current) map[res.key] = res.current; else delete map[res.key];
        } else {
          const src = findWord(res.unit, res.en);
          Object.assign(src, res.current);
          const row = all.find((r) => r.unitId === res.unit && r.en === res.en);
          if (row) Object.assign(row, res.current);
        }
        app.undo = res.undo; errEl.hidden = true; EG.sound('click'); render();
      } catch (e) { fail(e); }
    } }, '↶ Änderungen rückgängig');
    const fail = (e) => { errEl.textContent = '✗ Nicht gespeichert: ' + e.message + ' – läuft der Lehrkraft-Server noch?'; errEl.hidden = false; EG.sound('wrong'); };

    const COLS = [
      editable && { key: 'chg', label: '✎', nosort: true, title: 'Geändert' },
      { key: 'en', label: EG.t('col.en') }, { key: 'tr', label: EG.t('transName') }, { key: 'emoji', label: EG.t('col.emoji') },
      { key: 'level', label: EG.t('col.level') }, { key: 'unitIdx', label: EG.t('col.unit') }, { key: 'secIdx', label: EG.t('col.section') },
    ].filter(Boolean);
    const cmp = (a, b) => {
      const k = sort.key;
      const r = k === 'en' ? a.en.localeCompare(b.en, 'en', { sensitivity: 'base' })
        : k === 'tr' ? glossOf(a).text.localeCompare(glossOf(b).text, L === 'bhs' ? 'hr' : L, { sensitivity: 'base' })
        : k === 'emoji' ? String(a[k]).localeCompare(String(b[k])) : a[k] - b[k];
      return r || a.idx - b.idx; // bei Gleichstand: Reihenfolge der Datei
    };

    function select(label, value, options, onchange) {
      const sel = h('select', { onchange: (e) => { onchange(e.target.value); render(); } },
        h('option', { value: '' }, EG.t('select.all')), options.map((o) => h('option', { value: o.value }, o.label)));
      sel.value = value;
      return h('label', { class: 'filter' }, h('span', {}, label), sel);
    }

    function refreshMeta() {
      const n = editable ? changeCount() : 0;
      metaEl.textContent = EG.t('select.count', { n: all.length }) + (n ? ` · ✎ ${n} geändert (noch nicht veröffentlicht)` : '');
      undoBtn.disabled = !app.undo;
    }

    const sayBtn = (w) => h('button', { class: 'say', type: 'button', dir: 'ltr', 'aria-label': EG.t('readAloud', { w: w.en }), onclick: () => EG.speak(w.en) },
      h('span', { 'aria-hidden': 'true' }, '🔊 '), w.en);

    function rowEl(w) {
      const src = findWord(w.unitId, w.en);
      if (!editable) {
        return h('tr', {},
          h('td', {}, sayBtn(w)),
          h('td', {}, glossOf(w).text), h('td', { class: 'wl-emoji' }, w.emoji),
          h('td', {}, h('span', { class: 'lvl lvl-' + w.level }, 'N' + w.level)),
          h('td', {}, w.unitTitle), h('td', {}, w.secName));
      }
      const mark = h('td', { class: 'wl-chg' });
      const auto = h('span', { class: 'auto-mark', title: 'automatisch übersetzt', 'aria-label': 'automatisch übersetzt' }, '🤖');
      const tr = h('tr', {}, mark);
      const refresh = () => {
        const ch = isChanged(src, L);
        tr.classList.toggle('changed', ch);
        mark.textContent = ch ? '✎' : '';
        mark.title = ch ? 'Geändert' : '';
        mark.setAttribute('aria-label', ch ? 'Geändert' : '');
        auto.hidden = !glossOf(w).auto;
      };
      const save = async (field, value, revert) => {
        try {
          if (field === 'tr') {
            const prev = trCur(L, src._key);
            const res = await api('/api/translate', { lang: L, key: src._key, text: value });
            const base = trOrig[L] = trOrig[L] || {};
            if (base[src._key] === undefined) base[src._key] = prev; // erster Stand dieser Sitzung = letzter Commit
            (EG.translations[L] = EG.translations[L] || {})[src._key] = res.current;
            app.undo = res.undo;
          } else {
            if (value === src[field]) return;
            const res = await api('/api/edit', { unit: w.unitId, en: w.en, [field]: value });
            Object.assign(src, res.current); Object.assign(w, res.current);
            app.undo = res.undo;
          }
          errEl.hidden = true; refresh(); refreshMeta();
        } catch (e) { revert(); fail(e); }
      };
      const input = (cls, label, value, onSave) => {
        const inp = h('input', { class: 'edit ' + cls, type: 'text', 'aria-label': `${label} zu ${w.en}`, autocomplete: 'off', spellcheck: 'false' });
        inp.value = value();
        inp.addEventListener('change', () => {
          const v = inp.value.trim();
          if (!v) { inp.value = value(); return; }      // leer geht nicht: Wert bleibt
          onSave(v, () => (inp.value = value()));
        });
        return inp;
      };
      // Deutsch steht in der Unit-Datei, alle anderen Sprachen in data/i18n/<lang>.js (bearbeitet = geprüft)
      const trInput = L === 'de'
        ? input('edit-de', 'Deutsch', () => src.de, (v, rv) => save('de', v, rv))
        : input('edit-de', EG.t('transName'), () => glossOf(w).text, (v, rv) => {
          const cur = trCur(L, src._key);
          if (cur && cur[0] === v && cur[1]) return;
          save('tr', v, rv);
        });
      const lvl = h('select', { class: 'edit lvl-sel lvl-' + w.level, 'aria-label': 'Niveau zu ' + w.en },
        EG.levels.map((l) => h('option', { value: l.id }, l.name)));
      lvl.value = w.level;
      lvl.addEventListener('change', () => {
        lvl.className = 'edit lvl-sel lvl-' + lvl.value;
        save('level', +lvl.value, () => { lvl.value = src.level; lvl.className = 'edit lvl-sel lvl-' + src.level; });
      });

      tr.append(
        h('td', {}, sayBtn(w)),
        h('td', {}, h('div', { class: 'tr-cell' }, trInput, auto)),
        h('td', {}, input('edit-emoji', 'Emoji', () => src.emoji, (v, rv) => save('emoji', v, rv))),
        h('td', {}, lvl),
        h('td', {}, w.unitTitle),
        h('td', {}, w.secName));
      refresh();
      return tr;
    }

    function render() {
      const unitIds = [...new Set(all.map((w) => w.unitId))];
      const unitOpts = unitIds.map((id) => ({ value: id, label: all.find((w) => w.unitId === id).unitTitle }));
      const secPool = all.filter((w) => !f.unit || w.unitId === f.unit);
      const secOpts = [...new Map(secPool.map((w) => [w.unitId + '|' + w.section, { value: w.unitId + '|' + w.section,
        label: (f.unit ? '' : w.unitTitle.split(' – ')[0] + ' · ') + w.secName }])).values()];
      if (f.section && !secOpts.some((o) => o.value === f.section)) f.section = '';

      let rows = all.filter((w) => (!f.level || w.level === +f.level) && (!f.unit || w.unitId === f.unit)
        && (!f.section || w.unitId + '|' + w.section === f.section));
      if (sort.key) rows = rows.slice().sort((a, b) => sort.dir * cmp(a, b));

      const head = h('tr', {}, COLS.map((c) => {
        const active = sort.key === c.key;
        const th = h('th', { scope: 'col', title: c.title, 'aria-sort': active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none' });
        if (c.nosort) th.append(c.label);
        else th.append(h('button', { class: 'sort', type: 'button', onclick: () => {
          if (!active) sort = { key: c.key, dir: 1 }; else if (sort.dir === 1) sort.dir = -1; else sort = { key: null, dir: 1 };
          render();
        } }, c.label, h('span', { class: 'arrow', 'aria-hidden': 'true' }, active ? (sort.dir === 1 ? ' ▲' : ' ▼') : ' ↕')));
        return th;
      }));

      refreshMeta();
      tableBox.replaceChildren(rows.length
        ? h('table', { class: 'wl-table' }, h('thead', {}, head), h('tbody', {}, rows.map(rowEl)))
        : h('p', { class: 'empty' }, EG.t('wl.none')));
      shown.textContent = rows.length !== all.length ? EG.t('wl.shown', { r: rows.length, n: all.length }) : '';
      filters.replaceChildren(
        select(EG.t('col.level'), f.level, flow.state.levels.slice().sort().map((l) => ({ value: String(l), label: 'N' + l })), (v) => (f.level = v)),
        select(EG.t('col.unit'), f.unit, unitOpts, (v) => (f.unit = v)),
        select(EG.t('col.section'), f.section, secOpts, (v) => (f.section = v)),
        h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { f.level = f.unit = f.section = ''; sort = { key: null, dir: 1 }; render(); } }, EG.t('wl.reset')));
    }

    body.append(...[metaEl,
      editable
        ? h('p', { class: 'hint-line', dir: 'ltr', lang: 'de' }, `✏️ Übersetzung (${EG.langInfo(L).name}), Emoji und Niveau kannst du direkt ändern (Felder mit Rahmen). Englisch, Unit und Abschnitt sind gesperrt. Jede Änderung wird sofort in die Dateien geschrieben und gilt in allen Spielen. ✎ = noch nicht veröffentlicht, 🤖 = automatisch übersetzt (eine bearbeitete Übersetzung gilt als geprüft).`)
        : null,
      editable ? h('div', { class: 'wl-filters' }, undoBtn) : null,
      errEl, filters, shown, tableBox].filter(Boolean));

    screen(topbar({ title: EG.t('wl.title'), back: showSelect }), crumbs(), body);
    render();
  }

  // 3) Spiel
  function showGames() {
    current = showGames;
    flow.game = null;
    const games = EG.games.filter((g) => EG.store.isGameOn(flow.year, g.id));
    const n = flow.words.length;
    screen(
      topbar({ title: EG.t('games.title'), back: showSelect }), crumbs(),
      games.length
        ? h('div', { class: 'grid grid-3' }, games.map((g, i) => {
            const few = g.minWords && n < g.minWords;
            return tile({ cls: few ? 'c-off' : pal(i), icon: g.emoji, title: g.name,
              sub: few ? EG.t('games.few', { n, m: g.minWords }) : g.tagline,
              disabled: few, onclick: () => { flow.game = g; showModes(); } });
          }))
        : h('p', { class: 'empty card' }, EG.t('games.allOff')),
    );
  }

  // 4) Modus
  function showModes() {
    current = showModes;
    screen(
      topbar({ title: flow.game.emoji + ' ' + flow.game.name, back: showGames }), crumbs(),
      h('h2', { class: 'step' }, EG.t('modes.who')),
      h('div', { class: 'grid grid-3' }, EG.modes.filter((m) => !flow.game.modes || flow.game.modes.includes(m.id)).map((m, i) =>
        tile({ cls: pal(i + 1), icon: m.icon, title: m.name, sub: m.desc, onclick: () => play(m) }))),
    );
  }

  // 5) Spielen
  function play(mode) {
    current = () => play(mode); // Sprachwechsel im Spiel startet es neu
    const board = EG.createScoreboard(mode);
    const stage = h('main', { class: 'stage' });
    const levels = flow.state.levels;
    const ctx = {
      el: stage, mode, board, year: flow.year,
      words: flow.words,                 // alle Wörter der Auswahl, je Wort mit eigenem level/section
      levels, maxLevel: Math.max(...levels),
      exit: showGames,
      restart: () => play(mode),
    };
    screen(
      topbar({ title: flow.game.emoji + ' ' + flow.game.name, back: showModes,
        extra: h('span', { class: 'chip chip-level' }, '★ ' + levelsLabel(levels)) }),
      board.el, stage,
    );
    flow.game.mount(ctx);
  }

  // Nur Lehrkraft-Modus: PIN für den Schüler-Modus festlegen (wird nur als Hash in data/pin.js gespeichert)
  function pinCard() {
    const msg = h('p', { class: 'hint-line', role: 'status' }, EG.lock.hasPin() ? '✓ Es ist eine PIN festgelegt.' : '⚠️ Noch keine PIN festgelegt – im Schüler-Modus bleiben die Einstellungen dann gesperrt.');
    const field = (label) => h('input', { class: 'edit pin-input', type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', autocomplete: 'off', 'aria-label': label, placeholder: '••••' });
    const first = field('Neue PIN mit 4 Ziffern'), second = field('PIN wiederholen');
    return h('div', { class: 'card pin-card' },
      h('h2', { class: 'step' }, '🔒 PIN festlegen (Schüler-Modus)'),
      h('form', { class: 'pin-form', onsubmit: async (e) => {
        e.preventDefault();
        const clear = () => { first.value = ''; second.value = ''; };
        if (!/^\d{4}$/.test(first.value)) { msg.textContent = '✗ Die PIN muss aus genau 4 Ziffern bestehen.'; return; }
        if (first.value !== second.value) { msg.textContent = '✗ Die beiden Eingaben stimmen nicht überein.'; second.value = ''; second.focus(); return; }
        try {
          await api('/api/pin', { pin: first.value });
          clear();
          msg.textContent = '✓ PIN gespeichert (nur als Hash in data/pin.js). Zum Veröffentlichen bitte committen und pushen.';
        } catch (err) { clear(); msg.textContent = '✗ ' + err.message; }
      } },
        h('label', { class: 'filter' }, h('span', {}, 'Neue PIN'), first),
        h('label', { class: 'filter' }, h('span', {}, 'PIN wiederholen'), second),
        h('button', { class: 'btn', type: 'submit' }, 'PIN speichern')),
      msg);
  }

  // Einstellungen: Spiele je Jahrgang an-/abhaken
  function showSettings() {
    current = showSettings;
    const prev = { ...flow };
    const back = () => { Object.assign(flow, prev); showYears(); };
    screen(
      topbar({ title: '⚙️ Einstellungen', back }),
      h('p', { class: 'hint-line' }, 'Hake pro Jahrgang an, welche Spiele angezeigt werden. Gespeichert wird nur auf diesem Gerät.'),
      app.teacher ? pinCard() : null,
      h('div', { class: 'settings card' },
        h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Spiel'), EG.years.map((y) => h('th', {}, 'Kl. ' + y)))),
          h('tbody', {}, EG.games.map((g) => h('tr', {},
            h('th', { scope: 'row' }, g.emoji + ' ' + g.name),
            EG.years.map((y) => h('td', {}, h('label', { class: 'check' },
              h('input', { type: 'checkbox', checked: EG.store.isGameOn(y, g.id), 'aria-label': `${g.name} in Klasse ${y}`,
                onchange: (e) => EG.store.setGameOn(y, g.id, e.target.checked) }),
              h('span', { class: 'box', 'aria-hidden': 'true' })))))))),
      ),
    );
    // checked als Property setzen (Attribut allein reicht nicht bei false)
    root.querySelectorAll('input[type=checkbox]').forEach((inp, idx) => {
      const g = EG.games[Math.floor(idx / EG.years.length)], y = EG.years[idx % EG.years.length];
      inp.checked = EG.store.isGameOn(y, g.id);
    });
  }

  EG.assignKeys();
  EG.applyLang();
  detectMode().then(showYears);
})();
