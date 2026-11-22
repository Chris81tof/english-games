// Memory – Karten umdrehen, Wort und Bild/Übersetzung zusammenfinden.
// Paare je höchstem gewähltem Niveau: N1 6, N2 8, N3 10 (mehr Paare = schwerer).
// Die Bildkarte zeigt immer das Emoji; bei Niveau 1 des Worts zusätzlich die Übersetzung.
// Bei „Ganze Klasse“ zählt jeder Treffer für die Klasse; bei Spieler/Teams ist bei einem Fehlversuch die andere Seite dran.
EG.registerGame({
  id: 'memory',
  name: 'Memory',
  emoji: '🧠',
  get tagline() { return EG.t('tag.memory'); },
  description: 'Flip the cards and find word and picture!',
  minWords: 6,

  mount(ctx) {
    const { el, words, maxLevel, mode, board } = ctx;
    const h = EG.h;
    const PAIRS = { 1: 6, 2: 8, 3: 10 }[maxLevel];

    const pool = words.filter((w) => w.emoji);
    if (pool.length < PAIRS) { el.append(h('p', {}, EG.t('mem.none'))); return; }
    const chosen = EG.shuffle(pool).slice(0, PAIRS);
    const cards = EG.shuffle(chosen.flatMap((w) => [{ w, kind: 'word' }, { w, kind: 'pic' }]));

    let faceUp = [], matched = 0, lock = false, turn = 0;
    const btns = [];
    const turnEl = h('div', { class: 'round-info' });
    const award = h('div', { class: 'award' });

    function side() { return mode.sides[turn % mode.sides.length]; }
    function sideId() { return mode.id === 'class' ? 'c' : side().id; }
    function paintTurn() {
      turnEl.textContent = mode.id === 'class' ? '' : EG.t('turn', { sym: side().sym, name: side().name });
    }

    function faceContent(c) {
      if (c.kind === 'word') return [h('span', { class: 'mem-word' }, c.w.en), EG.speakButton(c.w.en)];
      const parts = [h('span', { class: 'mem-emoji', 'aria-hidden': 'true' }, c.w.emoji)];
      if (c.w.level === 1) parts.push(h('span', { class: 'mem-de' }, EG.gloss(c.w)));
      return parts;
    }

    function flip(idx) {
      btns[idx].classList.add('up');
      btns[idx].replaceChildren(...faceContent(cards[idx]));
    }
    function unflip(idx) {
      btns[idx].classList.remove('up');
      btns[idx].replaceChildren(h('span', { class: 'mem-back', 'aria-hidden': 'true' }, '❔'));
    }

    function click(idx) {
      if (lock || btns[idx].disabled || faceUp.includes(idx)) return;
      EG.sound('click');
      flip(idx);
      faceUp.push(idx);
      if (faceUp.length < 2) return;
      lock = true;
      const [a, b] = faceUp;
      if (cards[a].w === cards[b].w) {
        EG.sound('right');
        board.add(sideId(), 1);
        [a, b].forEach((idx2) => { btns[idx2].disabled = true; btns[idx2].classList.add('matched'); });
        matched++;
        faceUp = []; lock = false;
        if (matched === PAIRS) return finish();
      } else {
        EG.sound('wrong');
        award.hidden = false;
        award.replaceChildren(h('button', { class: 'btn btn-big', type: 'button', onclick: () => {
          EG.sound('click');
          unflip(a); unflip(b);
          faceUp = []; lock = false;
          award.hidden = true; award.replaceChildren();
          if (mode.id !== 'class') { turn++; paintTurn(); }
        } }, EG.t('cont')));
      }
    }

    const grid = h('div', { class: 'mem-grid' }, cards.map((c, idx) => {
      const btn = h('button', { class: 'mem-card', type: 'button', 'aria-label': 'card', onclick: () => click(idx) },
        h('span', { class: 'mem-back', 'aria-hidden': 'true' }, '❔'));
      btns[idx] = btn;
      return btn;
    }));

    function finish() {
      EG.sound('win');
      el.replaceChildren(
        h('div', { class: 'card end-card' },
          h('div', { class: 'end-emoji' }, '🏆'),
          h('h2', {}, EG.resultText(board)),
          h('div', { class: 'row' },
            h('button', { class: 'btn btn-big', type: 'button', onclick: ctx.restart }, EG.t('end.again')),
            h('button', { class: 'btn btn-plain btn-big', type: 'button', onclick: ctx.exit }, EG.t('end.menu')))));
    }

    paintTurn();
    award.hidden = true;
    el.append(turnEl, grid, award);
  },
});
