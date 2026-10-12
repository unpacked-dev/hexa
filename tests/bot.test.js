/* Tests für die Bots. Ausführen mit: node --test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { FIELDS, scoreFor } = require('../js/rules.js');
const Bot = require('../js/bot.js');

const ALL_KEYS = FIELDS.map(f => f.key);
const dice = s => s.split('').map(Number);
const without = (...keys) => ALL_KEYS.filter(k => !keys.includes(k));
const kept = (vals, held) => vals.filter((_, i) => held[i]).sort().join('');

test('Würfelhaufen: 924 insgesamt, 462 mit sechs Würfeln, Wahrscheinlichkeiten ergeben 1', () => {
  assert.equal(Bot.NK, 924);
  assert.equal(Bot.FULL.length, 462);
  const p = Bot.FULL.reduce((s, k) => s + Bot.PROB[k], 0);
  assert.ok(Math.abs(p - 1) < 1e-12);
});

test('Drei Sechsen am Anfang: Die Sechsen bleiben liegen', () => {
  const vals = dice('666231');
  assert.equal(kept(vals, Bot.hold(ALL_KEYS, 0, vals, 2)), '666');
});

test('1-2-3-4-5 und eine 2: Die Straße bleibt liegen, eine 2 wird nachgewürfelt', () => {
  const vals = dice('123452');
  assert.equal(kept(vals, Bot.hold(ALL_KEYS, 0, vals, 2)), '12345');
});

test('Große Straße im ersten Wurf: aufhören und Große Straße eintragen', () => {
  const vals = dice('162534');
  assert.ok(Bot.hold(ALL_KEYS, 0, vals, 2).every(Boolean));
  assert.equal(Bot.pick(ALL_KEYS, 0, vals), 'gstrasse');
});

test('Sechs gleiche: Sechserpasch', () => {
  assert.equal(Bot.pick(ALL_KEYS, 0, dice('444444')), 'pasch6');
});

test('Passt nichts, streicht der Bot lieber den Sechserpasch als die Chance', () => {
  const free = without('u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'tief', 'hoch', 'kstrasse');
  const vals = dice('112456');
  assert.equal(scoreFor('pasch6', vals), 0);
  assert.equal(Bot.pick(free, 70, vals), 'pasch6');
});

test('Es wird nur ein freies Feld gewählt', () => {
  assert.equal(Bot.pick(['chance'], 40, dice('111111')), 'chance');
  assert.equal(Bot.pick(['u2', 'tief'], 40, dice('666666')), 'u2');
});

// Partien ohne Countdown. level und salt wie in der App, gleiche Würfel für alle Stufen.
function average(games, level) {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const d6 = () => 1 + Math.floor(rnd() * 6);
  let total = 0;
  for (let g = 0; g < games; g++) {
    const salt = Bot.saltOf('spiel-' + g);
    let free = ALL_KEYS.slice();
    let upper = 0;
    while (free.length) {
      let vals = [d6(), d6(), d6(), d6(), d6(), d6()];
      for (let left = 2; left >= 1; left--) {
        const held = Bot.hold(free, upper, vals, left, level, salt);
        if (held.every(Boolean)) break;
        vals = vals.map((v, i) => (held[i] ? v : d6()));
      }
      const key = Bot.pick(free, upper, vals, level, salt);
      assert.ok(free.includes(key), level + ': nur freie Felder');
      const s = scoreFor(key, vals);
      if (key[0] === 'u') upper += s;
      total += s;
      free = free.filter(k => k !== key);
    }
    if (upper >= 70) total += 40;
  }
  return total / games;
}

test('Stufen: leicht < mittel < schwer, mit deutlichem Abstand', () => {
  const [easy, medium, hard] = ['easy', 'medium', 'hard'].map(l => average(150, l));
  assert.ok(easy + 25 < medium, `leicht ${easy.toFixed(1)}, mittel ${medium.toFixed(1)}`);
  assert.ok(medium + 20 < hard, `mittel ${medium.toFixed(1)}, schwer ${hard.toFixed(1)}`);
  assert.ok(easy > 180, 'leicht spielt nicht völlig planlos: ' + easy.toFixed(1));
});

test('Stufen: Dieselbe Lage gibt dieselbe Entscheidung, ohne Stufe spielt der Bot schwer', () => {
  assert.deepEqual(Bot.LEVELS, ['easy', 'medium', 'hard']);
  for (const x of [undefined, null, 'quatsch', 'constructor', '__proto__']) assert.equal(Bot.levelOf(x), 'hard');
  const vals = dice('112345');
  for (const level of Bot.LEVELS) {
    for (let salt = 0; salt < 30; salt++) {
      assert.deepEqual(Bot.hold(ALL_KEYS, 10, vals, 2, level, salt), Bot.hold(ALL_KEYS, 10, vals, 2, level, salt));
      assert.equal(Bot.pick(ALL_KEYS, 10, vals, level, salt), Bot.pick(ALL_KEYS, 10, vals, level, salt));
    }
  }
  assert.deepEqual(Bot.hold(ALL_KEYS, 0, vals, 2, 'hard', 7), Bot.hold(ALL_KEYS, 0, vals, 2));
  assert.equal(Bot.pick(ALL_KEYS, 0, vals, 'hard', 7), Bot.pick(ALL_KEYS, 0, vals));
  // Leichte Bots entscheiden je nach Spiel verschieden
  const holds = new Set();
  for (let salt = 0; salt < 60; salt++) holds.add(kept(vals, Bot.hold(ALL_KEYS, 0, vals, 2, 'easy', salt)));
  assert.ok(holds.size > 2, 'nur ' + [...holds].join(', '));
});

test('Bots spielen gut: 300 Partien kommen im Schnitt über 300 Punkte', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const d6 = () => 1 + Math.floor(rnd() * 6);
  let total = 0;
  for (let g = 0; g < 300; g++) {
    let free = ALL_KEYS.slice();
    let upper = 0;
    let sum = 0;
    while (free.length) {
      let vals = [d6(), d6(), d6(), d6(), d6(), d6()];
      for (let left = 2; left >= 1; left--) {
        const held = Bot.hold(free, upper, vals, left);
        if (held.every(Boolean)) break;
        vals = vals.map((v, i) => (held[i] ? v : d6()));
      }
      const key = Bot.pick(free, upper, vals);
      assert.ok(free.includes(key));
      const s = scoreFor(key, vals);
      if (key[0] === 'u') upper += s;
      sum += s;
      free = free.filter(k => k !== key);
    }
    total += sum + (upper >= 70 ? 40 : 0);
  }
  assert.ok(total / 300 > 300, 'Schnitt ' + (total / 300).toFixed(1));
});
