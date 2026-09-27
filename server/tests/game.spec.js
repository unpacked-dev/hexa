// Tests für den Spielablauf (server/game.js). Ausführen mit: deno task test
import assert from 'node:assert/strict';
import * as G from '../game.js';

// Vorgegebener Zufall: erst die Würfel aus der Liste, danach immer 1. int nimmt die Zahlen aus ints.
const rng = (dice = [], ints = []) => ({
  d6: () => (dice.length ? dice.shift() : 1),
  int: n => (ints.length ? ints.shift() : 0) % n,
});
// Würfel, die reihum 1 bis 6 zeigen: nie 4 gleiche, also kein Countdown
const plain = () => { let k = 0; return { d6: () => (k++ % 6) + 1, int: () => 0 }; };
const ctx = (now, r = rng()) => ({ now, rng: r, times: G.TIMES });

function lobby(names = ['Lena', 'Tim']) {
  const room = G.newRoom('KXMP', 0);
  names.forEach((name, i) => G.join(room, { id: 'p' + (i + 1), name, key: 'k' + (i + 1) }));
  return room;
}
const online = (room, ...ids) => ids.forEach(id => G.attach(room, id, 'i.' + id, 0));
const lastEvent = room => room.events[room.events.length - 1];
const code = c => ({ code: c });

Deno.test('Namen: erlaubte werden vereinheitlicht, alles andere abgelehnt', () => {
  for (const ok of ['Jürgen', 'Anna-Lena', 'dice_master', 'Dr. Würfel', 'Wer?!', 'ÄÖÜ äöü ß 42']) assert.equal(G.onlineName(ok), ok);
  assert.equal(G.onlineName('  Lena   Maria  '), 'Lena Maria');
  assert.equal(G.onlineName('Jürgen'), 'Jürgen');   // ü aus u und zwei Punkten
  for (const bad of ['Zoë', 'José', 'Lena😀', "O'Brien", '<script>', '...', '', '   ', 'a'.repeat(21), 'Le​na', 'a&b', 'x"y', 42, null]) {
    assert.equal(G.onlineName(bad), null, String(bad));
  }
});

Deno.test('Lobby: Host, doppelte Namen, Reihenfolge, Entfernen', () => {
  const room = lobby();
  assert.equal(room.host, 'p1');
  assert.equal(G.join(room, { id: 'p3', name: 'lena', key: 'k3' }).name, 'lena 2');
  assert.equal(G.join(room, { id: 'p4', name: 'Lena', key: 'k4' }).name, 'Lena 3');
  assert.throws(() => G.join(room, { id: 'p5', name: '<b>', key: 'k5' }), code('name-invalid'));

  assert.throws(() => G.order(room, 'p2', ['p2', 'p1', 'p3', 'p4']), code('not-host'));
  assert.throws(() => G.order(room, 'p1', ['p2', 'p1', 'p3']), code('stale'));
  assert.throws(() => G.order(room, 'p1', ['p2', 'p2', 'p3', 'p4']), code('stale'));
  G.order(room, 'p1', ['p4', 'p3', 'p2', 'p1']);
  assert.deepEqual(room.players.map(p => p.id), ['p4', 'p3', 'p2', 'p1']);

  assert.throws(() => G.kick(room, 'p2', 'p3', ctx(0)), code('not-host'));
  assert.throws(() => G.kick(room, 'p1', 'p1', ctx(0)), code('not-in-room'));
  G.kick(room, 'p1', 'p3', ctx(0));
  assert.equal(G.playerById(room, 'p3'), null);
  assert.deepEqual(lastEvent(room), { no: room.eventNo, type: 'kick', player: 'p3', name: 'lena 2' });
});

