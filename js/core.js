// Kern: Registry, Einstellungen, Töne, Sprachausgabe, Punktetafel, kleine UI-Helfer.
(() => {
  const EG = (window.EG = {
    years: [5, 6, 7, 8, 9, 10],
    levels: [
      { id: 1, name: 'N1', stars: '★', title: 'Einfach', desc: 'Mit Bild und deutschem Wort' },
      { id: 2, name: 'N2', stars: '★★', title: 'Mittel', desc: 'Nur mit Bild' },
      { id: 3, name: 'N3', stars: '★★★', title: 'Schwer', desc: 'Ohne Hilfen' },
    ],
    games: [],
    units: [],
    contractions: [],
    commands: [],
    categories: [],
    registerGame(g) { this.games.push(g); },
    registerUnit(u) { this.units.push(u); },
    registerContractions(list) { this.contractions.push(...list); },
    registerCommands(list) { this.commands.push(...list); },
    registerCategories(list) { this.categories.push(...list); },
  });

  // ---------- DOM-Helfer ----------
  EG.h = function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else el.append(c.nodeType ? c : document.createTextNode(c));
    };
    kids.forEach(add);
    return el;
  };
  const h = EG.h;

  EG.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- Einstellungen (nur dieses Gerät, keine Personendaten) ----------
  const KEY = 'englishGames.v1';
  let data = { muted: false, off: {} };
  try { Object.assign(data, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ohne Speicher weiter */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* egal */ } };

  EG.store = {
    isMuted: () => data.muted,
    setMuted(m) { data.muted = !!m; save(); },
    isGameOn: (year, id) => !(data.off[year] || []).includes(id),
    setGameOn(year, id, on) {
      const list = new Set(data.off[year] || []);
      on ? list.delete(id) : list.add(id);
      data.off[year] = [...list];
      save();
    },
  };

  // ---------- Töne (Web Audio) ----------
  let actx;
  function ac() {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, at, dur, type = 'sine', vol = 0.18) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    const t = c.currentTime + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const sounds = {
    click: () => tone(660, 0, 0.08, 'triangle', 0.12),
    right: () => { tone(523, 0, 0.15); tone(659, 0.12, 0.15); tone(784, 0.24, 0.3); },
    wrong: () => { tone(220, 0, 0.25, 'sawtooth', 0.1); tone(165, 0.2, 0.35, 'sawtooth', 0.1); },
    tick: () => tone(880, 0, 0.05, 'square', 0.06),
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.22, 'triangle', 0.16)),
  };
  EG.sound = (name) => { if (!data.muted && sounds[name]) sounds[name](); };

  // ---------- Sprachausgabe ----------
  let voice;
  function pickVoice() {
    const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    voice = vs.find((v) => v.lang === 'en-GB') || vs.find((v) => v.lang.startsWith('en')) || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); }
  // auto=true: automatische Ansage, wird bei Stummschaltung übersprungen. Klick auf 🔊 spricht immer.
  EG.speak = (text, auto = false) => {
    if (!window.speechSynthesis || (auto && data.muted)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB'; u.rate = 0.85;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  };
  EG.speakButton = (text, label = 'Vorlesen') =>
    h('button', { class: 'btn-icon', type: 'button', 'aria-label': label + ': ' + text, onclick: () => EG.speak(text) }, '🔊');

  // ---------- Spielmodi und Punktetafel ----------
  EG.modes = [
    { id: 'class', name: 'Ganze Klasse', icon: '🏫', desc: 'Alle zusammen sammeln Punkte', sides: [{ id: 'c', name: 'Klasse', sym: '★' }] },
    { id: 'players', name: '2 Spieler', icon: '🧑‍🤝‍🧑', desc: 'Zwei Kinder treten gegeneinander an', sides: [{ id: 'a', name: 'Spieler 1', sym: '●' }, { id: 'b', name: 'Spieler 2', sym: '■' }] },
    { id: 'teams', name: '2 Teams', icon: '👥', desc: 'Zwei Teams sammeln Punkte', sides: [{ id: 'a', name: 'Team A', sym: '▲' }, { id: 'b', name: 'Team B', sym: '◆' }] },
  ];

  EG.createScoreboard = (mode) => {
    const scores = {};
    mode.sides.forEach((s) => (scores[s.id] = 0));
    const cells = {};
    const el = h('div', { class: 'scoreboard', role: 'group', 'aria-label': 'Punkte' });
    mode.sides.forEach((s, i) => {
      const val = h('span', { class: 'score-val', 'aria-live': 'polite' }, '0');
      cells[s.id] = val;
      el.append(h('div', { class: 'score side-' + i },
        h('span', { class: 'score-name' }, s.sym + ' ' + s.name),
        h('button', { class: 'btn-mini', type: 'button', 'aria-label': 'Ein Punkt weniger für ' + s.name, onclick: () => api.add(s.id, -1) }, '−'),
        val,
        h('button', { class: 'btn-mini', type: 'button', 'aria-label': 'Ein Punkt mehr für ' + s.name, onclick: () => api.add(s.id, 1) }, '+'),
      ));
    });
    const api = {
      el, sides: mode.sides,
      get: (id) => scores[id],
      add(id, n = 1) {
        scores[id] = Math.max(0, scores[id] + n);
        cells[id].textContent = scores[id];
        cells[id].classList.remove('pop'); void cells[id].offsetWidth; cells[id].classList.add('pop');
      },
      all: () => mode.sides.map((s) => ({ ...s, points: scores[s.id] })),
    };
    return api;
  };

  // Vergabe-Knöpfe für Spiele mit Lehrkraft-Bewertung. cb(sideId | null) – null = niemand.
  EG.awardButtons = (mode, cb) => {
    const wrap = h('div', { class: 'award' });
    if (mode.id === 'class') {
      wrap.append(
        h('button', { class: 'btn btn-green', type: 'button', onclick: () => cb('c') }, '✓ Richtig  +1'),
        h('button', { class: 'btn btn-plain', type: 'button', onclick: () => cb(null) }, '✗ Nicht gelöst'),
      );
    } else {
      mode.sides.forEach((s, i) => wrap.append(
        h('button', { class: 'btn side-btn-' + i, type: 'button', onclick: () => cb(s.id) }, s.sym + ' Punkt für ' + s.name)));
      wrap.append(h('button', { class: 'btn btn-plain', type: 'button', onclick: () => cb(null) }, '✗ Niemand'));
    }
    return wrap;
  };

  // Endergebnis als Text + Symbol (nicht nur Farbe)
  EG.resultText = (board) => {
    const all = board.all();
    if (all.length === 1) return `Die Klasse hat ${all[0].points} Punkte!`;
    const [a, b] = all;
    if (a.points === b.points) return `Unentschieden! ${a.points} : ${b.points}`;
    const w = a.points > b.points ? a : b;
    return `${w.sym} ${w.name} gewinnt!  ${a.points} : ${b.points}`;
  };
})();
