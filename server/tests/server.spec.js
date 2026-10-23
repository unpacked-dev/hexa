// Tests für den ganzen Server: echte WebSocket-Verbindungen gegen einen echten Server. Ausführen mit: bun run test
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Config from '../../js/config.js';
import { createHub, ipKey, clientIp, isPrivate } from '../main.js';
import { openDb } from '../db.js';
import * as G from '../game.js';

const quiet = { error: () => {}, warn: () => {}, log: () => {} };

// Ein Server auf einem freien Port. db: eigene Datenbank (sonst eine im Arbeitsspeicher).
// Online ist an, egal was in js/config.js steht. Online aus prüft ein eigener Test.
function start(times = G.TIMES, opts = {}) {
  const db = opts.db || openDb();
  const hub = createHub(Object.assign({ times, log: quiet, online: true }, opts, { db }));
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: hub.fetch, websocket: hub.websocket });
  return {
    db,
    hub,
    ws: () => `ws://127.0.0.1:${server.port}/ws`,
    http: () => `http://127.0.0.1:${server.port}`,
    // Wie bei einem Update: Der Server hält an, die Datenbank bleibt
    async halt() {
      await hub.close();
      server.stop(true);
    },
    async stop(...clients) {
      await Promise.all(clients.map(c => c.close()));
      await this.halt();
      if (!opts.db) db.close();
    },
  };
}

// Eine simulierte App. next wartet auf die nächste passende Nachricht, until auf einen passenden Stand.
function app(url, headers) {
  const ws = new WebSocket(url, headers ? { headers } : undefined);
  const msgs = [];
  let wake = null;
  const c = {
    msgs,
    state: null,
    pos: 0,
    opened: new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; }),
    closed: new Promise(resolve => { ws.onclose = resolve; }),   // gibt das Ereignis mit code zurück
    send: m => ws.send(typeof m === 'string' ? m : JSON.stringify(m)),
    async next(pred, ms = 5000) {
      const end = Date.now() + ms;
      for (;;) {
        while (c.pos < msgs.length) {
          const m = msgs[c.pos++];
          if (pred(m)) return m;
        }
        const left = end - Date.now();
        if (left <= 0) throw new Error('Nichts Passendes gekommen. Zuletzt: ' + JSON.stringify(msgs.slice(-2)).slice(0, 400));
        await new Promise(resolve => {
          const t = setTimeout(resolve, left);
          wake = () => { clearTimeout(t); resolve(); };
        });
      }
    },
    async until(pred, ms) {
      if (c.state && pred(c.state)) { c.pos = msgs.length; return c.state; }
      return (await c.next(m => m.t === 'state' && pred(m.room), ms)).room;
    },
    error: async re => (await c.next(m => m.t === 'error' && (!re || m.re === re))).code,
    async hello(key, code) {
      c.send(code ? { t: 'hello', v: G.PROTOCOL, key, code } : { t: 'hello', v: G.PROTOCOL, key });
      return c.next(m => m.t === 'welcome' || m.t === 'error');
    },
    async close() {
      if (ws.readyState < 2) ws.close();
      await c.closed;
    },
  };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    msgs.push(m);
    if (m.t === 'state') c.state = m.room;
    if (wake) { const w = wake; wake = null; w(); }
  };
  return c;
}
const KEY = name => name.toLowerCase() + '-geraet-0123456789';
const free = (room, id) => G.FIELD_KEYS.filter(k => !(room.scores[id] && k in room.scores[id]));

async function lobbyOf(env, names) {
  const apps = names.map(() => app(env.ws()));
  await Promise.all(apps.map(a => a.opened));
  for (let i = 0; i < names.length; i++) assert.equal((await apps[i].hello(KEY(names[i]))).t, 'welcome');
  apps[0].send({ t: 'create', name: names[0] });
  const code = (await apps[0].until(r => r.players.length === 1)).code;
  for (let i = 1; i < names.length; i++) {
    apps[i].send({ t: 'join', code, name: names[i] });
    await apps[i].until(r => r.players.length === i + 1);
  }
  await apps[0].until(r => r.players.length === names.length);
  return { apps, code, ids: apps.map(a => a.state.you) };
}

