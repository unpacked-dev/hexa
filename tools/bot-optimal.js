/* HEXA – das perfekte Spiel ausrechnen (nur zum Vergleich, wird nicht mit ausgeliefert).
   Geht jeden Spielstand durch: welche Felder frei sind und wie viele Punkte oben schon stehen.
   Für jeden Stand steht danach fest, wie viele Punkte bei bestem Spiel im Schnitt noch kommen.
   Aufruf: node tools/bot-optimal.js [Datei]   (Standard: tools/out/optimal.bin, ca. 9 MB) */
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const Bot = require('../js/bot.js');

const { ALL, UP, CAP, NF } = Bot;
const W = CAP + 1;   // Punkte oben: 0 bis 70

// Welche Summen oben sind möglich, wenn genau diese oberen Felder schon gefüllt sind?
function reachable() {
  const out = [];
  for (let filled = 0; filled < 1 << UP; filled++) {
    let sums = new Set([0]);
    for (let f = 0; f < UP; f++) {
      if (!((filled >> f) & 1)) continue;
      const next = new Set();
      sums.forEach(s => { for (let c = 0; c <= 6; c++) next.add(Math.min(CAP, s + c * (f + 1))); });
      sums = next;
    }
    out.push([...sums].sort((a, b) => a - b));
  }
  return out;
}

const popcount = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

if (isMainThread) {
  const file = process.argv[2] || path.join(__dirname, 'out', 'optimal.bin');
  const shared = new SharedArrayBuffer((ALL + 1) * W * 8);
  const V = new Float64Array(shared);
  const reach = reachable();
  const layers = Array.from({ length: NF + 1 }, () => []);
  for (let m = 1; m <= ALL; m++) layers[popcount(m)].push(m);
  const states = layers.reduce((n, l) => n + l.reduce((s, m) => s + reach[~m & ((1 << UP) - 1)].length, 0), 0);
  const n = Math.max(1, os.cpus().length);
  console.log(`${states.toLocaleString('de-DE')} Spielstände, ${n} Threads`);
  const workers = Array.from({ length: n }, () => new Worker(__filename, { workerData: { shared } }));
  const t0 = Date.now();
  (async () => {
    for (let p = 1; p <= NF; p++) {
      const masks = layers[p];
      await Promise.all(workers.map((w, i) => new Promise(res => {
        w.once('message', res);
        w.postMessage(masks.filter((_, j) => j % n === i));
      })));
    }
    workers.forEach(w => w.terminate());
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(new Float32Array(V).buffer));
    console.log(`fertig in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    console.log(`Perfektes Spiel ohne Countdown: ${V[ALL * W].toFixed(3)} Punkte im Schnitt`);
    console.log(`gespeichert: ${file}`);
  })();
} else {
  const V = new Float64Array(workerData.shared);
  const reach = reachable();
  const value = (m, u) => V[m * W + u];
  parentPort.on('message', masks => {
    for (const m of masks) {
      for (const u of reach[~m & ((1 << UP) - 1)]) V[m * W + u] = Bot.solve(m, u, value);
    }
    parentPort.postMessage(true);
  });
}
