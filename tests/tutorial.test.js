// Tests für das Tutorial (js/tutorial.js): Gehen die festen Würfe so auf, wie Pip es erzählt?
// Die Schritte werden hier mit der echten Wertung (js/rules.js) nachgespielt.
const test = require('node:test');
const assert = require('node:assert/strict');
const Tut = require('../js/tutorial.js');
const { scoreFor, countFaces, F, BONUS_MIN, sum } = require('../js/rules.js');
const de = require('../lang/de.js');
const en = require('../lang/en.js');

const lookup = (dict, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);
const UNTIL = ['next', 'roll', 'hold', 'pick', 'enter', 'tab', 'zeros', 'cdRoll', 'cdSave', 'end'];

// Spielt alle Schritte nach und gibt zurück, was dabei herauskommt
function replay() {
  const out = { scores: {}, cds: [], firstMax: {}, picks: [] };
  let vals = null;
  let held = [false, false, false, false, false, false];
  let rolls = 0;
  let key = null;
  let cd = null;
  for (const [i, s] of Tut.STEPS.entries()) {
    const at = `Schritt ${i} (${s.text})`;
    if (s.until === 'roll') {
      const slots = [0, 1, 2, 3, 4, 5].filter(k => !rolls || !held[k]);
      assert.equal(s.dice.length, slots.length, `${at}: so viele Zahlen, wie Würfel neu fallen`);
      assert.ok(rolls < 3, `${at}: höchstens 3 Würfe`);
      vals = vals ? vals.slice() : [0, 0, 0, 0, 0, 0];
      slots.forEach((k, j) => { vals[k] = s.dice[j]; });
      if (!rolls) {
        held = [false, false, false, false, false, false];
        out.firstMax[s.turn] = Math.max(...countFaces(vals));
      }
      rolls++;
    } else if (s.until === 'hold') {
      assert.ok(rolls > 0 && rolls < 3, `${at}: halten geht nur zwischen den Würfen`);
      // Was schon liegt, muss liegen bleiben: Antippen darf man nur die neuen Würfel.
      held.forEach((h, k) => { if (h) assert.ok(s.hold.includes(k), `${at}: Würfel ${k} liegt schon`); });
      assert.ok(s.hold.some(k => !held[k]), `${at}: mindestens ein neuer Würfel`);
      held = held.map((h, k) => s.hold.includes(k));
    } else if (s.until === 'pick') {
      assert.ok(F[s.key], `${at}: Feld ${s.key}`);
      assert.equal(out.scores[s.key], undefined, `${at}: ${s.key} ist noch frei`);
      key = s.key;
      out.picks.push({ text: s.text, key, pts: scoreFor(key, vals) });
    } else if (s.until === 'enter') {
      assert.ok(key, `${at}: vorher ein Feld gewählt`);
      out.scores[key] = scoreFor(key, vals);
      if (out.firstMax[s.turn] >= 4) cd = { stage: 0, pts: 0, over: false };
      key = null;
      vals = null;
      rolls = 0;
    } else if (s.until === 'cdRoll') {
      assert.ok(cd && !cd.over, `${at}: Countdown läuft`);
      const n = 6 - cd.stage;
      assert.equal(s.dice.length, n, `${at}: Stufe ${cd.stage + 1} würfelt mit ${n} Würfeln`);
      if (s.dice.includes(n)) { cd.stage++; cd.pts += 10; } else cd.over = true;
    } else if (s.until === 'cdSave') {
      assert.ok(cd && cd.over, `${at}: Countdown vorbei`);
      out.cds.push(cd.pts);
      cd = null;
    }
  }
  return out;
}

test('Jeder Schritt ist vollständig', () => {
  Tut.STEPS.forEach((s, i) => {
    const at = `Schritt ${i}`;
    assert.ok(UNTIL.includes(s.until), `${at}: until ${s.until}`);
    assert.ok(Number.isInteger(s.turn) && s.turn >= 0 && s.turn <= Tut.TURNS + 1, `${at}: turn`);
    if (s.pose) assert.ok(Tut.POSES[s.pose], `${at}: Pose ${s.pose}`);
    if (s.until === 'tab') assert.ok(['dice', 'block'].includes(s.tab), `${at}: Tab`);
    if (['roll', 'pick', 'enter', 'tab', 'zeros', 'cdRoll', 'cdSave'].includes(s.until)) assert.ok(s.tap && s.tap.length, `${at}: etwas zum Antippen`);
    if (s.dice) assert.ok(s.dice.every(v => Number.isInteger(v) && v >= 1 && v <= 6), `${at}: Augenzahlen`);
  });
  assert.equal(Tut.STEPS[0].until, 'next', 'Pip stellt sich zuerst vor');
  assert.equal(Tut.STEPS[Tut.STEPS.length - 1].until, 'end', 'am Ende stehen die Knöpfe für danach');
  assert.equal(Math.max(...Tut.STEPS.map(s => s.turn)), Tut.TURNS + 1);
});

test('Jeder Text steht auf Deutsch und Englisch da, mit denselben Platzhaltern', () => {
  const holes = t => [...String(t).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const s of Tut.STEPS) {
    for (const k of [s.text, s.go].filter(Boolean)) {
      assert.equal(typeof lookup(de, k), 'string', 'de: ' + k);
      assert.equal(typeof lookup(en, k), 'string', 'en: ' + k);
      assert.deepEqual(holes(lookup(en, k)), holes(lookup(de, k)), k);
    }
  }
});

test('Die festen Würfe gehen auf: 20, 40, 28, 40 und ein Countdown mit 20', () => {
  const r = replay();
  assert.deepEqual(r.scores, { u5: 20, gstrasse: 40, chance: 28, pasch5: 40 });
  assert.deepEqual(r.cds, [20]);
  assert.ok(r.scores.u5 < BONUS_MIN, 'kein Bonus, oben fehlen am Ende noch 50');
  assert.equal(sum(Object.values(r.scores)) + sum(r.cds), 148, 'Endstand');
});

test('Countdown gibt es nur in Zug 4', () => {
  const r = replay();
  assert.ok(r.firstMax[1] < 4 && r.firstMax[2] < 4 && r.firstMax[3] < 4, 'Zug 1 bis 3 ohne 4 gleiche im ersten Wurf');
  assert.ok(r.firstMax[4] >= 4, 'Zug 4 mit 4 gleichen im ersten Wurf');
});

test('Was Pip beim Eintragen verspricht, steht auch im Block', () => {
  for (const p of replay().picks) {
    assert.ok(p.pts > 0, p.key);
    for (const t of [de, en]) assert.match(lookup(t, p.text), new RegExp(`\\b${p.pts}\\b`), `${p.text}: ${p.pts} Punkte`);
  }
});

test('Pip gibt es in jeder Pose', () => {
  for (const pose of Object.keys(Tut.POSES)) {
    const svg = Tut.pip(pose);
    assert.match(svg, /^<svg class="pip /, pose);
    assert.match(svg, /class="pp-b"/, pose);
    assert.match(svg, /class="pp-e"/, pose + ': Rand wie ein Aufkleber');
  }
  assert.match(Tut.pip('point'), /class="pp-aim"/, 'Zeigen: Der Arm dreht sich zum Ziel');
});
