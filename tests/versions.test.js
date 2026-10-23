// Tests für versions.json: Stimmen die Versionen mit Dockerfile, Workflows und package.json überein?
// Schlägt hier etwas fehl, wurde eine Version geändert, ohne versions.json anzupassen (siehe CLAUDE.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const info = JSON.parse(read('versions.json'));
const byName = n => info.components.find(c => c.name === n);
const WORKFLOWS = fs.readdirSync(path.join(root, '.github/workflows')).filter(f => /\.ya?ml$/.test(f)).map(f => '.github/workflows/' + f);

test('Jeder Eintrag ist vollständig', () => {
  assert.equal(typeof info.project, 'string');
  const seen = new Set();
  for (const c of info.components) {
    assert.ok(c.name && !seen.has(c.name), 'Name fehlt oder doppelt: ' + c.name);
    seen.add(c.name);
    assert.equal(typeof c.version, 'string', c.name + ': version');
    assert.equal(typeof c.type, 'string', c.name + ': type');
    assert.equal(typeof c.note, 'string', c.name + ': note');
    assert.ok(Array.isArray(c.use) && c.use.length && c.use.every(u => ['production', 'ci', 'app', 'dev'].includes(u)), c.name + ': use');
    assert.ok(Array.isArray(c.pinned) && c.pinned.length, c.name + ': pinned');
    for (const f of c.pinned) {
      assert.ok(fs.existsSync(path.join(root, f)), `${c.name}: ${f} gibt es nicht`);
      assert.ok(read(f).includes(c.version), `${c.name}: ${c.version} steht nicht in ${f}`);
    }
  }
});

test('Docker-Image und Bun wie im Dockerfile', () => {
  const froms = [...read('Dockerfile').matchAll(/^FROM\s+(\S+)/gm)].map(m => m[1]);
  assert.ok(froms.length > 0, 'kein FROM im Dockerfile');
  for (const ref of froms) {
    const [name, tag] = ref.split(':');
    const c = byName(name);
    assert.ok(c, `${name} fehlt in versions.json`);
    assert.equal(c.version, tag, `${name}: Version`);
  }
  const image = byName('oven/bun');
  assert.equal(image.version.split('-')[0], byName('bun').version, 'Bun im Image und Bun in versions.json');
});

test('Bun, Node und GitHub Actions wie in den Workflows', () => {
  const bun = byName('bun').version;
  const node = byName('node').version;
  const actions = new Map();
  for (const f of WORKFLOWS) {
    const yml = read(f);
    for (const m of yml.matchAll(/bun-version:\s*['"]?([\w.]+)/g)) assert.equal(m[1], bun, f + ': bun-version');
    for (const m of yml.matchAll(/node-version:\s*['"]?([\w.]+)/g)) assert.equal(m[1], node, f + ': node-version');
    for (const m of yml.matchAll(/uses:\s*([\w.-]+\/[\w.-]+)@([\w.-]+)/g)) actions.set(m[1], (actions.get(m[1]) || new Set()).add(m[2]));
  }
  for (const [name, versions] of actions) {
    const c = byName(name);
    assert.ok(c, `${name} fehlt in versions.json`);
    assert.deepEqual([...versions], [c.version], `${name}: überall dieselbe Version wie in versions.json`);
  }
  const listed = info.components.filter(c => c.type === 'github-action').map(c => c.name);
  for (const name of listed) assert.ok(actions.has(name), `${name} steht in versions.json, wird aber nicht benutzt`);
});

test('Keine npm-Pakete, wie in versions.json', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const k of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.deepEqual(Object.keys(pkg[k] || {}), info.packages.npm.map(p => p.name), 'package.json: ' + k);
  }
  assert.ok(!fs.existsSync(path.join(root, 'bun.lock')) && !fs.existsSync(path.join(root, 'package-lock.json')), 'Lockfile ohne Pakete?');
});

test('Das Image bekommt /versions.json, ausgeliefert wird sie nie', () => {
  const docker = read('Dockerfile');
  assert.match(docker, /COPY versions\.json /);
  assert.match(docker, /RUN bun server\/versions\.js \S+ \/versions\.json/);
  const main = read('server/main.js');
  const list = src => JSON.parse(main.match(new RegExp(`const ${src} = (\\[[^\\]]*\\])`))[1].replace(/'/g, '"'));
  assert.ok(!list('PUBLIC_FILES').some(f => /versions/.test(f)), 'versions.json darf nicht in PUBLIC_FILES stehen');
  assert.ok(!list('PUBLIC_DIRS').includes(''), 'kein leerer Ordner in PUBLIC_DIRS');
});
