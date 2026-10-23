// Tests für die Lobbys in SQLite (server/store.js und server/db.js). Ausführen mit: bun run test
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../db.js';
import { backup } from '../backup.js';
import * as S from '../store.js';
import * as G from '../game.js';

const host = (id = 'p1') => room => G.join(room, { id, name: 'Lena', key: 'k-' + id });
const codes = (...list) => () => list.shift();
// Ein leerer Ordner für Datenbank-Dateien, wird am Ende gelöscht
function folder(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'hexa-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('Neue Lobby: Jeden Code gibt es nur einmal', () => {
  const db = openDb();
  const a = S.createRoom(db, host(), 0, codes('BBBB', 'CCCC'));
  const b = S.createRoom(db, host(), 0, codes('BBBB', 'CCCC'));
  assert.equal(a.code, 'BBBB');
  assert.equal(b.code, 'CCCC');
  assert.equal(a.host, 'p1');
  // Beide ziehen DDDD: Nur eine Lobby bekommt ihn, die andere zieht neu
  const x = S.createRoom(db, host('x'), 0, codes('DDDD', 'FFFF'));
  const y = S.createRoom(db, host('y'), 0, codes('DDDD', 'GGGG'));
  assert.deepEqual([x.code, y.code], ['DDDD', 'GGGG']);
  assert.equal(S.readRoom(db, 'DDDD', 0).host, 'x');
  db.close();
});

test('Ändern: Jede Änderung zählt, unveränderte werden nicht gespeichert', () => {
  const db = openDb();
  S.createRoom(db, host('p0'), 0, codes('KXMP'));
  for (let i = 0; i < 20; i++) S.mutate(db, 'KXMP', room => G.join(room, { id: 'p' + (i + 1), name: 'Spieler ' + (i + 1), key: 'k' + i }), 0);
  const room = S.readRoom(db, 'KXMP', 0);
  assert.equal(room.players.length, 21);
  assert.equal(room.seq, 20);

  const same = S.mutate(db, 'KXMP', () => 'nichts', 0);
  assert.equal(same.changed, false);
  assert.equal(same.result, 'nichts');
  assert.equal(same.room.seq, 20);
  assert.equal(S.readRoom(db, 'KXMP', 0).seq, 20);

  // Fehler in der Änderung: nichts wird gespeichert
  assert.throws(() => S.mutate(db, 'KXMP', r => { r.players = []; G.fail('not-host'); }, 0), { code: 'not-host' });
  assert.equal(S.readRoom(db, 'KXMP', 0).players.length, 21);

  // gone: gelöscht
  const out = S.mutate(db, 'KXMP', r => { r.gone = true; }, 0);
  assert.equal(out.gone, true);
  assert.equal(S.readRoom(db, 'KXMP', 0), null);
  assert.equal(S.mutate(db, 'KXMP', () => {}, 0).missing, true);
  db.close();
});

test('Ablauf: Eine Lobby ohne Start gilt nach 1 Stunde als weg, ihr Code ist wieder frei', () => {
  const db = openDb();
  const room = S.createRoom(db, host(), 0, codes('KXMP'));
  assert.equal(room.expires, S.LOBBY_TTL);
  assert.ok(S.readRoom(db, 'KXMP', S.LOBBY_TTL - 1));
  assert.equal(S.readRoom(db, 'KXMP', S.LOBBY_TTL + 1), null);
  assert.equal(S.mutate(db, 'KXMP', () => {}, S.LOBBY_TTL + 1).missing, true);
  const again = S.createRoom(db, host('neu'), S.LOBBY_TTL + 1, codes('KXMP'));
  assert.equal(again.code, 'KXMP');
  assert.equal(again.host, 'neu');
  assert.equal(again.seq, 0);
  // Ein laufendes Spiel bleibt 24 Stunden nach der letzten Aktion
  const out = S.mutate(db, 'KXMP', r => G.start(r, 'neu', { now: 5, rng: G.fairRandom, times: G.TIMES }), 5);
  assert.equal(out.room.expires, 5 + S.GAME_TTL);
  db.close();
});

test('Aufräumen: Abgelaufene Lobbys verschwinden aus der Datei, laufende bleiben', () => {
  const db = openDb();
  S.createRoom(db, host(), 0, codes('BBBB'));
  S.createRoom(db, host(), 1000, codes('CCCC'));
  assert.equal(S.purgeRooms(db, S.LOBBY_TTL + 500), 1);
  assert.deepEqual(db.query('SELECT code FROM rooms').all().map(r => r.code), ['CCCC']);
  assert.equal(S.purgeRooms(db, S.LOBBY_TTL + 500), 0);
  db.close();
});

test('Neustart: Die Lobby steht in der Datei und ist danach noch da', () => folder(dir => {
  const file = join(dir, 'hexa.sqlite');
  const before = openDb(file);
  S.createRoom(before, host(), 0, codes('KXMP'));
  S.mutate(before, 'KXMP', r => G.join(r, { id: 'p2', name: 'Tim', key: 'k2' }), 0);
  before.close();
  const after = openDb(file);
  const room = S.readRoom(after, 'KXMP', 0);
  assert.deepEqual(room.players.map(p => p.name), ['Lena', 'Tim']);
  assert.equal(room.seq, 1);
  assert.equal(after.query('PRAGMA journal_mode').get().journal_mode, 'wal');
  after.close();
}));

test('Update: Zwei Server an einer Datei, abwechselnd geändert, nichts geht verloren', () => folder(dir => {
  const file = join(dir, 'hexa.sqlite');
  const a = openDb(file);
  const b = openDb(file);
  S.createRoom(a, host('p0'), 0, codes('KXMP'));
  for (let i = 0; i < 10; i++) S.mutate(i % 2 ? b : a, 'KXMP', r => G.join(r, { id: 'p' + (i + 1), name: 'Spieler ' + (i + 1), key: 'k' + i }), 0);
  assert.equal(S.readRoom(a, 'KXMP', 0).players.length, 11);
  assert.equal(S.readRoom(b, 'KXMP', 0).seq, 10);
  a.close();
  b.close();
}));

test('Sicherung: Kopie neben der Datenbank, die letzten 7 bleiben', () => folder(dir => {
  const file = join(dir, 'hexa.sqlite');
  const db = openDb(file);
  S.createRoom(db, host(), 0, codes('KXMP'));
  for (let d = 1; d <= 8; d++) writeFileSync(join(dir, `backup-2026-01-0${d}.sqlite`), '');
  const { file: copy, removed } = backup(file, Date.UTC(2026, 9, 23, 3));
  assert.equal(copy, join(dir, 'backup-2026-10-23.sqlite'));
  assert.deepEqual(removed, ['backup-2026-01-01.sqlite', 'backup-2026-01-02.sqlite']);
  assert.equal(readdirSync(dir).filter(f => f.startsWith('backup-')).length, 7);
  const saved = openDb(copy);
  assert.equal(S.readRoom(saved, 'KXMP', 0).host, 'p1');
  saved.close();
  // Zweimal am selben Tag: Die Kopie wird ersetzt
  S.mutate(db, 'KXMP', r => G.join(r, { id: 'p2', name: 'Tim', key: 'k2' }), 0);
  backup(file, Date.UTC(2026, 9, 23, 4));
  const again = openDb(copy);
  assert.equal(S.readRoom(again, 'KXMP', 0).players.length, 2);
  again.close();
  db.close();
}));
