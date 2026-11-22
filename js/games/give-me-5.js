// Give me 5 – Kategorie erscheint, 5 passende Wörter nennen, bevor die Zeit abläuft.
// Hilfen und Zeit je Niveau der Kategorie: N1 = Emoji + Deutsch, 40 s; N2 = Emoji, 30 s; N3 = keine, 20 s.
EG.registerGame({
  id: 'give-me-5',
  name: 'Give me 5',
  emoji: '🖐️',
  get tagline() { return EG.t('tag.g5'); },
  description: 'Kategorie erscheint – nenne 5 passende Wörter!',

  mount(ctx) {
    const { el, year, maxLevel, mode, board } = ctx;
    const h = EG.h;
    const ROUNDS = 6;
    const SECONDS = { 1: 40, 2: 30, 3: 20 };

    const pool = EG.categories.filter((c) => c.level <= maxLevel && (c.from || 5) <= year);
    const deck = EG.shuffle(pool).slice(0, ROUNDS);
    let i = 0, timer = null;

    function showRound() {
      const c = deck[i];
      el.replaceChildren();
      const hints = [];
      if (c.level <= 2) hints.push(h('div', { class: 'hint-emoji', 'aria-hidden': 'true' }, c.emoji));
      if (c.level === 1) hints.push(h('div', { class: 'hint-de' }, '💬 ' + EG.gloss(c)));

      const seconds = SECONDS[c.level];
      const clock = h('div', { class: 'clock', role: 'timer', 'aria-live': 'off' }, '⏱ ' + seconds);
      const award = h('div', { hidden: true });
      const startBtn = h('button', { class: 'btn btn-big', type: 'button' }, EG.t('g5.start'));

      const toAward = () => {
        clearInterval(timer);
        startBtn.hidden = true;
        award.hidden = false;
        award.replaceChildren(h('div', { class: 'verdict' }, EG.t('g5.q')),
          EG.awardButtons(mode, (side) => {
            if (side) { board.add(side, 1); EG.sound('right'); } else EG.sound('wrong');
            i++;
            i < deck.length ? showRound() : finish();
          }));
      };

      startBtn.onclick = () => {
        EG.sound('click');
        let left = seconds;
        startBtn.textContent = EG.t('g5.done');
        startBtn.onclick = toAward;
        timer = setInterval(() => {
          left--;
          clock.textContent = (left <= 5 ? '⏰ ' : '⏱ ') + left;
          clock.classList.toggle('clock-low', left <= 5);
          if (left <= 5 && left > 0) EG.sound('tick');
          if (left <= 0) { EG.sound('wrong'); toAward(); }
        }, 1000);
      };

      el.append(
        h('div', { class: 'round-info' }, EG.t('round', { i: i + 1, n: deck.length })),
        h('div', { class: 'card zip-card' },
          h('div', { class: 'zip-task' }, '🖐️ Give me five …'),
          h('div', { class: 'zip-given' }, c.name, EG.speakButton(c.name)),
          h('div', { class: 'hints' }, hints), clock),
        startBtn, award);
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