Deno.test('Lobby: höchstens 50 Personen, nach dem Start kommt niemand mehr dazu', () => {
  const room = lobby([]);
  for (let i = 0; i < G.MAX_PLAYERS; i++) G.join(room, { id: 'p' + i, name: 'Spieler ' + i, key: 'k' + i });
  assert.throws(() => G.join(room, { id: 'x', name: 'Noch wer', key: 'kx' }), code('room-full'));
  const small = lobby();
  G.start(small, 'p1', ctx(0));
  assert.throws(() => G.join(small, { id: 'p3', name: 'Mia', key: 'k3' }), code('game-running'));
  assert.throws(() => G.start(small, 'p1', ctx(0)), code('game-running'));
  assert.throws(() => G.start(lobby(), 'p2', ctx(0)), code('not-host'));
});

Deno.test('Ein Zug: würfeln, halten, nachwürfeln, eintragen, dann ist die nächste Person dran', () => {
  const room = lobby();
  G.start(room, 'p1', ctx(1000));
  assert.equal(room.status, 'playing');
  assert.deepEqual(room.turn, { no: 1, player: 'p1', phase: 'roll', deadline: 61000 });

  assert.throws(() => G.enter(room, 'p1', 'chance', ctx(1500)), code('no-roll-yet'));
  G.roll(room, 'p1', 1, ctx(2000, rng([1, 2, 3, 4, 5, 5])));
  assert.deepEqual(room.dice.vals, [1, 2, 3, 4, 5, 5]);
  assert.equal(room.dice.owner, 'p1');
  assert.throws(() => G.roll(room, 'p1', 1, ctx(2100)), code('stale'));   // doppelter Tipp
  assert.throws(() => G.roll(room, 'p2', 1, ctx(2100)), code('not-your-turn'));
  assert.throws(() => G.hold(room, 'p1', 6, true), code('bad-message'));
  [0, 1, 2, 3, 4].forEach(i => G.hold(room, 'p1', i, true));
  G.hold(room, 'p1', 4, true);   // doppelt angekommen: bleibt gehalten
  G.roll(room, 'p1', 2, ctx(3000, rng([6])));
  assert.deepEqual(room.dice.vals, [1, 2, 3, 4, 5, 6]);

  G.enter(room, 'p1', 'gstrasse', ctx(4000));
  assert.equal(room.scores.p1.gstrasse, 40);
  assert.deepEqual(lastEvent(room), { no: room.eventNo, type: 'enter', player: 'p1', field: 'gstrasse', pts: 40 });
  assert.deepEqual(room.turn, { no: 2, player: 'p2', phase: 'roll', deadline: 64000 });
  // Die Würfel von Lena bleiben sichtbar, bis Tim würfelt
  assert.deepEqual(room.dice.vals, [1, 2, 3, 4, 5, 6]);
  assert.throws(() => G.enter(room, 'p2', 'chance', ctx(4100)), code('no-roll-yet'));
  assert.throws(() => G.hold(room, 'p2', 0, true), code('no-roll-yet'));
  G.roll(room, 'p2', 1, ctx(5000, rng([2, 2, 3, 3, 4, 4])));
  assert.equal(room.dice.owner, 'p2');
  assert.deepEqual(room.dice.held, [false, false, false, false, false, false]);
  assert.throws(() => G.enter(room, 'p2', 'nix', ctx(5100)), code('bad-message'));
  G.enter(room, 'p2', 'paare', ctx(5200));
  G.roll(room, 'p1', 1, ctx(5300, plain()));
  assert.throws(() => G.enter(room, 'p1', 'gstrasse', ctx(5400)), code('field-taken'));
});

Deno.test('Drei Würfe, dann ist Schluss. Alle Würfel gehalten: nicht würfeln', () => {
  const room = lobby(['Lena']);
  G.start(room, 'p1', ctx(0));
  G.roll(room, 'p1', 1, ctx(1));
  for (let i = 0; i < 6; i++) G.hold(room, 'p1', i, true);
  assert.throws(() => G.roll(room, 'p1', 2, ctx(2)), code('all-held'));
  G.hold(room, 'p1', 5, false);
  G.roll(room, 'p1', 2, ctx(3));
  G.roll(room, 'p1', 3, ctx(4));
  assert.throws(() => G.roll(room, 'p1', 4, ctx(5)), code('no-rolls'));
  assert.throws(() => G.hold(room, 'p1', 0, false), code('no-rolls'));
});

