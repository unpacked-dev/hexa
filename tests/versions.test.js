// Tests für versions.json: Stimmen die Versionen mit Dockerfile, Workflows, package.json und den Schriften überein?
// Schlägt hier etwas fehl, wurde eine Version geändert, ohne versions.json anzupassen (siehe CLAUDE.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const info = JSON.parse(read('versions.json'));
const V = info.versions;
const WORKFLOWS = fs.readdirSync(path.join(root, '.github/workflows')).filter(f => /\.ya?ml$/.test(f)).map(f => read('.github/workflows/' + f));
const FONTS = ['Archivo', 'Kalam'];

// Was in den Dateien steht: Name → Versionen
function pinned() {
  const out = new Map();
  const add = (name, v) => out.set(name, (out.get(name) || new Set()).add(v));
  for (const m of read('Dockerfile').matchAll(/^FROM\s+([^\s:]+):(\S+)/gm)) add(m[1], m[2]);
  for (const yml of WORKFLOWS) {
    for (const m of yml.matchAll(/bun-version:\s*['"]?([\w.]+)/g)) add('bun', m[1]);
    for (const m of yml.matchAll(/node-version:\s*['"]?([\w.]+)/g)) add('node', m[1]);
    for (const m of yml.matchAll(/uses:\s*([\w.-]+\/[\w.-]+)@([\w.-]+)/g)) add(m[1], m[2]);
  }
  const notes = read('THIRD-PARTY-NOTICES.md');
  for (const font of FONTS) for (const m of notes.matchAll(new RegExp(`${font} (v\\d+)`, 'g'))) add(font, m[1]);
  return out;
}

test('versions.json enthält nur den Projektnamen und Versionen', () => {
  assert.deepEqual(Object.keys(info).sort(), ['project', 'versions']);
  assert.equal(typeof info.project, 'string');
  for (const [name, v] of Object.entries(V)) assert.ok(typeof v === 'string' && v, name);
});

test('Jede Version in Dockerfile, Workflows und Schriften steht so in versions.json', () => {
  for (const [name, versions] of pinned()) {
    assert.ok(name in V, `${name} fehlt in versions.json`);
    assert.deepEqual([...versions], [V[name]], `${name}: überall dieselbe Version wie in versions.json`);
  }
});

test('versions.json enthält nichts, was nirgends festgelegt ist', () => {
  const known = pinned();
  for (const name of Object.keys(V)) assert.ok(known.has(name), `${name} steht in versions.json, aber in keiner Datei`);
});

test('Bun im Image passt zu Bun in den Tests', () => {
  assert.equal(V['oven/bun'].split('-')[0], V.bun);
});

test('Keine npm-Pakete', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const k of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.deepEqual(Object.keys(pkg[k] || {}), [], 'package.json: ' + k + '. Neue Pakete nur nach Absprache und in versions.json');
  }
});

test('Das Image bekommt /versions.json, ausgeliefert wird sie nie', () => {
  const docker = read('Dockerfile');
  assert.match(docker, /COPY versions\.json /);
  assert.match(docker, /RUN bun server\/versions\.js \S+ \/versions\.json/);
  const main = read('server/main.js');
  const list = name => JSON.parse(main.match(new RegExp(`const ${name} = (\\[[^\\]]*\\])`))[1].replace(/'/g, '"'));
  assert.ok(!list('PUBLIC_FILES').some(f => /versions/.test(f)), 'versions.json darf nicht in PUBLIC_FILES stehen');
  assert.ok(!list('PUBLIC_DIRS').includes(''), 'kein leerer Ordner in PUBLIC_DIRS');
});
