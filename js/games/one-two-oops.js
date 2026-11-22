// One, two, oops! – Reihum zählen, bei goldenen Zahlen "Oops!" sagen.
// Niveaus: N1 Vielfache von 5 bis 30, N2 Vielfache von 4 bis 30, N3 Vielfache von 3 oder 4 bis 50.
EG.registerGame({
  id: 'one-two-oops',
  name: 'One, two, oops!',
  emoji: '🙊',
  tagline: 'Count and say "oops"!',
  description: 'Zählt reihum – bei goldenen Zahlen heißt es „Oops!“',

  mount(ctx) {
    const { el, level, mode, board } = ctx;
    const h = EG.h;
    const cfg = { 1: { max: 30, ks: [5] }, 2: { max: 30, ks: [4] }, 3: { max: 50, ks: [3, 4] } }[level];
    const isOops = (n) => cfg.ks.some((k) => n % k === 0);
    const rule = cfg.ks.length > 1 ? 'Vielfache von ' + cfg.ks.join(' und ') : 'Vielfache von ' + cfg.ks[0];
    let n = 1, turn = 0, best = 0;

    const cells = [];
    const grid = h('div', { class: 'card oops-grid', role: 'list', 'aria-label': 'Zahlen 1 bis ' + cfg.max });
    for (let k = 1; k <= cfg.max; k++) {
      const c = h('span', { class: 'oops-cell' + (isOops(k) ? ' gold' : ''), role: 'listitem' }, String(k), isOops(k) ? h('small', {}, '🙊') : null);
      cells[k] = c; grid.append(c);
    }
    const big = h('div', { class: 'oops-big', 'aria-live': 'polite' });
    const who = h('div', { class: 'round-info' });
    const info = h('div', { class: 'hint-line' }, `🙊 Goldene Zahlen = „Oops!“ sagen (${rule}).`);

    function sideNow() { return mode.sides[turn % mode.sides.length]; }
    function paint() {
      cells.forEach((c, k) => c && c.classList.toggle('now', k === n));
      big.textContent = n;
      who.textContent = mode.id === 'class' ? 'Alle zusammen – höchste Zahl: ' + best : 'Dran: ' + sideNow().sym + ' ' + sideNow().name;
    }

    function ok() {
      EG.sound('right');
      board.add(sideNow().id, 1);
      best = Math.max(best, n);
      if (n >= cfg.max) return finish();
      n++; turn++; paint();
      EG.speak(isOops(n) ? 'oops' : String(n), true);
    }
    function mistake() {
      EG.sound('wrong');
      if (mode.id !== 'class') { // Gegenseite bekommt den Punkt
        const other = mode.sides[(turn + 1) % mode.sides.length];
        board.add(other.id, 1);
      }
      n = 1; turn = 0; paint();
    }
    function finish() {
      EG.sound('win');
      el.replaceChildren(h('div', { class: 'card end-card' },
        h('div', { class: 'end-emoji' }, '🏆'),
        h('h2', {}, 'Geschafft bis ' + cfg.max + '! ' + EG.resultText(board)),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-big', type: 'button', onclick: ctx.restart }, '↻ Nochmal'),
          h('button', { class: 'btn btn-plain btn-big', type: 'button', onclick: ctx.exit }, '☰ Spielauswahl'))));
    }

    el.append(info, grid, who, big,
      h('div', { class: 'award' },
        h('button', { class: 'btn btn-green btn-big', type: 'button', onclick: ok }, '✓ Richtig – weiter'),
        h('button', { class: 'btn btn-plain btn-big', type: 'button', onclick: mistake }, '✗ Fehler – von vorn')));
    paint();
  },
});
