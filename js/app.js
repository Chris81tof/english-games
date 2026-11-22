// Oberfläche: Jahrgang → Auswahl (Units, Abschnitte, Niveaus) → Spiel → Modus → Spiel. Plus Einstellungen.
(() => {
  const { h } = EG;
  const root = document.getElementById('app');
  // flow.state = { units: { unitId: [sectionId, …] }, levels: [1,2,3] } – wird je Jahrgang gemerkt
  const flow = { year: null, state: null, words: [], game: null };
  const PALETTE = ['c-mustard', 'c-blue', 'c-pink', 'c-red', 'c-green'];
  const pal = (i) => PALETTE[i % PALETTE.length];

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
      b.setAttribute('aria-label', m ? 'Ton ist aus. Einschalten' : 'Ton ist an. Ausschalten');
      b.title = m ? 'Ton ist aus' : 'Ton ist an';
    }
    return b;
  }

  function topbar({ title, back, extra }) {
    return h('header', { class: 'topbar' },
      back ? h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { EG.sound('click'); back(); } }, '← Zurück') : h('span'),
      h('h1', {}, title),
      h('div', { class: 'topbar-right' }, extra, muteButton(),
        h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Einstellungen', title: 'Einstellungen', onclick: showSettings }, '⚙️')),
    );
  }

  function screen(...kids) {
    root.replaceChildren(h('div', { class: 'screen' }, kids, h('div', { class: 'deco', 'aria-hidden': 'true' })));
    window.scrollTo(0, 0);
  }

  const levelsLabel = (levels) => levels.slice().sort().map((l) => 'N' + l).join(' + ');

  function crumbs() {
    const parts = [];
    if (flow.year) parts.push('📚 Jahrgang ' + flow.year);
    if (flow.state) {
      const ids = Object.keys(flow.state.units);
      const secs = ids.reduce((n, id) => n + flow.state.units[id].length, 0);
      parts.push(`🔖 ${ids.length} Unit(s) · ${secs} Abschnitt(e)`);
      parts.push('★ ' + levelsLabel(flow.state.levels));
      parts.push(`🔤 ${flow.words.length} Wörter`);
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
    Object.assign(flow, { year: null, state: null, words: [], game: null });
    screen(
      topbar({ title: 'English Games' }),
      h('h2', { class: 'step' }, 'Welcher Jahrgang?'),
      h('div', { class: 'grid grid-3' }, EG.years.map((y, i) =>
        tile({ cls: pal(i), icon: String(y), title: 'Klasse ' + y,
          sub: unitsOf(y).length + ' Unit(s)', onclick: () => { flow.year = y; flow.state = loadState(y); showSelect(); } }))),
    );
  }

  // 2) Auswahl: Units, Abschnitte, Niveaus
  function showSelect() {
    const year = flow.year;
    const units = unitsOf(year);
    const state = flow.state;
    const body = h('div', { class: 'select' });
    const foot = h('div', { class: 'select-foot' });

    const commit = () => { EG.store.setSel(year, state); flow.words = wordsFor(year, state); render(); };

    function render() {
      flow.words = wordsFor(year, state);

      const levelRow = h('div', { class: 'card' },
        h('h2', { class: 'step' }, '★ Niveaus'),
        h('div', { class: 'opts' }, EG.levels.map((l) => opt(state.levels.includes(l.id), `${l.stars} ${l.name} · ${l.title}`, (on) => {
          const set = new Set(state.levels); on ? set.add(l.id) : set.delete(l.id);
          if (set.size) state.levels = [...set].sort(); // mindestens ein Niveau bleibt gewählt
          commit();
        }))),
        h('p', { class: 'hint-line' }, 'Die Hilfen (Emoji, Deutsch) richten sich nach dem Niveau des einzelnen Wortes.'));

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
            h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { EG.sound('click'); state.units[u.id] = secs.map((s) => s.id); commit(); } }, 'alle')),
          chosen && u.sections ? h('div', { class: 'opts sections' }, secs.map((s) =>
            opt(chosen.includes(s.id), `${s.name} (${countIn(s.id)})`, (on) => {
              const set = new Set(chosen); on ? set.add(s.id) : set.delete(s.id);
              if (set.size) state.units[u.id] = secs.map((x) => x.id).filter((id) => set.has(id)); else delete state.units[u.id];
              commit();
            }))) : null);
      });

      body.replaceChildren(
        h('h2', { class: 'step' }, '📖 Units und Abschnitte'),
        ...(units.length ? unitCards : [h('p', { class: 'empty card' }, '📭 Für diesen Jahrgang gibt es noch keine Units. Lege eine Datei in data/units/ an.')]),
        levelRow);

      const n = flow.words.length;
      foot.replaceChildren(
        h('span', { class: 'foot-count' }, n ? `🔤 ${n} Wörter ausgewählt` : '⚠️ Keine Wörter ausgewählt – bitte Unit und Niveau ankreuzen.'),
        h('div', { class: 'foot-btns' },
          h('button', { class: 'btn btn-plain btn-big', type: 'button', onclick: () => { EG.sound('click'); showWords(); } }, '📋 Wörter ansehen'),
          h('button', { class: 'btn btn-big', type: 'button', onclick: () => { EG.sound('click'); showGames(); } }, 'Weiter →')));
    }

    screen(topbar({ title: 'Auswahl', back: showYears }), h('div', { class: 'crumbs' }, h('span', { class: 'chip' }, '📚 Jahrgang ' + year)), body, foot);
    render();
  }

  // Wortliste: alle ausgewählten Wörter als Tabelle, filter- und sortierbar
  function showWords() {
    const all = flow.words.map((w, idx) => {
      const unit = EG.units.find((u) => u.id === w.unitId);
      const secs = unit.sections || [];
      const sec = secs.find((s) => s.id === w.section);
      return { ...w, idx, unitTitle: unit.title, secName: sec ? sec.name : '–', secIdx: sec ? secs.indexOf(sec) : 0,
        unitIdx: EG.units.indexOf(unit) };
    });
    const f = { level: '', unit: '', section: '' };
    let sort = { key: null, dir: 1 };
    const body = h('div', { class: 'wl' });

    const COLS = [
      { key: 'en', label: 'Englisch' }, { key: 'de', label: 'Deutsch' }, { key: 'emoji', label: 'Emoji', nosort: true },
      { key: 'level', label: 'Niveau' }, { key: 'unitIdx', label: 'Unit' }, { key: 'secIdx', label: 'Abschnitt' },
    ];
    const cmp = (a, b) => {
      const k = sort.key;
      const r = (k === 'en' || k === 'de') ? a[k].localeCompare(b[k], k === 'de' ? 'de' : 'en', { sensitivity: 'base' }) : a[k] - b[k];
      return r || a.idx - b.idx; // bei Gleichstand: Reihenfolge der Datei
    };

    function select(label, value, options, onchange) {
      const sel = h('select', { onchange: (e) => { onchange(e.target.value); render(); } },
        h('option', { value: '' }, 'alle'), options.map((o) => h('option', { value: o.value }, o.label)));
      sel.value = value;
      return h('label', { class: 'filter' }, h('span', {}, label), sel);
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
        const th = h('th', { scope: 'col', 'aria-sort': active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none' });
        if (c.nosort) th.append(c.label);
        else th.append(h('button', { class: 'sort', type: 'button', onclick: () => {
          if (!active) sort = { key: c.key, dir: 1 }; else if (sort.dir === 1) sort.dir = -1; else sort = { key: null, dir: 1 };
          render();
        } }, c.label, h('span', { class: 'arrow', 'aria-hidden': 'true' }, active ? (sort.dir === 1 ? ' ▲' : ' ▼') : ' ↕')));
        return th;
      }));

      body.replaceChildren(
        h('div', { class: 'wl-count' }, `🔤 ${all.length} Wörter ausgewählt`
          + (rows.length !== all.length ? ` · ${rows.length} angezeigt` : '')),
        h('div', { class: 'wl-filters' },
          select('Niveau', f.level, flow.state.levels.slice().sort().map((l) => ({ value: String(l), label: 'N' + l })), (v) => (f.level = v)),
          select('Unit', f.unit, unitOpts, (v) => (f.unit = v)),
          select('Abschnitt', f.section, secOpts, (v) => (f.section = v)),
          h('button', { class: 'btn btn-plain', type: 'button', onclick: () => { f.level = f.unit = f.section = ''; sort = { key: null, dir: 1 }; render(); } }, '↺ Zurücksetzen')),
        h('div', { class: 'card wl-wrap' }, rows.length
          ? h('table', { class: 'wl-table' }, h('thead', {}, head), h('tbody', {}, rows.map((w) => h('tr', {},
              h('td', {}, h('button', { class: 'say', type: 'button', 'aria-label': 'Vorlesen: ' + w.en, onclick: () => EG.speak(w.en) },
                h('span', { 'aria-hidden': 'true' }, '🔊 '), w.en)),
              h('td', {}, w.de),
              h('td', { class: 'wl-emoji', 'aria-label': 'Emoji' }, w.emoji),
              h('td', {}, h('span', { class: 'lvl lvl-' + w.level }, 'N' + w.level)),
              h('td', {}, w.unitTitle),
              h('td', {}, w.secName)))))
          : h('p', { class: 'empty' }, 'Keine Wörter für diese Filter.')));
    }

    screen(topbar({ title: '📋 Wortliste', back: showSelect }), crumbs(), body);
    render();
  }

  // 3) Spiel
  function showGames() {
    flow.game = null;
    const games = EG.games.filter((g) => EG.store.isGameOn(flow.year, g.id));
    const n = flow.words.length;
    screen(
      topbar({ title: 'Spiel wählen', back: showSelect }), crumbs(),
      games.length
        ? h('div', { class: 'grid grid-3' }, games.map((g, i) => {
            const few = g.minWords && n < g.minWords;
            return tile({ cls: few ? 'c-off' : pal(i), icon: g.emoji, title: g.name,
              sub: few ? `⚠️ Zu wenige Wörter (${n} von mind. ${g.minWords}). Bitte mehr Units, Abschnitte oder Niveaus wählen.` : g.tagline,
              disabled: few, onclick: () => { flow.game = g; showModes(); } });
          }))
        : h('p', { class: 'empty card' }, '⚙️ Für diesen Jahrgang sind alle Spiele abgehakt. Bitte in den Einstellungen aktivieren.'),
    );
  }

  // 4) Modus
  function showModes() {
    screen(
      topbar({ title: flow.game.emoji + ' ' + flow.game.name, back: showGames }), crumbs(),
      h('h2', { class: 'step' }, 'Wer spielt?'),
      h('div', { class: 'grid grid-3' }, EG.modes.filter((m) => !flow.game.modes || flow.game.modes.includes(m.id)).map((m, i) =>
        tile({ cls: pal(i + 1), icon: m.icon, title: m.name, sub: m.desc, onclick: () => play(m) }))),
    );
  }

  // 5) Spielen
  function play(mode) {
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

  // Einstellungen: Spiele je Jahrgang an-/abhaken
  function showSettings() {
    const prev = { ...flow };
    const back = () => { Object.assign(flow, prev); showYears(); };
    screen(
      topbar({ title: '⚙️ Einstellungen', back }),
      h('p', { class: 'hint-line' }, 'Hake pro Jahrgang an, welche Spiele angezeigt werden. Gespeichert wird nur auf diesem Gerät.'),
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

  showYears();
})();