test('Lobby, Reihenfolge und eine ganze Partie zu zweit', async () => {
  const env = start();
  const { apps: [lena, tim], code, ids: [lenaId, timId] } = await lobbyOf(env, ['Lena', 'Tim']);
  assert.match(code, G.CODE_RE);
  assert.equal(lena.state.host, lenaId);
  assert.deepEqual(lena.state.players.map(p => [p.name, p.online]), [['Lena', true], ['Tim', true]]);
  assert.ok(!JSON.stringify(lena.msgs).includes('geraet'), 'Geräteschlüssel gehen nie an Apps');

  tim.send({ t: 'start' });
  assert.equal(await tim.error('start'), 'not-host');
  lena.send({ t: 'order', ids: [timId, lenaId] });
  await tim.until(r => r.players[0].id === timId);
  lena.send({ t: 'start' });
  await Promise.all([lena, tim].map(a => a.until(r => r.status === 'playing')));

  // Wer dran ist, würfelt einmal und trägt das erste freie Feld ein. Ein Countdown wird bis zum Ende gewürfelt.
  const byId = { [lenaId]: lena, [timId]: tim };
  const order = [];
  let seq = -1;
  for (let guard = 0; guard < 400; guard++) {
    const r = await lena.until(x => x.seq > seq);
    seq = r.seq;
    if (r.status !== 'playing') break;
    const who = byId[r.turn.player];
    if (r.turn.phase === 'cd') who.send({ t: 'cdRoll', stage: r.cdGame.stage });
    else if (r.dice.turn !== r.turn.no) who.send({ t: 'roll', n: 1 });
    else { order.push(r.turn.player); who.send({ t: 'enter', field: free(r, r.turn.player)[0] }); }
  }
  const end = lena.state;
  assert.equal(end.status, 'lobby');
  assert.equal(order.length, 30);
  assert.ok(order.every((id, i) => id === (i % 2 ? lenaId : timId)), 'Tim fängt an, dann immer abwechselnd');
  assert.deepEqual(end.last.ranking.map(x => x.id).sort(), [lenaId, timId].sort());
  const timEnd = await tim.until(r => r.seq === end.seq);
  assert.deepEqual(timEnd.last, end.last);
  await env.stop(lena, tim);
});

test('Doppelter Tipp und falsche Züge werden abgelehnt', async () => {
  const env = start();
  const { apps: [lena, tim] } = await lobbyOf(env, ['Lena', 'Tim']);
  lena.send({ t: 'start' });
  await lena.until(r => r.status === 'playing');
  tim.send({ t: 'roll', n: 1 });
  assert.equal(await tim.error('roll'), 'not-your-turn');
  lena.send({ t: 'roll', n: 1 });
  lena.send({ t: 'roll', n: 1 });
  assert.equal(await lena.error('roll'), 'stale');
  const r = await lena.until(x => x.dice.rolls === 1);
  lena.send({ t: 'enter', field: 'gibtsnicht' });
  assert.equal(await lena.error('enter'), 'bad-message');
  lena.send({ t: 'hold', i: 2, on: 'ja' });
  assert.equal(await lena.error('hold'), 'bad-message');
  lena.send({ t: 'hold', i: 2, on: true });
  await lena.until(x => x.dice.held[2]);
  lena.send({ t: 'enter', field: 'chance' });
  // Nicht auf Tims Zug warten: Bei 4 gleichen im ersten Wurf spielt Lena erst noch den Countdown.
  const lenaId = lena.state.you;
  const after = await tim.until(x => !!x.scores[lenaId] && x.scores[lenaId].chance !== undefined);
  assert.equal(after.scores[lenaId].chance, r.dice.vals.reduce((a, b) => a + b, 0));
  await env.stop(lena, tim);
});

