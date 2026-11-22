// Word scramble – Buchstaben gemischt, Wort finden. Lehrkraft vergibt den Punkt.
// Nur einfache Wörter ohne Leerzeichen/Satzzeichen werden verwendet.
// Hilfen je Niveau des Worts: N1 Emoji + Übersetzung, N2 nur Emoji, N3 keine.
EG.registerGame({
  id: 'word-scramble',
  name: 'Word scramble',
  emoji: '🔀',
  get tagline() { return EG.t('tag.scramble'); },
  description: 'Letters mixed up – find the word!',
  minWords: 6,

  mount(ctx) {
    const { el, words, mode, board } = ctx;
    const h = EG.h;
    const ROUNDS = 10;

    function scramble(word) {
      const letters = word.toUpperCase().split('');
      let mixed;
      do { mixed = EG.shuffle(letters).join(''); } while (mixed === letters.join('') && letters.length > 1);
      return mixed;
    }

    const pool = words.filter((w) => /^[a-zA-Z]{3,}$/.test(w.en));
    const deck = EG.shuffle(pool).slice(0, ROUNDS).map((w) => ({ w, mixed: scramble(w.en) }));
    let i = 0;

    function showRound() {
      const { w, mixed } = deck[i];
      el.replaceChildren();

      const hints = [];
      if (w.level <= 2 && w.emoji) hints.push(h('div', { class: 'hint-emoji', 'aria-hidden': 'true' }, w.emoji));
      if (w.level === 1) hints.push(h('div', { class: 'hint-de' }, '💬 ' + EG.gloss(w)));

      const reveal = h('div', { class: 'zip-answer', hidden: true, 'aria-live': 'polite' });
      const award = h('div', { hidden: true });
      const showBtn = h('button', { class: 'btn btn-big', type: 'button', onclick: () => {
        EG.sound('click');
        reveal.hidden = false;
        reveal.replaceChildren(h('span', { class: 'zip-ans-label' }, EG.t('zip.answer')), h('span', { class: 'zip-ans-text' }, w.en), EG.speakButton(w.en));
        award.hidden = false;
        award.append(EG.awardButtons(mode, (side) => {
          if (side) { board.add(side, 1); EG.sound('right'); } else EG.sound('wrong');
          i++;
          i < deck.length ? showRound() : finish();
        }));
        showBtn.hidden = true;
        EG.speak(w.en, true);
      } }, EG.t('zip.show'));

      el.append(
        h('div', { class: 'round-info' }, EG.t('round', { i: i + 1, n: deck.length })),
        h('div', { class: 'card zip-card' },
          h('div', { class: 'ws-letters' }, [...mixed].map((ch) => h('span', { class: 'ws-tile' }, ch))),
          h('div', { class: 'hints' }, hints),
          reveal,
        ),
        showBtn, award,
      );
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

    if (!deck.length) { el.append(h('p', {}, EG.t('ws.none'))); return; }
    showRound();
  },
});
