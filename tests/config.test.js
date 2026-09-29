// Tests für js/config.js: Passen die Werte zusammen? Schlägt hier etwas fehl, stimmt meist ein Eintrag in der Datei nicht.
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../js/config.js');
const { onlineName } = require('../js/rules.js');

const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

test('Online an oder aus: true oder false', () => {
  assert.equal(typeof config.enableOnline, 'boolean');
});

test('Grenzen für Personen und Bots', () => {
  assert.ok(isInt(config.maxPlayers, 1, 50), 'maxPlayers: ganze Zahl von 1 bis 50');
  assert.ok(isInt(config.maxBots, 0, 50), 'maxBots: ganze Zahl von 0 bis 50');
  assert.ok(config.maxBots < config.maxPlayers, 'maxBots muss kleiner als maxPlayers sein, sonst bleibt kein Platz für Menschen');
});

test('Bot-Namen: erlaubte Zeichen, höchstens 20 Zeichen, keiner doppelt', () => {
  assert.ok(Array.isArray(config.botNames) && config.botNames.length > 0, 'botNames: Liste mit mindestens einem Namen');
  const seen = new Set();
  for (const name of config.botNames) {
    assert.equal(onlineName(name), name, `„${name}“: nur Buchstaben, Zahlen, Leerzeichen und - _ . ! ?, höchstens 20 Zeichen, ohne Leerzeichen am Rand`);
    const low = name.toLowerCase();
    assert.ok(!seen.has(low), `„${name}“ steht doppelt in botNames`);
    seen.add(low);
  }
});

test('Zugzeiten in Sekunden', () => {
  assert.ok(isInt(config.turnSeconds, 10, 600), 'turnSeconds: ganze Zahl von 10 bis 600');
  assert.ok(isInt(config.countdownSeconds, 10, 600), 'countdownSeconds: ganze Zahl von 10 bis 600');
});

test('Tempo der Bots: alle Schritte in Millisekunden', () => {
  const steps = ['start', 'land', 'think', 'hold', 'roll', 'enter', 'after', 'cd'];
  assert.deepEqual(Object.keys(config.botDelays).sort(), steps.slice().sort());
  for (const s of steps) assert.ok(isInt(config.botDelays[s], 0, 10000), `botDelays.${s}: ganze Zahl von 0 bis 10000`);
});