Deno.test('Countdown: 4 gleiche schalten ihn frei, nach dem Eintragen wird er gespielt', () => {
  const room = lobby();
  G.start(room, 'p1', ctx(0));
  G.roll(room, 'p1', 1, ctx(1000, rng([6, 6, 6, 6, 1, 2])));
  assert.deepEqual(room.dice.cd, { owner: 'p1', played: false });
  assert.throws(() => G.cdRoll(room, 'p1', 0, ctx(1100)), code('no-countdown'));
  G.enter(room, 'p1', 'u6', ctx(2000));
  assert.equal(room.turn.phase, 'cd');
  assert.equal(room.turn.deadline, 32000);
  assert.throws(() => G.roll(room, 'p1', 2, ctx(2100)), code('countdown-running'));

  G.cdRoll(room, 'p1', 0, ctx(3000, rng([1, 6, 2, 3, 4, 5])));
  assert.equal(room.cdGame.pts, 10);
  assert.equal(room.cdGame.hit, 1);
  assert.throws(() => G.cdRoll(room, 'p1', 0, ctx(3100)), code('stale'));
  G.cdRoll(room, 'p1', 1, ctx(4000, rng([5, 1, 1, 1, 1])));
  G.cdRoll(room, 'p1', 2, ctx(5000, rng([1, 1, 1, 1])));   // keine 4: vorbei
  assert.equal(room.cdGame.status, 'over');
  assert.deepEqual(room.cds, { p1: [20] });
  assert.deepEqual(lastEvent(room), { no: room.eventNo, type: 'countdown', player: 'p1', pts: 20, perfect: false, timeout: false });
  assert.equal(room.turn.player, 'p2');
  assert.equal(room.turn.phase, 'roll');
  // Der fertige Countdown bleibt sichtbar, bis Tim würfelt
  assert.equal(room.cdGame.owner, 'p1');
  G.roll(room, 'p2', 1, ctx(6000, plain()));
  assert.equal(room.cdGame, null);
});

Deno.test('Countdown perfekt: 60 Punkte', () => {
  const room = lobby(['Lena']);
  G.start(room, 'p1', ctx(0));
  G.roll(room, 'p1', 1, ctx(1, rng([3, 3, 3, 3, 3, 3])));
  G.enter(room, 'p1', 'pasch6', ctx(2));
  for (let stage = 0; stage < 6; stage++) {
    const n = 6 - stage;
    G.cdRoll(room, 'p1', stage, ctx(3 + stage, rng([n].concat(Array(n - 1).fill(n === 1 ? 2 : 1)))));
  }
  assert.equal(room.cdGame.status, 'perfect');
  assert.deepEqual(room.cds, { p1: [60] });
  assert.equal(room.turn.no, 2);   // allein: wieder Lena, aber ein neuer Zug
});

Deno.test('Zeit um: ein zufälliges freies Feld wird gestrichen, dann ist die nächste Person dran', () => {
  const room = lobby();
  G.start(room, 'p1', ctx(0));
  assert.equal(G.tick(room, ctx(60_900)), false);   // noch im Puffer
  assert.equal(G.tick(room, ctx(61_001, rng([], [3]))), true);
  assert.deepEqual(room.scores.p1, { u4: 0 });
  assert.equal(G.playerById(room, 'p1').missed, 1);
  assert.deepEqual(lastEvent(room), { no: room.eventNo, type: 'timeout', player: 'p1', field: 'u4' });
  assert.deepEqual(room.turn, { no: 2, player: 'p2', phase: 'roll', deadline: 121_001 });
  // Egal was die Würfel zeigen: Das Feld bekommt 0
  G.roll(room, 'p2', 1, ctx(62_000, rng([6, 6, 6, 5, 5, 5])));
  G.tick(room, ctx(122_002, rng([], [0])));
  assert.deepEqual(room.scores.p2, { u1: 0 });
  // Wer würfelt, ist nicht mehr abwesend
  G.roll(room, 'p1', 1, ctx(123_000, plain()));
  assert.equal(G.playerById(room, 'p1').missed, 0);
});

