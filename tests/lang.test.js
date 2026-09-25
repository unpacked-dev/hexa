// Tests für die Sprachdateien: gleiche Einträge, gleiche Platzhalter, und jeder Text,
// den index.html oder app.js benutzt, ist vorhanden.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const de = require('../lang/de.js');
const en = require('../lang/en.js');
const { FIELDS, UPPER, LOWER } = require('../js/rules.js');

const root = path.join(__dirname, '..');
const LANGS = { de, en };

// Alle Einträge als Pfad → Wert, Listen mit Index
function flatten(o, prefix = '', out = {}) {
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) flatten(v, prefix ? prefix + '.' + k : k, out);
  } else {
    out[prefix] = o;
  }
  return out;
}
const lookup = (dict, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);
const holes = s => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort();

test('Deutsch und Englisch haben dieselben Einträge', () => {
  const a = Object.keys(flatten(de)).sort();
  const b = Object.keys(flatten(en)).sort();
  assert.deepEqual(b.filter(k => !a.includes(k)), [], 'nur auf Englisch');
  assert.deepEqual(a.filter(k => !b.includes(k)), [], 'nur auf Deutsch');
});

test('Platzhalter stimmen in beiden Sprachen überein', () => {
  const a = flatten(de);
  const b = flatten(en);
  for (const key of Object.keys(a)) {
    if (key.startsWith('rules.')) continue;
    assert.deepEqual(holes(b[key]), holes(a[key]), key);
  }
});

test('Jedes Feld hat Namen, oben die Mehrzahl, unten die Voraussetzung', () => {
  for (const [lang, t] of Object.entries(LANGS)) {
    for (const f of FIELDS) assert.ok(t.fields[f.key] && t.fields[f.key].name, lang + ': ' + f.key);
    for (const f of UPPER) assert.ok(t.fields[f.key].plural, lang + ': ' + f.key + '.plural');
    for (const f of LOWER) assert.ok(t.fields[f.key].req, lang + ': ' + f.key + '.req');
  }
});

test('Alle Texte aus index.html und app.js gibt es', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sections = Object.keys(de).filter(k => de[k] && typeof de[k] === 'object').join('|');
  const keys = new Set([
    ...[...html.matchAll(/data-i18n(?:-label|-title)?="([^"]+)"/g)].map(m => m[1]),
    ...[...js.matchAll(new RegExp(`'((?:${sections})\\.[A-Za-z0-9.]+)'`, 'g'))].map(m => m[1]),
  ]);
  assert.ok(keys.size > 100, 'zu wenige Schlüssel gefunden: ' + keys.size);
  for (const [lang, t] of Object.entries(LANGS)) {
    for (const key of keys) assert.notEqual(lookup(t, key), undefined, lang + ': ' + key);
  }
});

test('Regeln: gleiche Abschnitte und gleiche Würfelbeispiele', () => {
  assert.equal(en.rules.sections.length, de.rules.sections.length);
  assert.equal(en.rules.claim.length, de.rules.claim.length);
  de.rules.sections.forEach((sec, i) => {
    const dice = h => [...h.matchAll(/data-dice="(\d+)"/g)].map(m => m[1]);
    assert.deepEqual(dice(en.rules.sections[i].html), dice(sec.html), 'Abschnitt ' + (i + 1));
  });
});
