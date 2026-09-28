// Tests für den ganzen Server: echte WebSocket-Verbindungen gegen echte Server-Instanzen.
// Zwei Instanzen teilen sich eine Datenbank, wie auf Deno Deploy. Ausführen mit: deno task test
import assert from 'node:assert/strict';
import { createHub, ipKey } from '../main.js';
import * as G from '../game.js';

const quiet = { error: () => {}, warn: () => {}, log: () => {} };

async function servers(n, times = G.TIMES) {
  const kv = await Deno.openKv(':memory:');
  const hubs = [];
  const running = [];
  for (let i = 0; i < n; i++) {
    const hub = createHub({ kv, instance: 'inst' + i, times, log: quiet });
    hubs.push(hub);
    running.push(Deno.serve({ port: 0, hostname: '127.0.0.1', onListen() {} }, hub.handle));
  }
  return {
    ws: i => `ws://127.0.0.1:${running[i].addr.port}/ws`,
    http: i => `http://127.0.0.1:${running[i].addr.port}`,
    async stop(...clients) {
      await Promise.all(clients.map(c => c.close()));
      for (const hub of hubs) await hub.close();
      for (const s of running) await s.shutdown();
      kv.close();
    },
  };
}

// Eine simulierte App. next wartet auf die nächste passende Nachricht, until auf einen passenden Stand.
function app(url) {
  const ws = new WebSocket(url);
  const msgs = [];
  let wake = null;
  const c = {
    msgs,
    state: null,
    pos: 0,
    opened: new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; }),
    closed: new Promise(resolve => { ws.onclose = resolve; }),
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

async function lobbyOf(env, names, at = names.map((_, i) => i % 2)) {
  const apps = names.map((n, i) => app(env.ws(at[i])));
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

Deno.test('Zwei Instanzen, eine Datenbank: Lobby, Reihenfolge und eine ganze Partie', async () => {
  const env = await servers(2);
  const { apps: [lena, tim], code, ids: [lenaId, timId] } = await lobbyOf(env, ['Lena', 'Tim']);
  assert.match(code, G.CODE_RE);
  assert.equal(lena.state.host, lenaId);
  assert.deepEqual(lena.state.players.map(p => [p.name, p.online]), [['Lena', true], ['Tim', true]]);
  assert.ok(!JSON.stringify(lena.msgs).includes('geraet'), 'Geräteschlüssel gehen nie an Apps');

  tim.send({ t: 'start' });
  assert.equal(await tim.error('start'), 'not-host');
  lena.send({ t: 'order', ids: [timId, lenaId] });
  await tim.until(r => r.players[0].id === timId);   // kommt über die andere Instanz an
  lena.send({ t: 'start' });
  await tim.until(r => r.status === 'playing');

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

Deno.test('Doppelter Tipp und falsche Züge werden abgelehnt', async () => {
  const env = await servers(1);
  const { apps: [lena, tim] } = await lobbyOf(env, ['Lena', 'Tim'], [0, 0]);
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
  const after = await tim.until(x => x.turn && x.turn.player === tim.state.you);
  assert.equal(after.scores[lena.state.you].chance, r.dice.vals.reduce((a, b) => a + b, 0));
  await env.stop(lena, tim);
});

Deno.test('Zugzeit: Wer nichts tut, bekommt ein zufälliges Feld gestrichen', async () => {
  const env = await servers(1, { turn: 300, cd: 300, grace: 50 });
  const { apps: [lena] } = await lobbyOf(env, ['Lena'], [0]);
  lena.send({ t: 'start' });
  const r = await lena.until(x => x.events.some(e => e.type === 'timeout'), 3000);
  const ev = r.events.find(e => e.type === 'timeout');
  assert.equal(r.scores[lena.state.you][ev.field], 0);
  // „Bei mir ist die Zeit um“ vor Ablauf: Der Server prüft selbst und schickt nur den Stand
  lena.send({ t: 'expired' });
  await lena.next(m => m.t === 'state');
  await env.stop(lena);
});

Deno.test('Wiederverbinden: mit Geräteschlüssel und Code zurück, Fremde kommen nicht rein', async () => {
  const env = await servers(2);
  const { apps: [lena, tim], code, ids: [lenaId] } = await lobbyOf(env, ['Lena', 'Tim']);
  lena.send({ t: 'start' });
  await tim.until(r => r.status === 'playing');
  await lena.close();
  await tim.until(r => r.players.find(p => p.id === lenaId).online === false);   // grauer Punkt

  const again = app(env.ws(1));
  await again.opened;
  assert.equal((await again.hello(KEY('Lena'), code.toLowerCase())).t, 'welcome');
  const back = await again.until(r => r.you === lenaId);
  assert.equal(back.status, 'playing');
  await tim.until(r => r.players.find(p => p.id === lenaId).online === true);

  const stranger = app(env.ws(0));
  await stranger.opened;
  await stranger.hello(KEY('Mallory'), code);
  assert.equal(await stranger.error('hello'), 'not-in-room');
  stranger.send({ t: 'join', code, name: 'Mallory' });
  assert.equal(await stranger.error('join'), 'game-running');
  await env.stop(again, tim, stranger);
});

Deno.test('Entfernen, Verlassen, Zum Hauptmenü und leere Lobbys', async () => {
  const env = await servers(2);
  const { apps: [lena, tim, mia], code, ids: [, timId, miaId] } = await lobbyOf(env, ['Lena', 'Tim', 'Mia'], [0, 1, 1]);
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

Deno.test('Kaputte und bösartige Nachrichten bringen den Server nicht aus dem Tritt', async () => {
  const env = await servers(1);
  const c = app(env.ws(0));
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

Deno.test('Bremsen: nicht zu viele neue Lobbys, nicht zu viele Nachrichten', async () => {
  const env = await servers(1);
  const c = app(env.ws(0));
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

Deno.test('HTTP: Startseite für einen schnellen Test, sonst nur WebSocket', async () => {
  const env = await servers(1);
  const home = await fetch(env.http(0) + '/');
  assert.deepEqual(await home.json(), { app: 'hexa', protocol: G.PROTOCOL, ok: true });
  assert.equal(home.headers.get('access-control-allow-origin'), '*');
  const plain = await fetch(env.http(0) + '/ws');
  assert.equal(plain.status, 426);
  await plain.body.cancel();
  const missing = await fetch(env.http(0) + '/geheim');
  assert.equal(missing.status, 404);
  await missing.body.cancel();
  await env.stop();
});

Deno.test('Bremsen zählen pro Anschluss: IPv4 einzeln, IPv6 pro /64-Netz', () => {
  assert.equal(ipKey('160.79.106.134'), '160.79.106.134');
  assert.equal(ipKey('::ffff:160.79.106.134'), '160.79.106.134');
  assert.equal(ipKey('2001:db8:1234:5678:abcd::1'), '2001:db8:1234:5678::/64');
  assert.equal(ipKey('2001:0db8:1234:5678:0:0:0:1'), '2001:db8:1234:5678::/64');
  assert.equal(ipKey('[2001:DB8:1234:5678::9]'), '2001:db8:1234:5678::/64');
  assert.equal(ipKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(ipKey('fe80::1%eth0'), 'fe80:0:0:0::/64');
  assert.equal(ipKey(undefined), '?');
});
