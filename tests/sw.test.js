// Tests für sw.js: Liegt jede Datei der App auf dem Gerät, damit HEXA ohne Internet startet?
// Schlägt hier etwas fehl, fehlt meist eine neue Datei in FILES in sw.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const sw = read('sw.js');
const FILES = new Function(`return ${sw.match(/const FILES = (\[[\s\S]*?\]);/)[1]}`)();
const isLocal = u => !/^(https?:|data:|mailto:|#)/.test(u);

test('Jede Datei in der Liste gibt es, keine doppelt', () => {
  assert.equal(new Set(FILES).size, FILES.length, 'doppelte Einträge');
  for (const f of FILES) assert.ok(fs.existsSync(path.join(root, f)), `${f} gibt es nicht`);
});

test('Alles, was index.html lädt, ist in der Liste', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(isLocal);
  assert.ok(refs.length > 5, 'zu wenige Verweise gefunden');
  for (const r of refs) assert.ok(FILES.includes(r), `${r} fehlt in sw.js`);
});

test('Schriften aus dem CSS und Icons aus dem Manifest sind in der Liste', () => {
  const css = read('css/hexa.css');
  for (const m of css.matchAll(/url\(([^)'"]+\.(?:woff2|png|svg))\)/g)) {
    const f = path.posix.normalize(path.posix.join('css', m[1]));
    assert.ok(FILES.includes(f), `${f} fehlt in sw.js`);
  }
  for (const icon of JSON.parse(read('manifest.webmanifest')).icons) {
    assert.ok(FILES.includes(icon.src), `${icon.src} fehlt in sw.js`);
  }
});

test('Jedes Skript, jede Sprache und jedes Icon ist dabei', () => {
  for (const dir of ['js', 'lang', 'icons']) {
    for (const f of fs.readdirSync(path.join(root, dir))) assert.ok(FILES.includes(`${dir}/${f}`), `${dir}/${f} fehlt in sw.js`);
  }
});

test('Server und Release-ZIP liefern sw.js mit aus', () => {
  assert.match(read('server/main.js'), /PUBLIC_FILES = \[[^\]]*'sw\.js'/);
  assert.match(read('.github/workflows/release.yml'), /cp -r [^\n]*\bsw\.js\b/);
});
