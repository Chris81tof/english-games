// Oberfläche: Jahrgang → Unit → Niveau → Spiel → Modus → Spiel. Plus Einstellungen.
(() => {
  const { h } = EG;
  const root = document.getElementById('app');
  const sel = { year: null, unit: null, level: null, game: null };
  const PALETTE = ['c-mustard', 'c-blue', 'c-pink', 'c-red', 'c-green'];
  const pal = (i) => PALETTE[i % PALETTE.length];

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

  function crumbs() {
    const parts = [];
    if (sel.year) parts.push('📚 Jahrgang ' + sel.year);
    if (sel.unit) parts.push('🔖 ' + sel.unit.title);
    if (sel.level) parts.push(`${sel.level.stars} ${sel.level.name}`);
    return h('div', { class: 'crumbs' }, parts.map((p) => h('span', { class: 'chip' }, p)));
  }

  function tile({ cls, icon, title, sub, onclick, disabled }) {
    return h('button', { class: 'tile ' + cls, type: 'button', disabled, onclick: () => { EG.sound('click'); onclick && onclick(); } },
      h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'tile-title' }, title),
      sub ? h('span', { class: 'tile-sub' }, sub) : null);
  }

  // 1) Jahrgang
  function showYears() {
    Object.assign(sel, { year: null, unit: null, level: null, game: null });
    screen(
      topbar({ title: 'English Games' }),
      h('h2', { class: 'step' }, 'Welcher Jahrgang?'),
      h('div', { class: 'grid grid-3' }, EG.years.map((y, i) =>
        tile({ cls: pal(i), icon: String(y), title: 'Klasse ' + y,
          sub: EG.units.filter((u) => u.year === y).length + ' Unit(s)', onclick: () => { sel.year = y; showUnits(); } }))),
    );
  }

  // 2) Unit
  function showUnits() {
    sel.unit = sel.level = sel.game = null;
    const units = EG.units.filter((u) => u.year === sel.year);
    screen(
      topbar({ title: 'Unit wählen', back: showYears }), crumbs(),
      units.length
        ? h('div', { class: 'grid grid-3' }, units.map((u, i) =>
            tile({ cls: pal(i), icon: '📖', title: u.title, sub: u.book || '', onclick: () => { sel.unit = u; showLevels(); } })))
        : h('p', { class: 'empty card' }, '📭 Für diesen Jahrgang gibt es noch keine Units. Lege eine Datei in data/units/ an.'),
    );
  }

  // 3) Niveau
  function showLevels() {
    sel.level = sel.game = null;
    screen(
      topbar({ title: 'Niveau wählen', back: showUnits }), crumbs(),
      h('div', { class: 'grid grid-3' }, EG.levels.map((l, i) =>
        tile({ cls: ['c-green', 'c-mustard', 'c-red'][i], icon: l.stars, title: `${l.name} · ${l.title}`, sub: l.desc,
          onclick: () => { sel.level = l; showGames(); } }))),
    );
  }

  // 4) Spiel
  function showGames() {
    sel.game = null;
    const games = EG.games.filter((g) => EG.store.isGameOn(sel.year, g.id));
    screen(
      topbar({ title: 'Spiel wählen', back: showLevels }), crumbs(),
      games.length
        ? h('div', { class: 'grid grid-3' }, games.map((g, i) =>
            tile({ cls: pal(i), icon: g.emoji, title: g.name, sub: g.tagline, onclick: () => { sel.game = g; showModes(); } })))
        : h('p', { class: 'empty card' }, '⚙️ Für diesen Jahrgang sind alle Spiele abgehakt. Bitte in den Einstellungen aktivieren.'),
    );
  }

  // 5) Modus
  function showModes() {
    screen(
      topbar({ title: sel.game.emoji + ' ' + sel.game.name, back: showGames }), crumbs(),
      h('h2', { class: 'step' }, 'Wer spielt?'),
      h('div', { class: 'grid grid-3' }, EG.modes.map((m, i) =>
        tile({ cls: pal(i + 1), icon: m.icon, title: m.name, sub: m.desc, onclick: () => play(m) }))),
    );
  }

  // 6) Spielen
  function play(mode) {
    const board = EG.createScoreboard(mode);
    const stage = h('main', { class: 'stage' });
    const ctx = {
      el: stage, mode, board, year: sel.year, unit: sel.unit, level: sel.level.id,
      exit: showGames,
      restart: () => play(mode),
    };
    screen(
      topbar({ title: sel.game.emoji + ' ' + sel.game.name, back: showModes,
        extra: h('span', { class: 'chip chip-level' }, `${sel.level.stars} ${sel.level.name}`) }),
      board.el, stage,
    );
    sel.game.mount(ctx);
  }

  // Einstellungen: Spiele je Jahrgang an-/abhaken
  function showSettings() {
    const prev = { ...sel };
    const back = () => { Object.assign(sel, prev); showYears(); };
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
