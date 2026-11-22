// Zip it! – Kurz- und Langformen (I am ↔ I'm). Lehrkraft vergibt den Punkt.
// Hilfen je Niveau: N1 = Emoji + Deutsch + Satz, N2 = Emoji + Satz, N3 = keine.
EG.registerGame({
  id: 'zip-it',
  name: 'Zip it!',
  emoji: '🤐',
  tagline: 'Kurz ↔ lang',
  description: 'Eine Form erscheint – schreibe die andere!',

  mount(ctx) {
    const { el, year, level, unit, mode, board } = ctx;
    const h = EG.h;
    const ROUNDS = 10;

    const pool = (unit.contractions || EG.contractions).filter((c) => (c.from || 5) <= year);
    const deck = EG.shuffle(pool).slice(0, ROUNDS).map((c) => ({ c, toShort: Math.random() < 0.5 }));
    let i = 0;

    function sentence(c, form) { return c.ctx.replace('{}', form); }

    function showRound() {
      const { c, toShort } = deck[i];
      const given = toShort ? c.long : c.short;
      const answer = toShort ? c.short : c.long;
      el.replaceChildren();

      const hints = [];
      if (level <= 2 && c.emoji) hints.push(h('div', { class: 'hint-emoji', 'aria-hidden': 'true' }, c.emoji));
      if (level === 1) hints.push(h('div', { class: 'hint-de' }, '🇩🇪 ' + c.de));
      if (level <= 2) hints.push(h('div', { class: 'hint-ctx' }, sentence(c, '___')));

      const reveal = h('div', { class: 'zip-answer', hidden: true, 'aria-live': 'polite' });
      const award = h('div', { hidden: true });
      const showBtn = h('button', { class: 'btn btn-big', type: 'button', onclick: () => {
        EG.sound('click');
        reveal.hidden = false;
        reveal.replaceChildren(h('span', { class: 'zip-ans-label' }, '✔ Lösung'), h('span', { class: 'zip-ans-text' }, answer), EG.speakButton(answer));
        award.hidden = false;
        award.append(EG.awardButtons(mode, (side) => {
          if (side) { board.add(side, 1); EG.sound('right'); } else EG.sound('wrong');
          i++;
          i < deck.length ? showRound() : finish();
        }));
        showBtn.hidden = true;
        EG.speak(answer, true);
      } }, '👁 Lösung zeigen');

      el.append(
        h('div', { class: 'round-info' }, `Runde ${i + 1} / ${deck.length}`),
        h('div', { class: 'card zip-card' },
          h('div', { class: 'zip-task' }, toShort ? '✏️ Long form → write the SHORT form!' : '✏️ Short form → write the LONG form!'),
          h('div', { class: 'zip-given' }, given, EG.speakButton(given)),
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
            h('button', { class: 'btn btn-big', type: 'button', onclick: ctx.restart }, '↻ Nochmal'),
            h('button', { class: 'btn btn-plain btn-big', type: 'button', onclick: ctx.exit }, '☰ Spielauswahl')),
        ));
    }

    if (!deck.length) { el.append(h('p', {}, 'Keine Kurzformen für diesen Jahrgang hinterlegt.')); return; }
    showRound();
  },
});
