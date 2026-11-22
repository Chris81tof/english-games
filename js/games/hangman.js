// Hangman – Buchstaben raten, die Klasse (oder Spieler/Teams im Wechsel) rät gemeinsam.
// Wörter aus der gewählten Unit. Hilfen: N1 Emoji + Deutsch, N2 Emoji, N3 keine.
// Punkte: Klasse +1 pro gelöstem Wort; Spieler/Teams +1 pro richtig geratenem Buchstaben-Vorkommen (Wechsel nach jedem Tipp).
EG.registerGame({
  id: 'hangman',
  name: 'Hangman',
  emoji: '🔤',
  tagline: 'Guess the letters!',
  description: 'Rate das Wort Buchstabe für Buchstabe!',

  mount(ctx) {
    const { el, level, unit, mode, board } = ctx;
    const h = EG.h;
    const LIVES = 8;
    const ROUNDS = 5;
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    const pool = unit.words.filter((w) => (w.level || 1) <= level && /[a-z]/i.test(w.en));
    const deck = EG.shuffle(pool).slice(0, ROUNDS);
    let i = 0, turn = 0;

    // Galgen in 8 Stufen (SVG-Teile erscheinen nach und nach)
    const PARTS = [
      '<line x1="10" y1="190" x2="110" y2="190"/>',
      '<line x1="40" y1="190" x2="40" y2="20"/>',
      '<line x1="40" y1="20" x2="130" y2="20"/><line x1="130" y1="20" x2="130" y2="42"/>',
      '<circle cx="130" cy="58" r="16"/>',
      '<line x1="130" y1="74" x2="130" y2="125"/>',
      '<line x1="130" y1="86" x2="108" y2="108"/><line x1="130" y1="86" x2="152" y2="108"/>',
      '<line x1="130" y1="125" x2="112" y2="160"/>',
      '<line x1="130" y1="125" x2="148" y2="160"/>',
    ];
    const gallows = (wrong) => {
      const s = h('div', { class: 'gallows', role: 'img', 'aria-label': `${wrong} von ${LIVES} Fehlern` });
      s.innerHTML = `<svg viewBox="0 0 180 200" fill="none" stroke="#1e1b3a" stroke-width="6" stroke-linecap="round">${PARTS.slice(0, wrong).join('')}</svg>`;
      return s;
    };

    function side() { return mode.sides[turn % mode.sides.length]; }

    function showRound() {
      const w = deck[i];
      const word = w.en.toUpperCase();
      const used = new Set();
      let wrong = 0;
      el.replaceChildren();

      const hints = [];
      if (level <= 2 && w.emoji) hints.push(h('div', { class: 'hint-emoji', 'aria-hidden': 'true' }, w.emoji));
      if (level === 1) hints.push(h('div', { class: 'hint-de' }, '🇩🇪 ' + w.de));

      const wordEl = h('div', { class: 'hm-word', 'aria-live': 'polite' });
      const lives = h('div', { class: 'round-info' });
      const turnEl = h('div', { class: 'round-info' });
      const art = h('div', {});
      const msg = h('div', { class: 'verdict' });
      const keys = {};
      const kb = h('div', { class: 'keyboard' }, LETTERS.map((L) => (keys[L] = h('button', {
        class: 'key', type: 'button', onclick: () => guess(L) }, L))));
      const nextBtn = h('button', { class: 'btn btn-big', type: 'button', hidden: true,
        onclick: () => { i++; i < deck.length ? showRound() : finish(); } }, '→ Weiter');

      const solved = () => [...word].every((ch) => !/[A-Z]/.test(ch) || used.has(ch));

      function paint() {
        wordEl.replaceChildren(...[...word].map((ch) => h('span', { class: 'hm-letter' + (ch === ' ' ? ' gap' : '') },
          !/[A-Z]/.test(ch) ? (ch === ' ' ? '' : ch) : (used.has(ch) || over ? ch : ''))));
        art.replaceChildren(gallows(wrong));
        lives.textContent = `❤️ ${LIVES - wrong} Leben`;
        turnEl.textContent = mode.id === 'class' ? '' : 'Dran: ' + side().sym + ' ' + side().name;
      }
      let over = false;

      function guess(L) {
        if (over || used.has(L)) return;
        used.add(L);
        const hit = word.includes(L);
        keys[L].disabled = true;
        keys[L].textContent = L + (hit ? ' ✓' : ' ✗');
        keys[L].classList.add(hit ? 'hit' : 'miss');
        if (hit) { EG.sound('right'); board.add(side().id, mode.id === 'class' ? 0 : [...word].filter((c) => c === L).length); }
        else { EG.sound('wrong'); wrong++; }
        if (mode.id !== 'class') turn++;
        if (solved()) {
          over = true;
          if (mode.id === 'class') board.add('c', 1);
          msg.textContent = '🎉 Gelöst!'; msg.classList.add('v-ok');
          EG.sound('win'); EG.speak(w.en, true);
        } else if (wrong >= LIVES) {
          over = true;
          msg.textContent = '😢 Das Wort war: ' + w.en; msg.classList.add('v-trick');
          EG.speak(w.en, true);
        }
        if (over) { nextBtn.hidden = false; kb.classList.add('done'); }
        paint();
      }

      paint();
      el.append(
        h('div', { class: 'round-info' }, `Wort ${i + 1} / ${deck.length}`),
        h('div', { class: 'hm-main' }, art, h('div', { class: 'hm-side' }, hints, wordEl, lives, turnEl, msg, EG.speakButton(w.en, 'Wort anhören'))),
        kb, nextBtn);
    }

    function finish() {
      EG.sound('win');
      el.replaceChildren(
        h('div', { class: 'card end-card' },
          h('div', { class: 'end-emoji' }, '🏆'),
          h('h2', {}, EG.resultText(board)),
          h('div', { class: 'row' },
            h('button', { class: 'btn btn-big', type: 'button', onclick: ctx.restart }, '↻ Nochmal'),
            h('button', { class: 'btn btn-plain btn-big', type: 'button', onclick: ctx.exit }, '☰ Spielauswahl'))));
    }

    if (!deck.length) { el.append(h('p', {}, 'Keine Wörter für dieses Niveau in dieser Unit.')); return; }
    showRound();
  },
});
