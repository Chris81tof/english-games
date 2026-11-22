// What's missing? – Wörter/Bilder zeigen, eins verschwindet, raten.
// Kartenzahl je höchstem gewähltem Niveau: N1 5, N2 6, N3 7 (mehr Karten = schwerer).
// Hilfen je Niveau des einzelnen Worts: N1 Emoji + Übersetzung, N2 nur Emoji, N3 nur das englische Wort.
EG.registerGame({
  id: 'whats-missing',
  name: "What's missing?",
  emoji: '🙈',
  get tagline() { return EG.t('tag.missing'); },
  description: 'Look at the board, then say what disappeared!',
  minWords: 6,

  mount(ctx) {
    const { el, words, maxLevel, mode, board } = ctx;
    const h = EG.h;
    const ROUNDS = 8;
    const CARDS = { 1: 5, 2: 6, 3: 7 }[maxLevel];

    const pool = words.filter((w) => w.emoji);
    const rounds = Array.from({ length: ROUNDS }, () => EG.shuffle(pool).slice(0, CARDS));
    let i = 0;

    function cardContent(w) {
      const parts = [];
      if (w.level <= 2 && w.emoji) parts.push(h('span', { class: 'em', 'aria-hidden': 'true' }, w.emoji));
      parts.push(h('span', { class: 'word' }, w.en));
      if (w.level === 1) parts.push(h('span', { class: 'wm-de' }, EG.gloss(w)));
      return parts;
    }

    function showRound() {
      const set = rounds[i];
      const hiddenIdx = Math.floor(Math.random() * set.length);
      el.replaceChildren();

      const cardEls = set.map((w) => h('div', { class: 'wm-card' }, cardContent(w)));
      const grid = h('div', { class: 'wm-grid' }, cardEls);
      const award = h('div', { hidden: true });

      const hideBtn = h('button', { class: 'btn btn-big', type: 'button', onclick: () => {
        EG.sound('click');
        cardEls[hiddenIdx].replaceChildren(h('span', { class: 'wm-mask', 'aria-hidden': 'true' }, '❓'));
        cardEls[hiddenIdx].classList.add('wm-hidden');
        hideBtn.hidden = true;
        revealBtn.hidden = false;
      } }, EG.t('wm.hide'));

      const revealBtn = h('button', { class: 'btn btn-big', type: 'button', hidden: true, onclick: () => {
        EG.sound('click');
        const target = set[hiddenIdx];
        cardEls[hiddenIdx].classList.remove('wm-hidden');
        cardEls[hiddenIdx].classList.add('wm-found');
        cardEls[hiddenIdx].replaceChildren(...cardContent(target), EG.speakButton(target.en));
        revealBtn.hidden = true;
        award.hidden = false;
        award.append(EG.awardButtons(mode, (side) => {
          if (side) { board.add(side, 1); EG.sound('right'); } else EG.sound('wrong');
          i++;
          i < rounds.length ? showRound() : finish();
        }));
      } }, EG.t('wm.reveal'));

      el.append(
        h('div', { class: 'round-info' }, EG.t('round', { i: i + 1, n: rounds.length })),
        h('div', { class: 'hint-line' }, EG.t('wm.q')),
        grid, hideBtn, revealBtn, award);
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

    if (pool.length < CARDS) { el.append(h('p', {}, EG.t('wm.none'))); return; }
    showRound();
  },
});
