// Tests für Deno KV (server/store.js), mit einer Datenbank im Arbeitsspeicher. Ausführen mit: deno task test
import assert from 'node:assert/strict';
import * as S from '../store.js';
import * as G from '../game.js';

const host = (id = 'p1') => room => G.join(room, { id, name: 'Lena', key: 'k-' + id });
const codes = (...list) => () => list.shift();

Deno.test('Neue Lobby: Jeden Code gibt es nur einmal, auch wenn zwei gleichzeitig ziehen', async () => {
  const kv = await Deno.openKv(':memory:');
  const a = await S.createRoom(kv, host(), 0, codes('BBBB', 'CCCC'));
  const b = await S.createRoom(kv, host(), 0, codes('BBBB', 'CCCC'));
  assert.equal(a.code, 'BBBB');
  assert.equal(b.code, 'CCCC');
  assert.equal(a.host, 'p1');
  // Beide ziehen im selben Moment DDDD: Nur eine Lobby bekommt ihn, die andere zieht neu
  const [x, y] = await Promise.all([
    S.createRoom(kv, host('x'), 0, codes('DDDD', 'FFFF')),
    S.createRoom(kv, host('y'), 0, codes('DDDD', 'GGGG')),
  ]);
  assert.notEqual(x.code, y.code);
  assert.ok([x.code, y.code].includes('DDDD'));
  assert.equal((await S.readRoom(kv, 'DDDD', 0)).players.length, 1);
  kv.close();
});

Deno.test('Ändern: Gleichzeitige Änderungen gehen nicht verloren, unveränderte werden nicht gespeichert', async () => {
  const kv = await Deno.openKv(':memory:');
  await S.createRoom(kv, host('p0'), 0, codes('KXMP'));
  await Promise.all(Array.from({ length: 20 }, (_, i) =>
    S.mutate(kv, 'KXMP', room => G.join(room, { id: 'p' + (i + 1), name: 'Spieler ' + (i + 1), key: 'k' + i }), 0)));
  const room = await S.readRoom(kv, 'KXMP', 0);
  assert.equal(room.players.length, 21);
  assert.equal(room.seq, 20);

  const same = await S.mutate(kv, 'KXMP', () => 'nichts', 0);
  assert.equal(same.changed, false);
  assert.equal(same.result, 'nichts');
  assert.equal((await S.readRoom(kv, 'KXMP', 0)).seq, 20);

  // Fehler in der Änderung: nichts wird gespeichert
  await assert.rejects(S.mutate(kv, 'KXMP', room => { room.players = []; G.fail('not-host'); }, 0), { code: 'not-host' });
  assert.equal((await S.readRoom(kv, 'KXMP', 0)).players.length, 21);

  // gone: gelöscht
  const out = await S.mutate(kv, 'KXMP', room => { room.gone = true; }, 0);
  assert.equal(out.gone, true);
  assert.equal(await S.readRoom(kv, 'KXMP', 0), null);
  assert.equal((await S.mutate(kv, 'KXMP', () => {}, 0)).missing, true);
  kv.close();
});

Deno.test('Ablauf: Eine Lobby ohne Start gilt nach 1 Stunde als weg, ihr Code ist wieder frei', async () => {
  const kv = await Deno.openKv(':memory:');
  const room = await S.createRoom(kv, host(), 0, codes('KXMP'));
  assert.equal(room.expires, S.LOBBY_TTL);
  assert.ok(await S.readRoom(kv, 'KXMP', S.LOBBY_TTL - 1));
  assert.equal(await S.readRoom(kv, 'KXMP', S.LOBBY_TTL + 1), null);
  const again = await S.createRoom(kv, host('neu'), S.LOBBY_TTL + 1, codes('KXMP'));
  assert.equal(again.code, 'KXMP');
  assert.equal(again.host, 'neu');
  // Ein laufendes Spiel bleibt 24 Stunden nach der letzten Aktion
  const out = await S.mutate(kv, 'KXMP', room => G.start(room, 'neu', { now: 5, rng: G.fairRandom, times: G.TIMES }), 5);
  assert.equal(out.room.expires, 5 + S.GAME_TTL);
  kv.close();
});

Deno.test('Beobachten: Änderungen und Löschen kommen an', async () => {
  const kv = await Deno.openKv(':memory:');
  await S.createRoom(kv, host(), 0, codes('KXMP'));
  const seen = [];
  let wake = () => {};
  const stop = S.watchRoom(kv, 'KXMP', value => { seen.push(value ? value.seq : null); wake(); });
  const waitFor = pred => new Promise(resolve => { wake = () => { if (pred()) resolve(); }; wake(); });
  await waitFor(() => seen.length > 0);
  assert.equal(seen[0], 0);
  await S.mutate(kv, 'KXMP', room => G.join(room, { id: 'p2', name: 'Tim', key: 'k2' }), 0);
  await waitFor(() => seen.includes(1));
  await S.mutate(kv, 'KXMP', room => { room.gone = true; }, 0);
  await waitFor(() => seen.includes(null));
  stop();
  kv.close();
});

Deno.test('Lebenszeichen: laufende Server-Instanzen', async () => {
  const kv = await Deno.openKv(':memory:');
  await S.heartbeat(kv, 'a', 1000);
  await S.heartbeat(kv, 'b', 1000);
  assert.deepEqual([...await S.liveInstances(kv, 2000)].sort(), ['a', 'b']);
  assert.deepEqual([...await S.liveInstances(kv, 60_000)], []);
  await S.forgetInstance(kv, 'a');
  assert.deepEqual([...await S.liveInstances(kv, 2000)], ['b']);
  kv.close();
});

Deno.test('Schlüssel: Alles liegt unter hexa_, die Datenbank teilen sich mehrere Apps', async () => {
  const kv = await Deno.openKv(':memory:');
  await S.createRoom(kv, host(), 0, codes('KXMP'));
  await S.heartbeat(kv, 'inst0', 0);
  const keys = [];
  for await (const e of kv.list({ prefix: [] })) keys.push(e.key[0]);
  assert.deepEqual(keys.sort(), ['hexa_instance', 'hexa_room']);
  kv.close();
});
