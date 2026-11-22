// Slap the board – zwei Spieler/Teams tippen so schnell wie möglich auf die richtige Karte.
// Jede Seite hat ihre eigene Hälfte mit denselben Karten. Erster richtiger Tipp: +1, falscher Tipp: −1 und diese Seite ist für die Runde gesperrt.
// Hilfen nach dem Niveau des gesuchten Worts: N1 = deutsches Wort + Emoji auf den Karten, N2 = nur Vorlesen + Emoji, N3 = nur Vorlesen, Karten ohne Emoji.
// Ist der Ton aus, wird das deutsche Wort gezeigt, damit das Spiel spielbar bleibt.
EG.registerGame({
  id: 'slap-the-board',
  name: 'Slap the board',
  emoji: '👋',
  get tagline() { return EG.t('tag.slap'); },
  description: 'Wort hören oder lesen – zuerst die richtige Karte antippen!',
  minWords: 6,
  modes: ['players', 'teams'],

  mount(ctx) {
    const { el, words, mode, board } = ctx;
    const h = EG.h;
    const ROUNDS = 10, CARDS = 6;

    const withEmoji = words.filter((w) => w.emoji && w.en.length <= 20);
    const pool = withEmoji.length >= CARDS ? withEmoji : words;
    const targets = EG.shuffle(pool).slice(0, ROUNDS);
    let i = 0;

    function makeCards(t) {
      const others = EG.shuffle(pool.filter((w) => w.en !== t.en));
      const picked = [], seen = new Set([t.emoji]);
      for (const w of others) if (picked.length < CARDS - 1 && !seen.has(w.emoji)) { picked.push(w); seen.add(w.emoji); }
      for (const w of others) if (picked.length < CARDS - 1 && !picked.includes(w)) picked.push(w);
      return EG.shuffle([t, ...picked]);
    }

    function showRound() {
      const t = targets[i];
      const cards = makeCards(t);
      const lv = t.level;
      const muted = EG.store.isMuted();
      const showDe = lv === 1 || muted;
      let live = false, over = false;
      const locked = new Set();
      const timers = [];
      const later = (fn, ms) => timers.push(setTimeout(() => { if (el.isConnected) fn(); }, ms));
      el.replaceChildren();

      const prompt = h('div', { class: 'card slap-prompt', 'aria-live': 'polite' }, EG.t('slap.ready'));
      const verdict = h('div', { class: 'verdict' });
      const nextBtn = h('button', { class: 'btn btn-big', type: 'button', hidden: true,
        onclick: () => { i++; i < targets.length ? showRound() : finish(); } }, EG.t('cont'));
      const startBtn = h('button', { class: 'btn btn-big', type: 'button', onclick: countdown }, EG.t('slap.go'));

      const cardEls = {}; // sideId -> [{w, btn}]
      const halves = mode.sides.map((s, si) => {
        cardEls[s.id] = [];
        const grid = h('div', { class: 'slap-grid' }, cards.map((w) => {
          const btn = h('button', { class: 'slap-card', type: 'button', 'aria-label': w.en,
            onpointerdown: (e) => { e.preventDefault(); tap(s, w); },
            onclick: () => tap(s, w) },
            lv <= 2 && w.emoji ? h('span', { class: 'em', 'aria-hidden': 'true' }, w.emoji) : null,
            h('span', { class: 'word' }, w.en));
          cardEls[s.id].push({ w, btn });
          return btn;
        }));
        return h('div', { class: 'slap-half side-' + si }, h('div', { class: 'slap-name' }, s.sym + ' ' + s.name), grid);
      });
      const wrap = h('div', { class: 'slap-wrap', hidden: true }, halves);

      function mark(w, cls, sym) {
        mode.sides.forEach((s) => cardEls[s.id].filter((c) => c.w === w).forEach((c) => {
          c.btn.classList.add(cls); c.btn.append(h('span', { class: 'mark' }, sym));
        }));
      }
      function lock(s) {
        locked.add(s.id);
        cardEls[s.id].forEach((c) => (c.btn.disabled = true));
        halves[mode.sides.indexOf(s)].classList.add('locked');
      }
      function end() {
        over = true; live = false;
        mark(t, 'right', '✓');
        mode.sides.forEach((s) => cardEls[s.id].forEach((c) => (c.btn.disabled = true)));
        nextBtn.hidden = false;
        if (!muted) EG.speak(t.en, true);
      }

      function tap(s, w) {
        if (!live || over || locked.has(s.id)) return;
        if (w === t) {
          board.add(s.id, 1); EG.sound('right');
          verdict.textContent = EG.t('slap.first', { sym: s.sym, name: s.name });
          verdict.className = 'verdict v-ok';
          end();
        } else {
          board.add(s.id, -1); EG.sound('wrong');
          const mine = cardEls[s.id].find((c) => c.w === w).btn;
          mine.classList.add('wrong'); mine.append(h('span', { class: 'mark' }, '✗'));
          lock(s);
          verdict.textContent = EG.t('slap.wrong', { sym: s.sym, name: s.name });
          verdict.className = 'verdict v-trick';
          if (locked.size === mode.sides.length) end();
        }
      }

      function countdown() {
        startBtn.hidden = true;
        [3, 2, 1].forEach((n, k) => later(() => { prompt.textContent = String(n); prompt.classList.add('big'); EG.sound('tick'); }, k * 800));
        later(() => {
          wrap.hidden = false; live = true;
          prompt.classList.remove('big');
          prompt.replaceChildren(showDe
            ? h('span', { class: 'slap-de' }, '💬 ' + EG.gloss(t))
            : h('span', { class: 'slap-de' }, EG.t('slap.listen')),
          EG.speakButton(t.en, EG.t('speakWord')));
          if (!showDe) EG.speak(t.en);
        }, 3 * 800);
      }

      el.append(
        h('div', { class: 'round-info' }, EG.t('round', { i: i + 1, n: targets.length })),
        prompt, startBtn, wrap, verdict, nextBtn);
    }

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

    showRound();
  },
});
