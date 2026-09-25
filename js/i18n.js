/* HEXA – Sprache: wählt Deutsch oder Englisch und liefert die Texte aus lang/*.js.
   Deutsch ist die Hauptsprache. Steht der Browser auf einer anderen Sprache, kommt Englisch.
   Fehlt ein Text, steht der deutsche da. Die Wahl in den Einstellungen wird gespeichert. */
(function (root) {
  'use strict';

  const KEY = 'hexa-lang';
  const MAIN = 'de';
  const texts = root.HexaLang || {};
  const langs = Object.keys(texts);

  function browserLang() {
    const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    return String(list[0] || '');
  }
  function detect() {
    return /^de(-|$)/i.test(browserLang()) ? 'de' : 'en';
  }

  let lang = detect();
  try {
    const saved = localStorage.getItem(KEY);
    if (texts[saved]) lang = saved;
  } catch (e) { /* Speicher gesperrt */ }
  if (!texts[lang]) lang = MAIN;

  const lookup = (dict, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);

  // t('dice.turn', { name: 'Lena' }) → „Lena ist dran“. Mit { one, other } entscheidet n über die Form.
  function t(key, vars) {
    let v = lookup(texts[lang], key);
    if (v === undefined) v = lookup(texts[MAIN], key);
    if (v === undefined) return key;
    if (v && typeof v === 'object' && !Array.isArray(v) && 'other' in v) v = vars && vars.n === 1 ? v.one : v.other;
    if (typeof v !== 'string' || !vars) return v;
    return v.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
  }

  // Datum und Zahlen: bei passender Browsersprache deren Schreibweise, sonst die der App-Sprache
  function locale() {
    const b = browserLang();
    return b.toLowerCase().split('-')[0] === lang ? b : t('locale');
  }

  // Feste Texte im HTML: data-i18n (Inhalt), data-i18n-label (aria-label), data-i18n-title (title)
  function apply(scope) {
    const r = scope || document;
    r.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    r.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
    r.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    document.documentElement.lang = lang;
  }

  function set(next) {
    if (!texts[next] || next === lang) return false;
    lang = next;
    try { localStorage.setItem(KEY, next); } catch (e) { /* Speicher gesperrt */ }
    apply();
    return true;
  }

  root.HexaI18n = {
    t,
    apply,
    set,
    locale,
    langs,
    get lang() { return lang; },
    nameOf: l => (texts[l] && texts[l].name) || l,
  };
})(typeof self !== 'undefined' ? self : this);
