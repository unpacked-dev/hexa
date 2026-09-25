/* HEXA – Bots simulieren: Strategien spielen viele Partien allein, danach gibt es die Zahlen.
   Aufruf: node tools/bot-sim.js [Spiele] [Strategien]
   Strategien: bot (js/bot.js), perfekt (braucht tools/out/optimal.bin aus tools/bot-optimal.js),
               kandidat (Werte aus tools/out/fit.json von tools/bot-fit.js),
               einfach (hält immer die häufigste Zahl und nimmt das Feld mit den meisten Punkten)
   Beispiel:   node tools/bot-sim.js 100000 bot,perfekt,einfach
   Alle Strategien bekommen dieselben Startwürfel (gleicher Zufall je Spielnummer). */
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const Rules = require('../js/rules.js');
const Bot = require('../js/bot.js');

const { FIELDS, BONUS_MIN, BONUS_PTS, scoreFor, countFaces } = Rules;
const { NF, ALL, UP, CAP } = Bot;
const OPTIMAL = path.join(__dirname, 'out', 'optimal.bin');

// Schneller, reproduzierbarer Zufall (sfc32)
function random(seed) {
  let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = seed >>> 0;
  const next = () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 16; i++) next();
  return next;
}

function strategy(name) {
  if (name === 'bot' || name === 'perfekt' || name === 'kandidat') {
    let value;
    if (name === 'perfekt') {
      const T = new Float32Array(fs.readFileSync(OPTIMAL).buffer.slice(0));
      value = (m, u) => T[m * (CAP + 1) + u];
    }
    // kandidat: Schätzwerte aus tools/out/fit.json (von tools/bot-fit.js), noch nicht in js/bot.js
    if (name === 'kandidat') value = Bot.makeEstimate(JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'fit.json'), 'utf8')));
    return {
      begin: (free, up) => Bot.solve(free, Math.min(CAP, up), value || Bot.estimate),
      hold: (vals, left) => Bot.keep(vals, left),
      pick: (free, up, vals) => Bot.pickFor(free, up, vals, value),
    };
  }
  if (name === 'einfach') {
    return {
      begin: () => {},
      hold: vals => {
        const c = countFaces(vals);
        let face = 6;
        for (let v = 5; v >= 1; v--) if (c[v] > c[face]) face = v;
        return vals.map(v => v === face);
      },
      pick: (free, up, vals) => {
        let best = -1;
        let m = -1;
        for (let f = 0; f < NF; f++) {
          if (!((free >> f) & 1)) continue;
          const s = scoreFor(FIELDS[f].key, vals);
          if (s > m) { m = s; best = f; }
        }
        return best;
      },
    };
  }
  throw new Error('Unbekannte Strategie: ' + name);
}

function countdown(r) {
  let pts = 0;
  for (let n = 6; n >= 1; n--) {
    let hit = false;
    for (let i = 0; i < n; i++) if (1 + Math.floor(r() * 6) === n) hit = true;
    if (!hit) break;
    pts += 10;
  }
  return pts;
}

function emptyStats() {
  return {
    games: 0, sum: 0, sumSq: 0, hist: new Array(800).fill(0), bonus: 0, upper: 0,
    cd: 0, cdCount: 0, field: new Array(NF).fill(0), hit: new Array(NF).fill(0),
    upCount: Array.from({ length: UP }, () => new Array(7).fill(0)),
  };
}

function play(st, seed, S) {
  const r = random(seed);
  const d6 = () => 1 + Math.floor(r() * 6);
  let free = ALL;
  let up = 0;
  let total = 0;
  for (let turn = 0; turn < NF; turn++) {
    let vals = [d6(), d6(), d6(), d6(), d6(), d6()];
    const cd = Math.max(...countFaces(vals)) >= 4;
    st.begin(free, up);
    for (let left = 2; left >= 1; left--) {
      const held = st.hold(vals, left);
      if (held.every(Boolean)) break;
      vals = vals.map((v, i) => (held[i] ? v : d6()));
    }
    const f = st.pick(free, up, vals);
    const s = scoreFor(FIELDS[f].key, vals);
    free &= ~(1 << f);
    total += s;
    S.field[f] += s;
    if (s > 0) S.hit[f]++;
    if (f < UP) { up += s; S.upCount[f][s / (f + 1)]++; }
    if (cd) { const p = countdown(r); total += p; S.cd += p; S.cdCount++; }
  }
  if (up >= BONUS_MIN) { total += BONUS_PTS; S.bonus++; }
  S.upper += up;
  S.games++;
  S.sum += total;
  S.sumSq += total * total;
  S.hist[Math.min(799, total)]++;
}

function merge(a, b) {
  const add = (x, y) => (Array.isArray(x) ? x.map((v, i) => add(v, y[i])) : x + y);
  Object.keys(a).forEach(k => { a[k] = add(a[k], b[k]); });
  return a;
}

function report(name, S, ms) {
  const n = S.games;
  const mean = S.sum / n;
  const sd = Math.sqrt(S.sumSq / n - mean * mean);
  const pct = q => { let acc = 0; for (let i = 0; i < S.hist.length; i++) { acc += S.hist[i]; if (acc >= q * n) return i; } return 0; };
  const atLeast = x => S.hist.slice(x).reduce((s, v) => s + v, 0) / n;
  const de = (v, d = 1) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  console.log(`\n== ${name}: ${n.toLocaleString('de-DE')} Spiele (${de(ms / 1000, 0)} s)`);
  console.log(`Schnitt ${de(mean)} Punkte (± ${de(1.96 * sd / Math.sqrt(n), 2)}), Streuung ${de(sd)}`);
  console.log(`Median ${pct(0.5)}, 10 % der Spiele unter ${pct(0.1)}, 10 % über ${pct(0.9)}, bestes ${S.hist.reduce((m, v, i) => (v ? i : m), 0)}`);
  console.log(`mindestens 300: ${de(atLeast(300) * 100)} % · Bonus: ${de(S.bonus / n * 100)} % · oben im Schnitt ${de(S.upper / n)}`);
  console.log(`Countdown: ${de(S.cdCount / n, 2)} pro Spiel, ${de(S.cd / n)} Punkte pro Spiel`);
  console.log('Feld: Schnitt · geschafft');
  FIELDS.forEach((f, i) => console.log(`  ${f.key.padEnd(10)} ${de(S.field[i] / n).padStart(5)} · ${de(S.hit[i] / n * 100, 0).padStart(3)} %`));
}

if (isMainThread) {
  const games = Number(process.argv[2]) || 10000;
  const names = (process.argv[3] || 'bot').split(',');
  const threads = Math.max(1, os.cpus().length);
  (async () => {
    const out = {};
    for (const name of names) {
      const t0 = Date.now();
      const parts = await Promise.all(Array.from({ length: threads }, (_, i) => new Promise((res, rej) => {
        const from = Math.floor(games * i / threads);
        const to = Math.floor(games * (i + 1) / threads);
        const w = new Worker(__filename, { workerData: { name, from, to } });
        w.once('message', res);
        w.once('error', rej);
      })));
      const S = parts.reduce(merge);
      report(name, S, Date.now() - t0);
      out[name] = S;
    }
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'out', 'sim.json'), JSON.stringify(out));
  })();
} else {
  const { name, from, to } = workerData;
  const st = strategy(name);
  const S = emptyStats();
  for (let g = from; g < to; g++) play(st, 0x5eed + g * 7919, S);
  parentPort.postMessage(S);
}
