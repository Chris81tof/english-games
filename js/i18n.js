// Sprachen: Menütexte (EG.t) und Übersetzungen der Inhalte (EG.gloss).
// Menütexte: data/i18n/ui-<lang>.js. Übersetzungen: data/i18n/<lang>.js, je Eintrag [Text, geprüft 0/1].
// Englisch als Menüsprache zeigt als Übersetzung Deutsch. Fehlt eine Übersetzung, erscheint das deutsche Wort.
(() => {
  const EG = window.EG;
  // Jede Sprache in ihrer eigenen Schrift. code = Kürzel neben dem Globus.
  EG.languages = [
    { id: 'en', code: 'EN', name: 'English' },
    { id: 'de', code: 'DE', name: 'Deutsch' },
    { id: 'fr', code: 'FR', name: 'Français' },
    { id: 'es', code: 'ES', name: 'Español' },
    { id: 'it', code: 'IT', name: 'Italiano' },
    { id: 'tr', code: 'TR', name: 'Türkçe' },
    { id: 'ku', code: 'KU', name: 'Kurdî (Kurmancî)' },
    { id: 'ar', code: 'AR', name: 'العربية', dir: 'rtl' },
    { id: 'bg', code: 'BG', name: 'Български' },
    { id: 'uk', code: 'UK', name: 'Українська' },
    { id: 'ru', code: 'RU', name: 'Русский' },
    { id: 'ro', code: 'RO', name: 'Română' },
    { id: 'pl', code: 'PL', name: 'Polski' },
    { id: 'el', code: 'EL', name: 'Ελληνικά' },
    { id: 'bhs', code: 'BHS', name: 'Bosanski / Hrvatski / Srpski' },
    { id: 'sq', code: 'SQ', name: 'Shqip' },
  ];
  EG.ui = {};
  EG.translations = {};
  EG.registerUi = (lang, strings) => { EG.ui[lang] = Object.assign(EG.ui[lang] || {}, strings); };
  EG.registerTranslations = (lang, map) => { EG.translations[lang] = Object.assign(EG.translations[lang] || {}, map); };

  // Nur Sprachen mit Menütexten erscheinen in der Auswahl.
  EG.availableLanguages = () => EG.languages.filter((l) => EG.ui[l.id]);
  EG.lang = () => { const l = EG.store.getLang(); return EG.ui[l] ? l : 'en'; };
  EG.langInfo = (id = EG.lang()) => EG.languages.find((l) => l.id === id);
  // Sprache der Übersetzungen: wie das Menü, bei Englisch aber Deutsch
  EG.contentLang = () => (EG.lang() === 'en' ? 'de' : EG.lang());

  EG.t = (key, vars) => {
    const s = (EG.ui[EG.lang()] || {})[key] ?? (EG.ui.en || {})[key] ?? key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
  };

  // Übersetzung eines Eintrags (Wort, Befehl, Kategorie, Kurzform) in der Inhaltssprache
  EG.glossInfo = (item, lang = EG.contentLang()) => {
    if (lang === 'de' || !item._key) return { text: item.de, auto: false, missing: false };
    const e = (EG.translations[lang] || {})[item._key];
    if (!e || !e[0]) return { text: item.de, auto: false, missing: true };
    return { text: e[0], auto: !e[1], missing: false };
  };
  EG.gloss = (item) => EG.glossInfo(item).text;

  EG.applyLang = () => {
    const info = EG.langInfo();
    document.documentElement.lang = info.id === 'bhs' ? 'sh' : info.id;
    document.documentElement.dir = info.dir || 'ltr';
  };
})();

// Schlüssel für die Übersetzungen: Wörter "unitId|englisch", Befehle "cmd|…", Kategorien "cat|…", Kurzformen "zip|…"
EG.assignKeys = () => {
  EG.units.forEach((u) => u.words.forEach((w) => { w._key = u.id + '|' + w.en; }));
  EG.commands.forEach((c) => { c._key = 'cmd|' + c.text; });
  EG.categories.forEach((c) => { c._key = 'cat|' + c.name; });
  EG.contractions.forEach((c) => { c._key = 'zip|' + c.long; });
};