test('Zugzeit: Wer nichts tut, bekommt ein zufälliges Feld gestrichen', async () => {
  const env = start({ turn: 300, cd: 300, grace: 50 });
  const { apps: [lena] } = await lobbyOf(env, ['Lena']);
  lena.send({ t: 'start' });
  const r = await lena.until(x => x.events.some(e => e.type === 'timeout'), 3000);
  const ev = r.events.find(e => e.type === 'timeout');
  assert.equal(r.scores[lena.state.you][ev.field], 0);
  // „Bei mir ist die Zeit um“ vor Ablauf: Der Server prüft selbst und schickt nur den Stand
  lena.send({ t: 'expired' });
  await lena.next(m => m.t === 'state');
  await env.stop(lena);
});

test('Wiederverbinden: mit Geräteschlüssel und Code zurück, Fremde kommen nicht rein', async () => {
  const env = start();
  const { apps: [lena, tim], code, ids: [lenaId] } = await lobbyOf(env, ['Lena', 'Tim']);
  lena.send({ t: 'start' });
  await tim.until(r => r.status === 'playing');
  await lena.close();
  await tim.until(r => r.players.find(p => p.id === lenaId).online === false);   // grauer Punkt

  const again = app(env.ws());
  await again.opened;
  assert.equal((await again.hello(KEY('Lena'), code.toLowerCase())).t, 'welcome');
  const back = await again.until(r => r.you === lenaId);
  assert.equal(back.status, 'playing');
  await tim.until(r => r.players.find(p => p.id === lenaId).online === true);

  const stranger = app(env.ws());
  await stranger.opened;
  await stranger.hello(KEY('Mallory'), code);
  assert.equal(await stranger.error('hello'), 'not-in-room');
  stranger.send({ t: 'join', code, name: 'Mallory' });
  assert.equal(await stranger.error('join'), 'game-running');
  await env.stop(again, tim, stranger);
});

test('Entfernen, Verlassen, Zum Hauptmenü und leere Lobbys', async () => {
  const env = start();
  const { apps: [lena, tim, mia], code, ids: [, timId, miaId] } = await lobbyOf(env, ['Lena', 'Tim', 'Mia']);
  tim.send({ t: 'kick', id: miaId });
  assert.equal(await tim.error('kick'), 'not-host');
  lena.send({ t: 'kick', id: miaId });
  assert.equal(await mia.error(), 'removed');
  await lena.until(r => r.players.length === 2);
  mia.send({ t: 'roll', n: 1 });
  assert.equal(await mia.error('roll'), 'not-in-room');

  tim.send({ t: 'away' });
  await tim.next(m => m.t === 'away');
  await lena.until(r => r.players.find(p => p.id === timId).online === false);
  tim.send({ t: 'join', code, name: 'Tim' });   // gleiches Gerät: wieder dieselbe Person, kein „Tim 2“
  const t2 = await tim.until(r => r.you === timId);
  assert.equal(t2.players.length, 2);

  tim.send({ t: 'leave' });
  await tim.next(m => m.t === 'left');
  await lena.until(r => r.players.length === 1);
  lena.send({ t: 'leave' });
  await lena.next(m => m.t === 'left');
  mia.send({ t: 'join', code, name: 'Mia' });
  assert.equal(await mia.error('join'), 'room-not-found');
  await env.stop(lena, tim, mia);
});