Deno.test('Zeit um nach 4 gleichen: Der Countdown bekommt eigene 30 Sekunden', () => {
  const room = lobby();
  G.start(room, 'p1', ctx(0));
  G.roll(room, 'p1', 1, ctx(1000, rng([2, 2, 2, 2, 5, 6])));
  G.tick(room, ctx(61_001));
  assert.equal(Object.values(room.scores.p1)[0], 0);
  assert.equal(room.turn.phase, 'cd');
  assert.equal(room.turn.deadline, 91_001);
  G.tick(room, ctx(92_002));   // gar nicht gewürfelt: 0 Punkte
  assert.deepEqual(room.cds, {});
  assert.deepEqual(lastEvent(room), { no: room.eventNo, type: 'countdown', player: 'p1', pts: 0, perfect: false, timeout: true });
  assert.equal(room.turn.player, 'p2');

  // Zeit läuft mitten im Countdown ab: Die Punkte bis dahin zählen
  const other = lobby(['Lena']);
  G.start(other, 'p1', ctx(0));
  G.roll(other, 'p1', 1, ctx(1, rng([4, 4, 4, 4, 1, 1])));
  G.enter(other, 'p1', 'u4', ctx(2));
  G.cdRoll(other, 'p1', 0, ctx(3, rng([6, 1, 1, 1, 1, 1])));
  G.tick(other, ctx(31_004));
  assert.deepEqual(other.cds, { p1: [10] });
});

Deno.test('Abwesend: Wer zweimal die Zeit verpasst und weg ist, wird sofort übersprungen', () => {
  const room = lobby();
  online(room, 'p1');   // Tim ist nicht verbunden
  G.start(room, 'p1', ctx(0));
  let now = 0;
  const lenaPlays = () => { G.roll(room, 'p1', 1, ctx(++now, plain())); G.enter(room, 'p1', G.FIELD_KEYS.find(k => !(room.scores.p1 && k in room.scores.p1)), ctx(++now)); };
  lenaPlays();
  now = room.turn.deadline + 1001;
  G.tick(room, ctx(now));   // Tim verpasst zum ersten Mal
  lenaPlays();
  now = room.turn.deadline + 1001;
  G.tick(room, ctx(now));   // zum zweiten Mal
  assert.equal(G.playerById(room, 'p2').missed, 2);
  lenaPlays();
  assert.equal(room.turn.player, 'p2');
  assert.equal(G.tick(room, ctx(now + 3)), true);   // sofort, ohne 60 Sekunden zu warten
  assert.equal(room.turn.player, 'p1');
  assert.equal(Object.keys(room.scores.p2).length, 3);

  // Ist Tim wieder verbunden, wartet das Spiel wieder auf ihn
  lenaPlays();
  online(room, 'p2');
  assert.equal(G.tick(room, ctx(now + 10)), false);
  assert.equal(room.turn.player, 'p2');

  // Ist niemand verbunden, bleibt das Spiel stehen
  G.detach(room, 'p1', 'i.p1');
  G.detach(room, 'p2', 'i.p2');
  assert.equal(G.tick(room, ctx(now + 20)), false);
});

Deno.test('Spielende: Ergebnis mit Bonus, Lobby wartet wieder, Revanche startet frisch', () => {
  const room = lobby(['Lena']);
  G.start(room, 'p1', ctx(0));
  room.scores.p1 = { u1: 3, u2: 6, u3: 12, u4: 16, u5: 20, u6: 24, pasch5: 40, pasch6: 0, paare: 30, drillinge: 40, kstrasse: 25, gstrasse: 40, tief: 25, hoch: 0 };
  room.cds.p1 = [30];
  G.roll(room, 'p1', 1, ctx(1, rng([6, 6, 5, 5, 4, 3])));
  G.enter(room, 'p1', 'chance', ctx(2));
  assert.equal(room.status, 'lobby');
  assert.equal(room.turn, null);
  assert.deepEqual(room.last, {
    game: 1, at: 2,
    ranking: [{ id: 'p1', name: 'Lena', upper: 81, bonus: 40, lower: 229, cd: 30, total: 380 }],
  });
  assert.equal(lastEvent(room).type, 'end');
  // Block bleibt bis zur Revanche sichtbar, neue Leute können dazukommen
  assert.equal(room.scores.p1.chance, 29);
  G.join(room, { id: 'p2', name: 'Tim', key: 'k2' });
  G.start(room, 'p1', ctx(100));
  assert.equal(room.game, 2);
  assert.deepEqual(room.scores, {});
  assert.equal(room.last.game, 1);
});

