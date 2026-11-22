// PIN-Schutz für die Einstellungsseite im Schüler-Modus.
// Die PIN steht nur als gesalzener SHA-256-Hash in data/pin.js. Auf einer öffentlichen Seite ist das eine Hürde
// für Schüler:innen, kein echter Schutz: wer die Datei liest, kann eine 4-stellige PIN ausprobieren.
// Nach 3 falschen Eingaben ist die Abfrage 5 Minuten gesperrt (gespeichert im Browser dieses Geräts).
(() => {
  const MAX_FAILS = 3, LOCK_MS = 5 * 60 * 1000, KEY = 'englishGames.lock';

  // Kleines SHA-256 in reinem JS (crypto.subtle gibt es nicht auf jeder Seite, z. B. file://).
  const sha256 = (() => {
    const K = [], H0 = [];
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
    for (let c = 2, n = 0; n < 64; c++) {
      let prime = true;
      for (let d = 2; d * d <= c; d++) if (c % d === 0) { prime = false; break; }
      if (!prime) continue;
      if (n < 8) H0[n] = frac(Math.pow(c, 0.5));
      K[n++] = frac(Math.pow(c, 1 / 3));
    }
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    return (str) => {
      const bytes = Array.from(new TextEncoder().encode(str));
      const bitLen = bytes.length * 8;
      bytes.push(0x80);
      while (bytes.length % 64 !== 56) bytes.push(0);
      for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
      const H = H0.slice(), w = new Array(64);
      for (let off = 0; off < bytes.length; off += 64) {
        for (let i = 0; i < 16; i++) w[i] = (bytes[off + 4 * i] << 24) | (bytes[off + 4 * i + 1] << 16) | (bytes[off + 4 * i + 2] << 8) | bytes[off + 4 * i + 3];
        for (let i = 16; i < 64; i++) {
          const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
          const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let [a, b, c, d, e, f, g, h] = H;
        for (let i = 0; i < 64; i++) {
          const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
          const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
          const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
          const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
          h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) | 0));
      }
      return H.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
    };
  })();

  let state = { fails: 0, until: 0 };
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ohne Speicher weiter */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* egal */ } };

  EG.sha256 = sha256;
  EG.lock = {
    hasPin: () => !!(EG.pin && EG.pin.salt && EG.pin.hash),
    lockedUntil: () => (state.until > Date.now() ? state.until : 0),
    // → { ok, locked, until, left }
    verify(pin) {
      if (EG.lock.lockedUntil()) return { ok: false, locked: true, until: state.until, left: 0 };
      if (sha256(EG.pin.salt + pin) === EG.pin.hash) { state = { fails: 0, until: 0 }; save(); return { ok: true }; }
      state.fails++;
      if (state.fails >= MAX_FAILS) { state = { fails: 0, until: Date.now() + LOCK_MS }; save(); return { ok: false, locked: true, until: state.until, left: 0 }; }
      save();
      return { ok: false, locked: false, left: MAX_FAILS - state.fails };
    },
  };
})();
