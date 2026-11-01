/* ReadFlow — idiomas. As chaves são os textos em português; as outras línguas vêm de i18n-data.js. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});

  const LANGS = [
    { id: 'pt', name: 'Português (Portugal)', locale: 'pt-PT' },
    { id: 'en', name: 'English', locale: 'en-GB' },
    { id: 'ru', name: 'Русский', locale: 'ru-RU' },
    { id: 'de', name: 'Deutsch', locale: 'de-DE' }
  ];
  const dict = { en: {}, ru: {}, de: {} };
  let lang = 'pt';

  /** rows: [chave PT, EN, RU, DE] */
  function add(rows) {
    for (const [k, en, ru, de] of rows) { dict.en[k] = en; dict.ru[k] = ru; dict.de[k] = de; }
  }
  function fill(str, p) {
    return p ? str.replace(/\{(\w+)\}/g, (m, n) => (p[n] !== undefined ? p[n] : m)) : str;
  }
  function t(key, params) {
    const d = dict[lang];
    return fill((d && d[key]) || key, params);
  }
  /** Plural: forms = { pt:{one,other}, en:{...}, ru:{one,few,many,other}, de:{...} } */
  function tn(forms, n, params) {
    const f = forms[lang] || forms.pt;
    const cat = new Intl.PluralRules(locale()).select(n);
    return fill(f[cat] || f.other, { n, ...(params || {}) });
  }
  function setLang(id) { if (LANGS.some((l) => l.id === id)) lang = id; if (typeof document !== 'undefined') document.documentElement.lang = locale(); }
  const getLang = () => lang;
  const locale = () => (LANGS.find((l) => l.id === lang) || LANGS[0]).locale;
  const missing = (id) => Object.keys(dict.en).length === 0 ? [] : [];

  RF.i18n = { LANGS, add, t, tn, setLang, getLang, locale, dict, missing };
  if (typeof module !== 'undefined' && module.exports) module.exports = RF.i18n;
})(typeof window !== 'undefined' ? window : globalThis);