Deno.test('Ganze Partie zu zweit: immer abwechselnd, nach 30 Zügen steht das Ergebnis', () => {
  const room = lobby();
  G.start(room, 'p1', ctx(0));
  const r = plain();
  const order = [];
  let now = 0;
  while (room.status === 'playing') {
    const who = room.turn.player;
    order.push(who);
    G.roll(room, who, 1, ctx(++now, r));
    const free = G.FIELD_KEYS.filter(k => !(room.scores[who] && k in room.scores[who]));
    G.enter(room, who, free[0], ctx(++now));
  }
  assert.equal(order.length, 30);
  assert.ok(order.every((p, i) => p === (i % 2 ? 'p2' : 'p1')));
  assert.equal(room.last.ranking.length, 2);
  assert.equal(room.last.ranking[0].total, G.totals(room, room.last.ranking[0].id).total);
});

Deno.test('Verlassen: Host und Zug gehen weiter, die Punkte sind weg, zuletzt wird gelöscht', () => {
  const room = lobby(['Lena', 'Tim', 'Mia']);
  G.start(room, 'p1', ctx(0));
  G.roll(room, 'p1', 1, ctx(1, plain()));
  G.leave(room, 'p1', ctx(2));
  assert.equal(room.host, 'p2');
  assert.deepEqual(room.turn, { no: 2, player: 'p2', phase: 'roll', deadline: 60_002 });
  assert.equal(room.dice.vals, null);
  G.leave(room, 'p3', ctx(3));
  assert.equal(room.turn.player, 'p2');
  assert.throws(() => G.leave(room, 'p3', ctx(4)), code('not-in-room'));
  G.leave(room, 'p2', ctx(5));
  assert.equal(room.gone, true);
});

Deno.test('Verbindungen: online, und nach einem Server-Update räumt sich alles auf', () => {
  const room = lobby();
  assert.equal(G.attach(room, 'p1', 'a.1', 0), true);
  assert.equal(G.attach(room, 'p1', 'a.1', 0), false);   // schon da: keine Änderung
  G.attach(room, 'p2', 'weg.7', 0);
  const v = G.view(room, 'p1');
  assert.deepEqual(v.players, [{ id: 'p1', name: 'Lena', online: true, missed: 0 }, { id: 'p2', name: 'Tim', online: true, missed: 0 }]);
  assert.equal(v.you, 'p1');
  assert.ok(!JSON.stringify(v).includes('k1') && !JSON.stringify(v).includes('weg.7'), 'keine Schlüssel und Verbindungen');
  const alive = inst => inst === 'a';
  assert.equal(G.prune(room, alive, 30_000), false);   // Schonfrist
  assert.equal(G.prune(room, alive, 50_000), true);
  assert.equal(G.view(room).players[1].online, false);
  assert.equal(G.detach(room, 'p1', 'a.1'), true);
  assert.equal(G.detach(room, 'p1', 'a.1'), false);
});

Deno.test('Zufall: fair verteilt, Codes aus 4 Konsonanten', () => {
  const count = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 60_000; i++) count[G.fairRandom.d6()]++;
  for (let v = 1; v <= 6; v++) assert.ok(Math.abs(count[v] - 10_000) < 500, `Zahl ${v}: ${count[v]}`);
  for (let i = 0; i < 200; i++) assert.match(G.randomCode(), G.CODE_RE);
  assert.match(G.randomId(), /^[a-z0-9]{10}$/);
});
