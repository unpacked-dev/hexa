/* Tests für die Wertung der Felder. Ausführen mit: node --test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { FIELDS, UPPER, LOWER, NF, BONUS_MIN, BONUS_PTS, scoreFor, countFaces } = require('../js/rules.js');

const dice = s => s.split('').map(Number);
const score = (key, s) => scoreFor(key, dice(s));

test('Spielblock hat 15 Felder: 6 oben, 9 unten', () => {
  assert.equal(NF, 15);
  assert.equal(FIELDS.length, 15);
  assert.equal(UPPER.length, 6);
  assert.equal(LOWER.length, 9);
  assert.equal(new Set(FIELDS.map(f => f.key)).size, 15);
});

test('Bonus: ab 70 Punkten oben gibt es 40 Punkte', () => {
  assert.equal(BONUS_MIN, 70);
  assert.equal(BONUS_PTS, 40);
});

test('countFaces zählt jede Augenzahl', () => {
  assert.deepEqual(countFaces(dice('124446')), [0, 1, 1, 0, 3, 0, 1]);
});

test('Oberer Block: passende Würfel zusammenzählen', () => {
  assert.equal(score('u4', '124446'), 12);
  assert.equal(score('u1', '111111'), 6);
  assert.equal(score('u6', '666666'), 36);
  assert.equal(score('u3', '124456'), 0);
});

test('Fünferpasch: mindestens 5 gleiche', () => {
  assert.equal(score('pasch5', '444442'), 40);
  assert.equal(score('pasch5', '555555'), 40);
  assert.equal(score('pasch5', '444422'), 0);
});

test('Sechserpasch: 6 gleiche', () => {
  assert.equal(score('pasch6', '555555'), 75);
  assert.equal(score('pasch6', '555554'), 0);
});

test('Drei Paare: Vierling zählt als zwei Paare, sechs gleiche als drei', () => {
  assert.equal(score('paare', '224455'), 30);
  assert.equal(score('paare', '444422'), 30);
  assert.equal(score('paare', '666666'), 30);
  assert.equal(score('paare', '224456'), 0);
});

test('Zwei Drillinge: sechs gleiche zählen auch', () => {
  assert.equal(score('drillinge', '333666'), 40);
  assert.equal(score('drillinge', '222222'), 40);
  assert.equal(score('drillinge', '333466'), 0);
});

test('Kleine Straße: 1-2-3-4-5 oder 2-3-4-5-6, Große Straße zählt auch', () => {
  assert.equal(score('kstrasse', '123345'), 25);
  assert.equal(score('kstrasse', '234566'), 25);
  assert.equal(score('kstrasse', '123456'), 25);
  assert.equal(score('kstrasse', '123356'), 0);
});

test('Große Straße: 1 bis 6', () => {
  assert.equal(score('gstrasse', '615243'), 40);
  assert.equal(score('gstrasse', '123455'), 0);
});

test('Tiefflug und Höhenflug: nicht alle drei Zahlen nötig', () => {
  assert.equal(score('tief', '112333'), 25);
  assert.equal(score('tief', '111111'), 25);
  assert.equal(score('tief', '112334'), 0);
  assert.equal(score('hoch', '444566'), 25);
  assert.equal(score('hoch', '666666'), 25);
  assert.equal(score('hoch', '344566'), 0);
});

test('Chance: Augensumme ohne Voraussetzung', () => {
  assert.equal(score('chance', '234566'), 26);
  assert.equal(score('chance', '111111'), 6);
});
