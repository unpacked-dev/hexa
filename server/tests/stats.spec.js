// Tests für den Spielzähler: Tage nach deutscher Zeit, die Zeiträume und das Aufräumen. Ausführen mit: bun run test
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import { countGame, readStats, pruneHours, statsPage, dayKey, hourKey } from '../stats.js';

const H = 3_600_000;
const D = 24 * H;
const NOW = Date.UTC(2026, 9, 12, 10, 0);   // 12.10.2026, 12:00 Uhr in Deutschland

test('Tage zählen nach deutscher Zeit, Stunden nach UTC', () => {
  assert.equal(dayKey(Date.UTC(2026, 9, 12, 21, 59)), '2026-10-12');
  assert.equal(dayKey(Date.UTC(2026, 9, 12, 22, 0)), '2026-10-13');     // Sommerzeit: Mitternacht ist 22 Uhr UTC
  assert.equal(dayKey(Date.UTC(2026, 11, 31, 23, 0)), '2027-01-01');    // Winterzeit: 23 Uhr UTC
  assert.equal(dayKey(Date.UTC(2026, 11, 31, 22, 59)), '2026-12-31');
  assert.equal(hourKey(Date.UTC(2026, 9, 12, 9, 59)), '2026-10-12T09');
});

test('Zeiträume: 24 Stunden laufend, sonst ganze Tage mit heute', () => {
  const db = openDb();
  const empty = readStats(db, NOW);
  assert.equal(empty.since, null);
  assert.deepEqual(empty.total, { all: 0, online: 0, local: 0, daily: 0 });

  const games = [
    [0, 'online'], [0, 'online'], [0, 'local'],
    [20 * H, 'local'],          // gestern 16 Uhr: noch in den letzten 24 Stunden
    [25 * H, 'online'],         // gestern 11 Uhr: nicht mehr
    [6 * D, 'local'],           // 06.10.: gerade noch in den letzten 7 Tagen
    [7 * D, 'local'],           // 05.10.: nicht mehr
    [29 * D, 'online'],         // in den letzten 30 Tagen
    [30 * D, 'online'],         // nicht mehr
    [364 * D, 'local'],         // in den letzten 365 Tagen
    [365 * D, 'local'],         // nur noch insgesamt
  ];
  for (const [ago, kind] of games) countGame(db, kind, NOW - ago);
  const s = readStats(db, NOW);
  assert.deepEqual(s.last24h, { all: 4, online: 2, local: 2, daily: 0 });
  assert.deepEqual(s.last7d, { all: 6, online: 3, local: 3, daily: 0 });
  assert.deepEqual(s.last30d, { all: 8, online: 4, local: 4, daily: 0 });
  assert.deepEqual(s.last365d, { all: 10, online: 5, local: 5, daily: 0 });
  assert.deepEqual(s.total, { all: 11, online: 5, local: 6, daily: 0 });
  assert.equal(s.since, '2025-10-12');
  assert.equal(s.today, '2026-10-12');
  assert.throws(() => countGame(db, 'mogeln', NOW), /Unbekannte Art/);
  db.close();
});

test('Tagesspiele zählen extra', () => {
  const db = openDb();
  countGame(db, 'daily', NOW);
  countGame(db, 'daily', NOW - 2 * D);
  countGame(db, 'local', NOW);
  const s = readStats(db, NOW);
  assert.deepEqual(s.last24h, { all: 2, online: 0, local: 1, daily: 1 });
  assert.deepEqual(s.total, { all: 3, online: 0, local: 1, daily: 2 });
  assert.match(statsPage(s), /<th scope="col">Tages&shy;spiel<\/th>/);
  db.close();
});

test('Viele Starts: keiner geht verloren', () => {
  const db = openDb();
  for (let i = 0; i < 30; i++) countGame(db, i % 3 ? 'local' : 'online', NOW);
  const s = readStats(db, NOW);
  assert.deepEqual(s.total, { all: 30, online: 10, local: 20, daily: 0 });
  assert.deepEqual(s.last24h, s.total);
  db.close();
});

test('Aufräumen: alte Stunden gehen, Tage und Summe bleiben', () => {
  const db = openDb();
  for (let h = 0; h < 80; h++) countGame(db, 'local', NOW - h * H);
  assert.equal(pruneHours(db, NOW), 80 - 49);   // Stunden vor mehr als 48 Stunden
  const hours = db.query("SELECT bucket FROM stats WHERE scope = 'hour' ORDER BY bucket").all().map(r => r.bucket);
  assert.equal(hours.length, 49);
  assert.equal(hours[0], hourKey(NOW - 48 * H));
  const s = readStats(db, NOW);
  assert.equal(s.last24h.all, 24);
  assert.equal(s.total.all, 80);
  assert.equal(s.last7d.all, 80);
  assert.equal(pruneHours(db, NOW), 0);
  db.close();
});

test('Seite unter /stats: alle Zeiträume, deutsche Zahlen', () => {
  const db = openDb();
  for (let i = 0; i < 1234; i++) countGame(db, 'local', NOW);
  countGame(db, 'online', NOW);
  const html = statsPage(readStats(db, NOW));
  for (const label of ['Letzte 24 Stunden', 'Letzte 7 Tage', 'Letzte 30 Tage', 'Letzte 365 Tage', 'Insgesamt']) assert.ok(html.includes(label), label);
  assert.match(html, /<td class="all">1\.235<\/td><td>1<\/td><td>1\.234<\/td><td>0<\/td>/);
  assert.match(html, /Gezählt seit 12\.10\.2026/);
  assert.match(html, /Stand: 12\.10\.2026, 12:00 Uhr/);
  db.close();
  const none = openDb();
  assert.match(statsPage(readStats(none, NOW)), /Noch kein Spiel gezählt/);
  none.close();
});
