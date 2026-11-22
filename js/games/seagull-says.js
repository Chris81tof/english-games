// Seagull says – wie "Simon says". Nur Befehle mit "Seagull says" ausführen!
// Hilfen je Niveau des Befehls: N1 = Emoji + Deutsch, N2 = Emoji, N3 = keine. Lehrkraft vergibt den Punkt.
EG.registerGame({
  id: 'seagull-says',
  name: 'Seagull says',
  emoji: '🐦',
  tagline: 'Listen and do it!',
  description: 'Nur mit „Seagull says“ ausführen!',

  mount(ctx) {
    const { el, year, maxLevel, mode, board } = ctx;
    const h = EG.h;
    const ROUNDS = 10;

    const pool = EG.commands.filter((c) => c.level <= maxLevel && (c.from || 5) <= year);
    const deck = EG.shuffle(pool).slice(0, ROUNDS).map((c) => ({ c, trick: Math.random() < 0.3 }));
    let i = 0;

    function showRound() {
      const { c, trick } = deck[i];
      const full = trick ? c.text : 'Seagull says: ' + c.text;
      el.replaceChildren();

      const bubble = h('div', { class: 'card bubble', hidden: true, 'aria-live': 'polite' });
      const award = h('div', { hidden: true });
      const verdict = h('div', { class: 'verdict' });

      const solveBtn = h('button', { class: 'btn btn-plain btn-big', type: 'button', hidden: true, onclick: () => {
        EG.sound('click');
        solveBtn.hidden = true;
        verdict.textContent = trick
          ? '🚫 Kein „Seagull says“ – wer stillgeblieben ist, hat Recht!'
          : '✅ „Seagull says“ – wer mitgemacht hat, hat Recht!';
        verdict.classList.add(trick ? 'v-trick' : 'v-ok');
        award.hidden = false;
        award.append(EG.awardButtons(mode, (side) => {
          if (side) { board.add(side, 1); EG.sound('right'); } else EG.sound('wrong');
          i++;
          i < deck.length ? showRound() : finish();
        }));
      } }, '🔍 Auflösung');

      const showBtn = h('button', { class: 'btn btn-big', type: 'button', onclick: () => {
        EG.sound('click');
        showBtn.hidden = true;
        bubble.hidden = false;
        const hints = [];
        if (c.level <= 2 && c.emoji) hints.push(h('div', { class: 'hint-emoji', 'aria-hidden': 'true' }, c.emoji));
        if (c.level === 1) hints.push(h('div', { class: 'hint-de' }, '🇩🇪 ' + c.de));
        bubble.replaceChildren(
          h('div', { class: 'cmd' }, trick ? c.text : [h('span', { class: 'says' }, '🐦 Seagull says: '), c.text], EG.speakButton(full)),
          h('div', { class: 'hints' }, hints));
        solveBtn.hidden = false;
        EG.speak(full, true);
      } }, '▶ Nächster Befehl');

      el.append(
        h('div', { class: 'round-info' }, `Runde ${i + 1} / ${deck.length}`),
        showBtn, bubble, solveBtn, verdict, award);
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

    if (!deck.length) { el.append(h('p', {}, 'Keine Befehle für diesen Jahrgang hinterlegt.')); return; }
    showRound();
  },
});