test('Kaputte und bösartige Nachrichten bringen den Server nicht aus dem Tritt', async () => {
  const env = start();
  const c = app(env.ws());
  await c.opened;
  c.send('kaputt{');
  assert.equal(await c.error(), 'bad-message');
  c.send('[1,2]');
  assert.equal(await c.error(), 'bad-message');
  c.send({ t: 'constructor' });
  assert.equal(await c.error('constructor'), 'bad-message');
  c.send({ t: 'roll', n: 1 });
  assert.equal(await c.error('roll'), 'no-hello');
  c.send({ t: 'hello', v: 0, key: KEY('Lena') });
  assert.equal(await c.error('hello'), 'update-needed');
  c.send({ t: 'hello', v: G.PROTOCOL - 1, key: KEY('Lena') });   // Apps von vor den Online-Bots
  assert.equal(await c.error('hello'), 'update-needed');
  c.send({ t: 'hello', v: G.PROTOCOL + 1, key: KEY('Lena') });
  assert.equal(await c.error('hello'), 'server-old');
  c.send({ t: 'hello', v: G.PROTOCOL, key: 'kurz' });
  assert.equal(await c.error('hello'), 'bad-message');
  c.send({ t: 'ping' });
  assert.equal(typeof (await c.next(m => m.t === 'pong')).now, 'number');
  assert.equal((await c.hello(KEY('Lena'))).t, 'welcome');
  c.send({ t: 'create', name: '<img src=x onerror=alert(1)>' });
  assert.equal(await c.error('create'), 'name-invalid');
  c.send({ t: 'join', code: 'AEIO', name: 'Lena' });
  assert.equal(await c.error('join'), 'room-not-found');
  c.send({ t: 'join', code: 'ZZZZ', name: 'Lena' });
  assert.equal(await c.error('join'), 'room-not-found');
  c.send({ t: 'enter', field: 'chance' });
  assert.equal(await c.error('enter'), 'not-in-room');
  c.send({ t: 'create', name: 'x'.repeat(5000) });
  assert.equal(await c.error(), 'bad-message');
  // Danach geht alles ganz normal
  c.send({ t: 'create', name: '  Dr.   Würfel ' });
  assert.equal((await c.until(r => r.players.length === 1)).players[0].name, 'Dr. Würfel');
  await env.stop(c);
});

test('Bremsen: nicht zu viele neue Lobbys, nicht zu viele Nachrichten', async () => {
  const env = start();
  const c = app(env.ws());
  await c.opened;
  await c.hello(KEY('Lena'));
  for (let i = 0; i < 6; i++) {
    c.send({ t: 'create', name: 'Lena' });
    await c.next(m => m.t === 'state');
  }
  c.send({ t: 'create', name: 'Lena' });
  assert.equal(await c.error('create'), 'too-many');
  // Eine Flut von Nachrichten: erst abgelehnt, dann ist die Verbindung zu
  for (let i = 0; i < 350; i++) c.send({ t: 'ping' });
  assert.equal(await c.error(), 'too-many');
  await c.closed;
  await env.stop(c);
});

