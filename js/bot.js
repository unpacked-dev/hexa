/* HEXA – Computergegner (Bots): Welche Würfel bleiben liegen, welches Feld wird eingetragen?
   Innerhalb eines Zugs rechnet der Bot exakt: Für jede Möglichkeit, Würfel liegen zu lassen,
   kennt er die Wahrscheinlichkeit jedes Endergebnisses. Was ein Feld für den Rest des Spiels
   noch wert ist, schätzt er mit Werten, die aus dem perfekten Spiel abgeleitet sind
   (tools/bot-optimal.js und tools/bot-fit.js). In 100.000 Testspielen (tools/bot-sim.js) holt er
   im Schnitt 322,5 Punkte, perfektes Spiel 323,7.
   Der Countdown braucht keine Entscheidung: Er hängt nur am ersten Wurf, den immer alle sechs Würfel machen.
   Läuft im Browser (window.HexaBot), in Node (Tests, Simulation) und in Deno (Server). */
(function (root) {
  'use strict';

  const Rules = typeof module === 'object' && module.exports ? require('./rules.js') : root.HexaRules;
  const { FIELDS, BONUS_MIN, BONUS_PTS, scoreFor } = Rules;
  const NF = FIELDS.length;
  const ALL = (1 << NF) - 1;   // Bitmaske: alle Felder frei
  const UP = 6;                // Die ersten sechs Felder sind der obere Block.
  const CAP = BONUS_MIN;       // Mehr als 70 oben ändert am Bonus nichts mehr.

  /* ---------- Würfel als Haufen: nur wie oft jede Augenzahl vorkommt ---------- */
  // Alle Haufen mit 0 bis 6 Würfeln: 924 Stück, davon 462 mit allen sechs Würfeln.
  const COUNTS = [];
  const SIZE = [];
  const IDX = new Int16Array(117649).fill(-1);   // 7^6 mögliche Zählungen
  const codeOf = c => c[0] + 7 * c[1] + 49 * c[2] + 343 * c[3] + 2401 * c[4] + 16807 * c[5];
  (function build(c, i, left) {
    if (i === 6) {
      IDX[codeOf(c)] = COUNTS.length;
      COUNTS.push(c.slice());
      SIZE.push(6 - left);
      return;
    }
    for (let k = 0; k <= left; k++) { c[i] = k; build(c, i + 1, left - k); }
    c[i] = 0;
  })([0, 0, 0, 0, 0, 0], 0, 6);
  const NK = COUNTS.length;

  // Große Haufen zuerst, damit beim Auffüllen der größere schon berechnet ist.
  const ORDER = Array.from({ length: NK }, (_, k) => k).sort((a, b) => SIZE[b] - SIZE[a]);
  const FULL = ORDER.filter(k => SIZE[k] === 6);

  // ADD[k*6+i]: derselbe Haufen mit einem Würfel mehr, der i+1 zeigt
  const ADD = new Int16Array(NK * 6).fill(-1);
  COUNTS.forEach((c, k) => {
    if (SIZE[k] === 6) return;
    for (let i = 0; i < 6; i++) {
      const d = c.slice();
      d[i]++;
      ADD[k * 6 + i] = IDX[codeOf(d)];
    }
  });

  const FACT = [1, 1, 2, 6, 24, 120, 720];
  const PROB = new Float64Array(NK);   // Wahrscheinlichkeit eines Wurfs mit allen sechs Würfeln
  FULL.forEach(k => { PROB[k] = COUNTS[k].reduce((p, n) => p / FACT[n], 720) / 46656; });

  // Alle Teil-Haufen eines vollen Haufens: das sind die Möglichkeiten, Würfel liegen zu lassen.
  const SUB_OFF = new Int32Array(NK + 1);
  const SUB = [];
  COUNTS.forEach((c, k) => {
    SUB_OFF[k] = SUB.length;
    if (SIZE[k] !== 6) return;
    (function sub(d, i) {
      if (i === 6) { SUB.push(IDX[codeOf(d)]); return; }
      for (let n = 0; n <= c[i]; n++) { d[i] = n; sub(d, i + 1); }
    })([0, 0, 0, 0, 0, 0], 0);
  });
  SUB_OFF[NK] = SUB.length;
  const SUBS = Int16Array.from(SUB);

  const valsOf = c => c.flatMap((n, i) => Array(n).fill(i + 1));
  // SCORE[f*NK+k]: Punkte im Feld f für den vollen Haufen k
  const SCORE = new Int16Array(NF * NK);
  FULL.forEach(k => {
    const vals = valsOf(COUNTS[k]);
    FIELDS.forEach((f, i) => { SCORE[i * NK + k] = scoreFor(f.key, vals); });
  });

  /* ---------- Einen Zug durchrechnen ---------- */
  const F0 = new Float64Array(NK);  // Wert eines Endergebnisses (kein Wurf mehr)
  const K0 = new Float64Array(NK);  // Erwartung, wenn dieser Haufen liegen bleibt und noch 1 Wurf kommt
  const F1 = new Float64Array(NK);  // Wert eines Wurfs, nach dem noch 1 Wurf bleibt
  const K1 = new Float64Array(NK);  // Erwartung, wenn noch 2 Würfe kommen
  const F2 = new Float64Array(NK);

  function fill(K, F) {
    for (const k of ORDER) {
      if (SIZE[k] === 6) { K[k] = F[k]; continue; }
      const b = k * 6;
      K[k] = (K[ADD[b]] + K[ADD[b + 1]] + K[ADD[b + 2]] + K[ADD[b + 3]] + K[ADD[b + 4]] + K[ADD[b + 5]]) / 6;
    }
  }
  function best(K, F) {
    for (const d of FULL) {
      let m = -Infinity;
      for (let j = SUB_OFF[d], e = SUB_OFF[d + 1]; j < e; j++) if (K[SUBS[j]] > m) m = K[SUBS[j]];
      F[d] = m;
    }
  }

  // Was bringt jedes freie Feld, inklusive Bonus und Rest des Spiels?
  // value(frei, oben) schätzt, was das Spiel ab diesem Stand noch bringt.
  function options(free, up, value) {
    const opts = [];
    for (let f = 0; f < NF; f++) {
      if (!((free >> f) & 1)) continue;
      const rest = free & ~(1 << f);
      if (f < UP) {
        const n = f + 1;
        const g = new Float64Array(7);
        for (let c = 0; c <= 6; c++) {
          const nu = Math.min(CAP, up + c * n);
          g[c] = c * n + (up < CAP && nu >= CAP ? BONUS_PTS : 0) + value(rest, nu);
        }
        opts.push({ f, g });
      } else {
        opts.push({ f, base: f * NK, add: value(rest, up) });
      }
    }
    return opts;
  }
  function optValue(o, k) {
    return o.g ? o.g[COUNTS[k][o.f]] : SCORE[o.base + k] + o.add;
  }

  // Rechnet den ganzen Zug. Gibt die Erwartung vor dem ersten Wurf zurück.
  // Danach stehen in K0 und K1 die Werte fürs Liegenlassen.
  function solve(free, up, value) {
    const opts = options(free, up, value);
    for (const d of FULL) {
      let m = -Infinity;
      for (const o of opts) { const v = optValue(o, d); if (v > m) m = v; }
      F0[d] = m;
    }
    fill(K0, F0);
    best(K0, F1);
    fill(K1, F1);
    best(K1, F2);
    let ev = 0;
    for (const d of FULL) ev += PROB[d] * F2[d];
    return ev;
  }

  /* ---------- Schätzung für den Rest des Spiels ---------- */
  // Jedes freie Feld ist etwas wert (field), manche Paare freier Felder zusammen mehr oder weniger (pair):
  // Das Feld Chance ist zum Beispiel mehr wert, solange schwere Felder offen sind.
  // Dazu kommt die Aussicht auf den Bonus: up[f][c] sagt, wie oft ein oberes Feld mit c passenden Würfeln
  // gefüllt wird. Daraus ergibt sich für jeden Stand, wie wahrscheinlich die 70 oben noch werden.
  // Die Werte stammen aus tools/bot-fit.js und treffen das perfekte Spiel im Mittel auf etwa 2 Punkte.
  const PAIRS = [];
  for (let i = 0; i < NF; i++) for (let j = i + 1; j < NF; j++) PAIRS.push([i, j]);

  function makeEstimate(p) {
    const W = CAP + 1;
    const reach = new Float64Array(64 * W);   // Wahrscheinlichkeit, die 70 oben noch zu schaffen
    for (let m = 0; m < 64; m++) {
      let dist = new Float64Array(W);
      dist[0] = 1;
      for (let f = 0; f < UP; f++) {
        if (!((m >> f) & 1)) continue;
        const next = new Float64Array(W);
        for (let s = 0; s < W; s++) {
          if (!dist[s]) continue;
          for (let c = 0; c <= 6; c++) next[Math.min(CAP, s + c * (f + 1))] += dist[s] * p.up[f][c];
        }
        dist = next;
      }
      // Bei u Punkten oben fehlen noch 70 - u: Wie wahrscheinlich bringen die freien Felder mindestens das?
      let acc = 0;
      for (let u = 0; u < CAP; u++) {
        acc += dist[CAP - u];
        reach[m * W + u] = acc;
      }
    }
    const pair = p.pair || [];
    const [b0, b1, b2] = p.bonus;
    return (free, up) => {
      let v = 0;
      let low = 0;
      for (let f = 0; f < NF; f++) {
        if (!((free >> f) & 1)) continue;
        v += p.field[f];
        if (f >= UP) low++;
      }
      for (let k = 0; k < pair.length; k++) {
        const [i, j] = PAIRS[k];
        if ((free >> i) & (free >> j) & 1) v += pair[k];
      }
      if (up < CAP) {
        // Aussicht auf den Bonus, gewichtet danach, wie viele Felder unten noch frei sind
        v += BONUS_PTS * reach[(free & 63) * W + up] * (b0 + b1 * low + b2 * low * low) + p.upper * up / CAP;
      }
      return v;
    };
  }
  // Aus tools/bot-fit.js (60.000 perfekte Spiele). Neu erzeugen: node tools/bot-optimal.js && node tools/bot-fit.js 60000
  const PARAMS = {
    field: [9.59, 10.43, 11.21, 12.37, 13.36, 12.96, 8, 3.96, 12.71, 8.18, 14.93, 8.63, 13.14, 12.96, 29.25],
    pair: [
      -0.52, -0.06, 0.23, 0.51, 1.03, 1.52, -0.61, 1.12, 1.3, 0.53, 1.18, 0.94, 0.58, -0.47, 0.14,
      0.3, 0.55, 0.86, 1.41, 0.01, 1.11, 1.2, 0.71, 0.9, 0.61, 0.47, -0.16, 0.49, 0.65, 0.84,
      1.16, 0.51, 1.01, 1.01, 0.78, 0.73, 0.3, 0.46, 0.13, 0.92, 1.09, 0.94, 0.82, 0.87, 0.89,
      0.8, 0.66, 0.4, 0.23, 0.29, 0.92, 0.56, 1.11, 0.82, 0.79, 0.9, 0.66, 0.48, 0.18, 0.52,
      0.06, 1.56, 0.84, 0.72, 1.02, 0.77, 0.58, 0.21, 1.15, 2.75, 2.37, 1.07, 1.96, 1.44, 1.55,
      1.63, 2.23, 2.39, 1.94, 1.78, 2.21, 1.95, 1.97, 0.34, 4.12, 1.39, 1.56, 1.21, 1.24, 1.84,
      1.67, 1.46, 1.67, 1.66, 1.94, 4.02, 1.32, 1.36, 1.41, 1.43, 1.42, 1.67, 1.34, 1.25, 2.09,
    ],
    bonus: [0.5776, 0.1821, -0.0161],
    upper: -0.33,
    up: [
      [0.0329, 0.2045, 0.3015, 0.2961, 0.1491, 0.0155, 0.0004],
      [0.0138, 0.0594, 0.2686, 0.3984, 0.2264, 0.032, 0.0013],
      [0.0042, 0.0312, 0.1358, 0.4653, 0.3124, 0.0484, 0.0028],
      [0.0018, 0.0139, 0.0707, 0.4765, 0.378, 0.0553, 0.0039],
      [0.0015, 0.0083, 0.0419, 0.4275, 0.4019, 0.1145, 0.0045],
      [0.002, 0.0099, 0.0316, 0.3077, 0.4787, 0.1642, 0.0059],
    ],
  };
  const estimate = makeEstimate(PARAMS);

  /* ---------- Entscheidungen für die App ---------- */
  const KEYS = FIELDS.map(f => f.key);
  function maskOf(freeKeys) {
    let m = 0;
    freeKeys.forEach(key => { const i = KEYS.indexOf(key); if (i >= 0) m |= 1 << i; });
    return m;
  }
  const countsOf = vals => { const c = [0, 0, 0, 0, 0, 0]; vals.forEach(v => { c[v - 1]++; }); return c; };

  // Welche Würfel bleiben liegen? rollsLeft: 1 oder 2. Gibt je Würfel true (liegen lassen) zurück.
  // Bleiben alle liegen, hört der Bot auf und trägt ein.
  function holdFor(free, up, vals, rollsLeft, value) {
    solve(free, Math.min(CAP, up), value || estimate);
    return keep(vals, rollsLeft);
  }
  // Wie holdFor, nutzt aber den zuletzt mit solve() gerechneten Zug.
  function keep(vals, rollsLeft) {
    const K = rollsLeft >= 2 ? K1 : K0;
    const d = IDX[codeOf(countsOf(vals))];
    let pick = d;
    let m = -Infinity;
    for (let j = SUB_OFF[d], e = SUB_OFF[d + 1]; j < e; j++) {
      const k = SUBS[j];
      // Bei gleichem Wert lieber mehr Würfel liegen lassen, das sieht ruhiger aus.
      if (K[k] > m + 1e-9 || (Math.abs(K[k] - m) <= 1e-9 && SIZE[k] > SIZE[pick])) { m = K[k]; pick = k; }
    }
    const want = COUNTS[pick].slice();
    return vals.map(v => (want[v - 1] > 0 ? (want[v - 1]--, true) : false));
  }

  // Welches freie Feld trägt der Bot ein?
  function pickFor(free, up, vals, value) {
    const opts = options(free, Math.min(CAP, up), value || estimate);
    const d = IDX[codeOf(countsOf(vals))];
    let bestF = -1;
    let m = -Infinity;
    for (const o of opts) { const v = optValue(o, d); if (v > m + 1e-9) { m = v; bestF = o.f; } }
    return bestF;
  }

  // Namen für Bots: Wortspiele rund ums Würfeln, die auf Deutsch und Englisch klappen.
  const NAMES = [
    'Randy', 'Alea', 'Tessa', 'Dado', 'Pip', 'Rollo', 'Hexi', 'Sixtus', 'Fortuna',
    'Lady Luck', 'Mr. Chance', 'Dr. Wurf', 'Knobel-Knut', 'Pasch-Paula', 'Paschinator',
    'Würfel-Willi', 'Kubus', 'Glücks-Gustav',
  ];

  const api = {
    NAMES,
    // Für die App: Feldnamen und Punkte oben wie im Spielstand
    hold: (freeKeys, upperSum, vals, rollsLeft) => holdFor(maskOf(freeKeys), upperSum, vals, rollsLeft),
    pick: (freeKeys, upperSum, vals) => KEYS[pickFor(maskOf(freeKeys), upperSum, vals)],
    // Für Simulation und Tests
    NF, ALL, UP, CAP, NK, FULL, COUNTS, PROB,
    solve, keep, holdFor, pickFor, estimate, makeEstimate, maskOf, PAIRS,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HexaBot = api;
})(typeof self !== 'undefined' ? self : this);
