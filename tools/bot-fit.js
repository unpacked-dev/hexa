/* HEXA – Schätzwerte für die Bots aus dem perfekten Spiel ableiten.
   1. Spielt viele Partien perfekt (braucht tools/out/optimal.bin) und merkt sich die Spielstände.
   2. Zählt, mit wie vielen passenden Würfeln die oberen Felder gefüllt werden.
   3. Passt die Werte in js/bot.js (field, bonus) so an, dass sie das perfekte Spiel möglichst gut treffen.
   Aufruf: node tools/bot-fit.js [Spiele]   Ergebnis: tools/out/fit.json */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const Rules = require('../js/rules.js');
const Bot = require('../js/bot.js');

const { FIELDS, scoreFor, countFaces } = Rules;
const { NF, ALL, UP, CAP } = Bot;
const W = CAP + 1;
const T = new Float32Array(fs.readFileSync(path.join(__dirname, 'out', 'optimal.bin')).buffer.slice(0));
const value = (m, u) => T[m * W + u];

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

// 1. Perfekt spielen und mitschreiben
const games = Number(process.argv[2]) || 20000;
const visits = new Map();
const upCount = Array.from({ length: UP }, () => new Array(7).fill(0));
for (let g = 0; g < games; g++) {
  const r = random(0xf17 + g * 104729);
  const d6 = () => 1 + Math.floor(r() * 6);
  let free = ALL;
  let up = 0;
  for (let turn = 0; turn < NF; turn++) {
    const key = free * W + Math.min(CAP, up);
    visits.set(key, (visits.get(key) || 0) + 1);
    let vals = [d6(), d6(), d6(), d6(), d6(), d6()];
    Bot.solve(free, Math.min(CAP, up), value);
    for (let left = 2; left >= 1; left--) {
      const held = Bot.keep(vals, left);
      if (held.every(Boolean)) break;
      vals = vals.map((v, i) => (held[i] ? v : d6()));
    }
    const f = Bot.pickFor(free, up, vals, value);
    const s = scoreFor(FIELDS[f].key, vals);
    free &= ~(1 << f);
    if (f < UP) { up += s; upCount[f][s / (f + 1)]++; }
  }
}
const up = upCount.map(row => { const n = row.reduce((a, b) => a + b, 0); return row.map(x => x / n); });

// 2. Merkmale je Spielstand, in derselben Reihenfolge wie makeEstimate in js/bot.js:
//    freie Felder, freie Paare, Bonus-Chance (mal 1, mal Felder unten, mal deren Quadrat), Punkte oben
const { PAIRS } = Bot;
const chanceOf = Bot.makeEstimate({ field: new Array(NF).fill(0), bonus: [1, 0, 0], upper: 0, up });
function feats(m, u) {
  const x = [];
  let low = 0;
  for (let f = 0; f < NF; f++) { const on = (m >> f) & 1; x.push(on); if (on && f >= UP) low++; }
  for (const [i, j] of PAIRS) x.push((m >> i) & (m >> j) & 1);
  const b = chanceOf(m, u);   // 40 × Bonus-Chance, 0 wenn der Bonus schon sicher ist
  x.push(b, b * low, b * low * low, u < CAP ? u / CAP : 0);
  return x;
}
const rows = [];
function addRow(m, u, w) { rows.push({ x: feats(m, u), y: value(m, u), w }); }
visits.forEach((w, key) => {
  const m = Math.floor(key / W);
  const u = key % W;
  addRow(m, u, w);
  // Auch die Stände direkt nach jeder möglichen Wahl, denn genau die vergleicht der Bot.
  for (let f = 0; f < NF; f++) {
    if (!((m >> f) & 1)) continue;
    const rest = m & ~(1 << f);
    if (f < UP) for (let c = 0; c <= 6; c++) addRow(rest, Math.min(CAP, u + c * (f + 1)), w * up[f][c]);
    else addRow(rest, u, w);
  }
});

// 3. Gewichtete kleinste Quadrate (Normalgleichungen)
const K = rows[0].x.length;
const A = Array.from({ length: K }, () => new Float64Array(K + 1));
rows.forEach(({ x, y, w }) => {
  for (let i = 0; i < K; i++) {
    if (!x[i]) continue;
    const wi = w * x[i];
    for (let j = 0; j < K; j++) A[i][j] += wi * x[j];
    A[i][K] += wi * y;
  }
});
for (let i = 0; i < K; i++) A[i][i] += 1e-6;   // gegen Paare, die nie zusammen frei vorkommen
for (let i = 0; i < K; i++) {
  let p = i;
  for (let r = i + 1; r < K; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
  [A[i], A[p]] = [A[p], A[i]];
  for (let r = 0; r < K; r++) {
    if (r === i) continue;
    const q = A[r][i] / A[i][i];
    if (!q) continue;
    for (let c = i; c <= K; c++) A[r][c] -= q * A[i][c];
  }
}
const coef = A.map((row, i) => row[K] / row[i]);
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const params = {
  field: coef.slice(0, NF).map(v => round(v, 2)),
  pair: coef.slice(NF, NF + PAIRS.length).map(v => round(v, 2)),
  bonus: coef.slice(NF + PAIRS.length, NF + PAIRS.length + 3).map(v => round(v, 4)),
  upper: round(coef[K - 1], 2),
  up: up.map(row => row.map(v => round(v, 4))),
};
let err = 0;
let wsum = 0;
const est = Bot.makeEstimate(params);
visits.forEach((w, key) => {
  const d = est(Math.floor(key / W), key % W) - value(Math.floor(key / W), key % W);
  err += w * d * d;
  wsum += w;
});
console.log(`${visits.size.toLocaleString('de-DE')} verschiedene Spielstände aus ${games.toLocaleString('de-DE')} perfekten Spielen`);
console.log(`Abweichung vom perfekten Wert: im Mittel ${Math.sqrt(err / wsum).toFixed(2)} Punkte`);
fs.writeFileSync(path.join(__dirname, 'out', 'fit.json'), JSON.stringify(params));