test('HTTP: Die App, der Status unter /health, sonst nur WebSocket', async () => {
  const env = start();
  const health = await fetch(env.http() + '/health');
  assert.deepEqual(await health.json(), { app: 'hexa', protocol: G.PROTOCOL, online: true, ok: true });
  assert.equal(health.headers.get('access-control-allow-origin'), '*');
  const page = await fetch(env.http() + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /<title>HEXA: Countdown<\/title>/);
  for (const [path, type] of [['/js/online.js', /javascript/], ['/css/hexa.css', /css/], ['/lang/de.js', /javascript/], ['/icons/icon-192.png', /png/], ['/manifest.webmanifest', /manifest/], ['/sw.js', /javascript/]]) {
    const r = await fetch(env.http() + path);
    assert.equal(r.status, 200, path);
    assert.match(r.headers.get('content-type'), type, path);
    await r.body.cancel();
  }
  // Server-Code, Doku, Werkzeuge und Tricks mit Pfaden bleiben draußen
  for (const path of ['/server/main.js', '/package.json', '/Dockerfile', '/hexa.sqlite', '/docs/online-konzept.md', '/README.md', '/tools/bot-sim.js', '/tests/bot.test.js',
    '/.git/config', '/js/../server/game.js', '/%2e%2e/package.json', '/js/%2e%2e/package.json', '/css/', '/js/app.js%3F', '/nichts.html']) {
    const r = await fetch(env.http() + path);
    assert.equal(r.status, 404, path);
    await r.body.cancel();
  }
  // HEAD: dieselben Kopfzeilen, kein Inhalt
  const head = await fetch(env.http() + '/js/app.js', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.match(head.headers.get('content-type'), /javascript/);
  assert.equal(await head.text(), '');
  const plain = await fetch(env.http() + '/ws');
  assert.equal(plain.status, 426);
  await plain.body.cancel();
  await env.stop();
});

test('HTTP: Der Service Worker kommt immer frisch', async () => {
  const env = start();
  const r = await fetch(env.http() + '/sw.js');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-cache');
  assert.match(await r.text(), /addEventListener\('fetch'/);
  await env.stop();
});

test('HTTP: Produktion leitet die Startseite zur App weiter, Server und Dateien bleiben', async () => {
  const env = start(G.TIMES, { redirectHosts: ['127.0.0.1'], appUrl: 'https://hexa-countdown.app/' });
  for (const path of ['/', '/index.html']) {
    const r = await fetch(env.http() + path, { redirect: 'manual' });
    assert.equal(r.status, 302, path);
    assert.equal(r.headers.get('location'), 'https://hexa-countdown.app/', path);
    await r.body?.cancel();
  }
  const health = await fetch(env.http() + '/health');
  assert.equal((await health.json()).app, 'hexa');
  const js = await fetch(env.http() + '/js/app.js');
  assert.equal(js.status, 200);
  await js.body.cancel();
  const plain = await fetch(env.http() + '/ws');
  assert.equal(plain.status, 426);
  await plain.body.cancel();
  await env.stop();
});

test('Statistik: Online-Start zählt der Server, lokale Spiele kommen per POST /count', async () => {
  const env = start();
  const stats = async () => (await fetch(env.http() + '/stats.json')).json();
  assert.deepEqual((await stats()).total, { all: 0, online: 0, local: 0, daily: 0 });

  const { apps: [lena, tim] } = await lobbyOf(env, ['Lena', 'Tim']);
  lena.send({ t: 'start' });
  await tim.until(r => r.status === 'playing');
  lena.send({ t: 'start' });
  assert.equal(await lena.error('start'), 'game-running');   // zählt nicht doppelt

  for (let i = 0; i < 3; i++) {
    const r = await fetch(env.http() + '/count', { method: 'POST' });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
  }
  const s = await stats();
  assert.deepEqual(s.total, { all: 4, online: 1, local: 3, daily: 0 });
  assert.deepEqual(s.last24h, s.total);
  assert.deepEqual(s.last365d, s.total);
  assert.match(s.since, /^\d{4}-\d\d-\d\d$/);

  const page = await fetch(env.http() + '/stats');
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  const html = await page.text();
  assert.match(html, /Gestartete Spiele/);
  assert.match(html, /Insgesamt<\/th><td class="all">4<\/td><td>1<\/td><td>3<\/td><td>0<\/td>/);

  // Tagesspiele mit ?kind=daily, andere Arten gibt es nicht
  const daily = await fetch(env.http() + '/count?kind=daily', { method: 'POST' });
  assert.equal(daily.status, 204);
  const odd = await fetch(env.http() + '/count?kind=online', { method: 'POST' });
  assert.equal(odd.status, 400);
  await odd.body.cancel();
  assert.deepEqual((await stats()).total, { all: 5, online: 1, local: 3, daily: 1 });
  // Nur POST, und nicht beliebig oft von derselben Verbindung
  const get = await fetch(env.http() + '/count');
  assert.equal(get.status, 405);
  await get.body.cancel();
  // Höchstens 10 Meldungen in 10 Minuten. 4 waren es schon (3 lokale, 1 Tagesspiel).
  const codes = [];
  for (let i = 0; i < 9; i++) {
    const r = await fetch(env.http() + '/count', { method: 'POST' });
    codes.push(r.status);
    await r.body?.cancel();
  }
  assert.deepEqual(codes, [204, 204, 204, 204, 204, 204, 429, 429, 429]);
  assert.equal((await stats()).total.local, 9);
  await env.stop(lena, tim);
});

test('Bremsen zählen pro Anschluss: IPv4 einzeln, IPv6 pro /64-Netz', () => {
  assert.equal(ipKey('160.79.106.134'), '160.79.106.134');
  assert.equal(ipKey('::ffff:160.79.106.134'), '160.79.106.134');
  assert.equal(ipKey('2001:db8:1234:5678:abcd::1'), '2001:db8:1234:5678::/64');
  assert.equal(ipKey('2001:0db8:1234:5678:0:0:0:1'), '2001:db8:1234:5678::/64');
  assert.equal(ipKey('[2001:DB8:1234:5678::9]'), '2001:db8:1234:5678::/64');
  assert.equal(ipKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(ipKey('fe80::1%eth0'), 'fe80:0:0:0::/64');
  assert.equal(ipKey(undefined), '?');
});

test('Bots: Der Host holt sie dazu, sie spielen genau einmal und alle sehen zu', async () => {
  // Schnelleres Tempo nur für diesen Test. botDelays aus js/config.js ist dasselbe Objekt, das der Server nutzt.
  const pace = Config.botDelays;
  const saved = Object.assign({}, pace);
  Object.keys(pace).forEach(k => { pace[k] = 30; });
  const env = start();
  try {
    const { apps: [lena, tim], ids: [lenaId, timId] } = await lobbyOf(env, ['Lena', 'Tim']);
    tim.send({ t: 'addBot' });
    assert.equal(await tim.error('addBot'), 'not-host');
    lena.send({ t: 'addBot', level: 'gottgleich' });
    assert.equal(await lena.error('addBot'), 'bad-message');
    lena.send({ t: 'addBot', level: 'easy' });
    const withBot = await tim.until(r => r.players.length === 3);
    const bot = withBot.players.find(p => p.bot);
    assert.ok(bot && G.onlineName(bot.name) === bot.name);
    assert.equal(bot.online, false);
    assert.equal(bot.level, 'easy');
    // Die Stufe wechselt nur der Host
    tim.send({ t: 'botLevel', id: bot.id, level: 'hard' });
    assert.equal(await tim.error('botLevel'), 'not-host');
    lena.send({ t: 'botLevel', id: bot.id, level: 'medium' });
    await tim.until(r => r.players.find(p => p.id === bot.id).level === 'medium');
    lena.send({ t: 'order', ids: [bot.id, lenaId, timId] });
    await tim.until(r => r.players[0].id === bot.id);
    lena.send({ t: 'start' });
    // Der Bot spielt seinen Zug allein, danach ist Lena dran
    const after = await tim.until(r => r.status === 'playing' && r.turn.player === lenaId, 15000);
    assert.equal(Object.keys(after.scores[bot.id]).length, 1, 'genau ein Feld: kein Schritt doppelt');
    const lenaView = await lena.until(r => r.seq === after.seq);
    assert.deepEqual(lenaView.scores, after.scores);
    // Beide Apps haben die Würfel des Bots gesehen
    for (const a of [lena, tim]) assert.ok(a.msgs.some(m => m.t === 'state' && m.room.dice.owner === bot.id && m.room.dice.rolls >= 1));
    // Lena spielt, danach wieder Tim und dann der Bot: Die Reihe läuft weiter
    lena.send({ t: 'roll', n: 1 });
    await lena.until(r => r.dice.owner === lenaId && r.dice.rolls === 1);
    lena.send({ t: 'enter', field: free(lena.state, lenaId)[0] });
    // Hatte Lena im ersten Wurf 4 gleiche (etwa jedes 20. Mal), kommt erst ihr Countdown. Den würfelt sie zu Ende.
    let r = await lena.until(x => x.turn.player !== lenaId || x.turn.phase === 'cd');
    while (r.turn.player === lenaId && r.turn.phase === 'cd') {
      lena.send({ t: 'cdRoll', stage: r.cdGame.stage });
      const seq = r.seq;
      r = await lena.until(x => x.seq > seq);
    }
    await tim.until(x => x.turn.player === timId);
    await env.stop(lena, tim);
  } catch (e) {
    await env.stop();
    throw e;
  } finally {
    Object.assign(pace, saved);
  }
});

test('Eigene Würfel: Wahl in der Lobby, Wert eintragen, kein Zeitlimit, überspringen', async () => {
  const env = start({ turn: 300, cd: 300, grace: 50 });
  const { apps: [lena, tim], ids: [lenaId, timId] } = await lobbyOf(env, ['Lena', 'Tim']);
  tim.send({ t: 'via', via: 'own' });
  assert.equal(await tim.error('via'), 'not-host');
  lena.send({ t: 'via', via: 'own' });
  await tim.until(r => r.via === 'own');
  lena.send({ t: 'start' });
  const r0 = await tim.until(r => r.status === 'playing');
  assert.equal(r0.turn.deadline, null);
  lena.send({ t: 'roll', n: 1 });
  assert.equal(await lena.error('roll'), 'own-dice');
  // Länger als die (kurze) Zugzeit warten: Es wird nichts gestrichen
  await new Promise(res => setTimeout(res, 700));
  assert.equal(Object.keys(lena.state.scores).length, 0);
  lena.send({ t: 'enter', field: 'gstrasse', pts: 40, cd: 20 });
  const r1 = await tim.until(r => r.turn.player === timId);
  assert.equal(r1.scores[lenaId].gstrasse, 40);
  assert.deepEqual(r1.cds[lenaId], [20]);
  lena.send({ t: 'fix', field: 'gstrasse', pts: 0 });
  await tim.until(r => r.scores[lenaId].gstrasse === 0);
  // Tim ist nicht dran zu erreichen: Lena (Host) überspringt
  lena.send({ t: 'skip', turn: r1.turn.no });
  const r2 = await tim.until(r => r.turn.player === lenaId);
  assert.equal(Object.values(r2.scores[timId]).join(), '0');
  await env.stop(lena, tim);
});

test('Online aus (enableOnline: false): Der Server nimmt niemanden an', async () => {
  const env = start(G.TIMES, { online: false });
  const c = app(env.ws());
  await c.opened;
  c.send({ t: 'hello', v: G.PROTOCOL, key: KEY('Lena') });
  assert.equal(await c.error('hello'), 'online-off');
  c.send({ t: 'create', name: 'Lena' });
  assert.equal(await c.error('create'), 'no-hello');
  const health = await fetch(env.http() + '/health');
  assert.deepEqual(await health.json(), { app: 'hexa', protocol: G.PROTOCOL, online: false, ok: true });
  await env.stop(c);
});

test('Bremsen hinter dem Proxy: zählt die echte Adresse aus X-Forwarded-For, aber nur vom Proxy', async () => {
  // Der Proxy von Coolify hängt die echte Adresse als letzten Eintrag an
  assert.equal(clientIp('172.18.0.5', '203.0.113.7'), '203.0.113.7');
  assert.equal(clientIp('10.0.1.2', '1.1.1.1, 203.0.113.7'), '203.0.113.7');   // davor kann jeder etwas schreiben
  assert.equal(clientIp('::ffff:172.18.0.5', ' 2001:db8::1 '), '2001:db8::1');
  assert.equal(clientIp('172.18.0.5', null), '172.18.0.5');
  // Direkt von außen: Der Header zählt nicht, sonst ließe sich die Bremse damit umgehen
  assert.equal(clientIp('203.0.113.9', '1.2.3.4'), '203.0.113.9');
  assert.equal(clientIp(undefined, '1.2.3.4'), undefined);
  for (const host of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.1', '192.168.178.20', '::ffff:10.0.0.1', '::1', 'fd12:3456::1', 'fe80::1%eth0']) assert.ok(isPrivate(host), host);
  for (const host of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.0.1', '2001:db8::1', 'fd', '', undefined]) assert.ok(!isPrivate(host), String(host));

  // Die Tests verbinden sich von 127.0.0.1, gelten also als Proxy
  const env = start();
  const count = async ip => {
    const r = await fetch(env.http() + '/count', { method: 'POST', headers: { 'x-forwarded-for': ip } });
    await r.body?.cancel();
    return r.status;
  };
  const first = [];
  for (let i = 0; i < 11; i++) first.push(await count('203.0.113.1'));
  assert.deepEqual(first.slice(-2), [204, 429]);
  assert.equal(await count('203.0.113.2'), 204);              // ein anderer Anschluss
  assert.equal(await count('198.51.100.1, 203.0.113.1'), 429);   // gefälschter Eintrag davor hilft nicht
  // WebSocket genauso: höchstens 20 offene Verbindungen pro Anschluss
  const many = Array.from({ length: 20 }, () => app(env.ws(), { 'x-forwarded-for': '203.0.113.3' }));
  await Promise.all(many.map(c => c.opened));
  const extra = app(env.ws(), { 'x-forwarded-for': '203.0.113.3' });
  await assert.rejects(extra.opened);
  const other = app(env.ws(), { 'x-forwarded-for': '203.0.113.4' });
  await other.opened;
  await env.stop(...many, other);
});

test('Anhalten und Neustart: Verbindungen gehen mit 1001 zu, das Spiel läuft auf dem neuen Server weiter', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hexa-'));
  const file = join(dir, 'hexa.sqlite');
  try {
    const old = start(G.TIMES, { db: openDb(file), instance: 'alt' });
    const { apps: [lena, tim], code, ids: [lenaId, timId] } = await lobbyOf(old, ['Lena', 'Tim']);
    lena.send({ t: 'start' });
    const r0 = await tim.until(r => r.status === 'playing');
    // Update: Der alte Server hält an und schließt alle Verbindungen mit 1001 „Server hält an“.
    // Der WebSocket von Bun meldet 1001 als 1000. Browser und Node sehen 1001, darum zählt hier der Grund.
    await old.halt();
    for (const a of [lena, tim]) {
      const e = await a.closed;
      assert.equal(e.reason, 'Server hält an');
      assert.ok([1000, 1001].includes(e.code), String(e.code));
    }
    const dead = app(old.ws());
    await assert.rejects(dead.opened);   // der alte nimmt niemanden mehr an
    old.db.close();

    // Der neue Server nimmt dieselbe Datei. Lena und Tim verbinden sich neu und spielen weiter.
    const env = start(G.TIMES, { db: openDb(file), instance: 'neu' });
    const lena2 = app(env.ws());
    const tim2 = app(env.ws());
    await Promise.all([lena2.opened, tim2.opened]);
    await lena2.hello(KEY('Lena'), code);
    await tim2.hello(KEY('Tim'), code);
    const back = await lena2.until(r => r.status === 'playing');
    assert.equal(back.turn.no, r0.turn.no);
    assert.deepEqual(back.players.map(p => p.id), [lenaId, timId]);
    const who = back.turn.player === lenaId ? lena2 : tim2;
    who.send({ t: 'roll', n: 1 });
    await lena2.until(r => r.dice.rolls === 1 && r.dice.owner === back.turn.player);
    assert.equal(env.hub.stats().rooms, 1);
    await env.stop(lena2, tim2);
    env.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
