/* HEXA – Server für den Online-Modus.
   Nur Bun, keine weiteren Pakete: Bun.serve für HTTP und WebSocket, SQLite (bun:sqlite) als Datenbank.
   Lokal starten: bun run dev (http://localhost:3000, WebSocket unter /ws). Tests: bun run test
   Im Betrieb: Docker-Container mit Coolify auf dem eigenen Server, siehe Dockerfile und server/README.md.

   Jede App hat eine WebSocket-Verbindung. Darüber schickt sie Wünsche wie „würfeln“ oder „Große Straße
   eintragen“. Der Server prüft sie, würfelt selbst und schickt allen in der Lobby den ganzen neuen Stand.
   Es läuft immer nur ein Server. Alle Verbindungen einer Lobby hängen also an ihm. */
import Config from '../js/config.js';
import * as G from './game.js';
import * as S from './store.js';
import * as St from './stats.js';
import { openDb } from './db.js';

const MAX_MSG = 4096;                 // Zeichen pro Nachricht
const MAX_CONNS_PER_IP = 20;
// Lobbys erstellen und beitreten: so oft pro Minute und Internetverbindung, lokale Spiele melden: so oft in 10 Minuten.
// Gemerkt nur im Arbeitsspeicher.
const LIMITS = { create: [6, 60_000], join: [12, 60_000], count: [10, 600_000] };
const STATS_FRESH = 30_000;           // so lange zeigt /stats denselben Stand, damit Neuladen die Datenbank schont
const MSG_WINDOW = 10_000;
const MSG_SOFT = 100;                 // mehr Nachrichten in 10 Sekunden werden abgelehnt
const MSG_HARD = 300;                 // noch mehr: Verbindung zu
const MAINTAIN_MS = 60_000;           // so oft vergessen die Bremsen alte Einträge
const PURGE_MS = 60 * 60_000;         // so oft löscht der Server abgelaufene Lobbys und alte Stunden der Statistik
const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;

// Die App selbst liefert der Server auch aus. Dann reicht zum Testen eine Adresse für App und WebSocket.
// Nur diese Dateien und Ordner, alles andere im Repo (Server-Code, Doku, Werkzeuge) bleibt verborgen.
const ROOT = new URL('../', import.meta.url);
const PUBLIC_FILES = ['index.html', 'favicon.svg', 'manifest.webmanifest', 'sw.js'];
const PUBLIC_DIRS = ['css/', 'js/', 'lang/', 'fonts/', 'icons/'];
// Produktion: Wer den Server im Browser öffnet, landet bei der App unter der eigenen Domain. So gibt es nur eine
// Adresse, unter der man HEXA installiert (eigener Speicher pro Adresse). /ws, /health und die Dateien bleiben.
// Testadressen der Branches und localhost liefern die App weiter selbst aus.
const APP_URL = 'https://hexa-countdown.app/';
const REDIRECT_HOSTS = ['backend.hexa-countdown.app'];
const TYPES = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', woff2: 'font/woff2',
  webmanifest: 'application/manifest+json', txt: 'text/plain; charset=utf-8',
};
async function appFile(pathname) {
  let p;
  try { p = decodeURIComponent(pathname).replace(/^\/+/, ''); } catch (e) { return null; }
  if (p === '') p = 'index.html';
  if (/\.\.|\\|\0|\/\/|[?#]/.test(p)) return null;
  if (!PUBLIC_FILES.includes(p) && !PUBLIC_DIRS.some(d => p.startsWith(d))) return null;
  const type = TYPES[p.split('.').pop()];
  if (!type) return null;
  const file = Bun.file(new URL(p, ROOT));
  if (!(await file.exists())) return null;
  // Code immer frisch, damit nach einem neuen Build nicht noch alte Teile im Browser stecken. Schriften und Icons ändern sich kaum.
  const still = p.startsWith('fonts/') || p.startsWith('icons/');
  return new Response(file, {
    headers: { 'content-type': type, 'cache-control': still ? 'public, max-age=86400' : 'no-cache', 'x-content-type-options': 'nosniff' },
  });
}

// Der Geräteschlüssel liegt nur als Hash auf dem Server.
async function hashKey(key) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hexa:' + key));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}
const codeOf = raw => {
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return G.CODE_RE.test(s) ? s : null;
};
// Die Bremsen zählen pro Internetverbindung. Bei IPv6 hat ein Anschluss meist ein ganzes /64-Netz mit
// unzähligen Adressen, darum zählt dort nur der vordere Teil. IPv4 kommt manchmal als ::ffff:1.2.3.4 an.
export function ipKey(host) {
  if (typeof host !== 'string' || !host) return '?';
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const v4 = h.match(/^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) return v4[1];
  if (!h.includes(':')) return h;
  const [head, tail = ''] = h.split('::');
  const a = head ? head.split(':') : [];
  const b = tail ? tail.split(':') : [];
  const full = h.includes('::') ? a.concat(Array(Math.max(0, 8 - a.length - b.length)).fill('0'), b) : a;
  return full.slice(0, 4).map(x => x.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
// Adressen aus privaten Netzen: localhost, Docker, der Proxy von Coolify
export function isPrivate(host) {
  if (typeof host !== 'string') return false;
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const v4 = h.match(/^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h);
}
// Wer ist es wirklich? Hinter dem Proxy von Coolify kommt jede Verbindung vom Proxy. Die echte Adresse hängt er
// als letzten Eintrag an X-Forwarded-For an. Davor kann jeder etwas hineinschreiben, darum zählt nur der letzte.
// Und nur, wenn die Verbindung aus einem privaten Netz kommt. Direkt von außen ließe sich der Header sonst fälschen.
export function clientIp(peer, forwarded) {
  if (forwarded && isPrivate(peer)) {
    const last = forwarded.split(',').pop().trim();
    if (last) return last;
  }
  return peer;
}
const replace = (target, source) => {
  Object.keys(target).forEach(k => { delete target[k]; });
  Object.assign(target, source);
};

// Ein Hub ist der Server ohne HTTP-Port: Bun.serve({ fetch: hub.fetch, websocket: hub.websocket }).
// db: Datenbank aus openDb (db.js). instance: Name dieses Laufs, steckt in den Verbindungen der Lobbys.
// online: false nimmt keine Verbindungen an (enableOnline in js/config.js).
// redirectHosts, appUrl: Unter diesen Adressen leitet die Startseite zur App weiter (Tests setzen eigene).
export function createHub({ db, instance = G.randomId(8), times = G.TIMES, rng = G.fairRandom, online = Config.enableOnline, log = console, redirectHosts = REDIRECT_HOSTS, appUrl = APP_URL } = {}) {
  const conns = new Set();
  const rooms = new Map();            // Code → { conns, timer, room }: Lobbys mit Verbindungen
  const ips = new Map();              // Internetverbindung → { open, create: [Zeiten], join: [Zeiten] }
  let counter = 0;
  let closing = false;
  let shown = null;                   // zuletzt berechnete Statistik { at, data }
  let purged = 0;

  // Es läuft nur dieser Server. Verbindungen von früheren Läufen (vor einem Update) fallen nach kurzer Zeit weg.
  const isAlive = inst => inst === instance;

  function send(c, msg) {
    if (c.ws.readyState !== WebSocket.OPEN) return;
    try { c.ws.send(JSON.stringify(msg)); } catch (e) { /* Verbindung geht gerade zu */ }
  }
  function sendState(c, room) {
    c.sent = room.seq;
    send(c, { t: 'state', now: Date.now(), times, room: G.view(room, c.pid) });
  }

  /* ---------- Lobby ändern und verteilen ---------- */
  // Erst aufräumen und abgelaufene Zeit nachholen, dann die Aktion, danach noch einmal die Zeit
  // (etwa wenn jetzt jemand Abwesendes dran ist). Klappt die Aktion nicht, wird der Rest trotzdem gespeichert.
  async function change(code, action) {
    let error = null;
    const now = Date.now();
    const out = S.mutate(db, code, room => {
      const ctx = { now, rng, times };
      error = null;
      G.prune(room, isAlive, now);
      G.tick(room, ctx);
      const before = structuredClone(room);
      try {
        const result = action(room, ctx);
        G.tick(room, ctx);
        return result;
      } catch (e) {
        if (!(e instanceof G.GameError)) throw e;
        error = e;
        replace(room, before);
        return undefined;
      }
    }, now);
    if (out.missing) throw new G.GameError('room-not-found');
    if (out.changed) deliver(code, out.room);
    if (error) throw error;
    return out;
  }

  // Neuen Stand an alle Verbindungen schicken, die in der Lobby sind. Kommt ein älterer Stand als der
  // zuletzt verteilte (zwei Aktionen kurz nacheinander), bekommt nur, wer noch gar nichts hat, den neueren.
  function deliver(code, room) {
    const L = rooms.get(code);
    if (!L) return;
    if (!S.isLive(room, Date.now())) {
      for (const c of [...L.conns]) { send(c, { t: 'error', code: 'room-closed' }); unbindLocal(c); }
      return;
    }
    const known = L.room;
    const renewed = !!known && known.created !== room.created;   // Code wurde neu vergeben
    if (known && !renewed && room.seq <= known.seq) {
      // Nichts Neues. Nur wer den bekannten Stand noch nicht hat, bekommt ihn.
      for (const c of L.conns) if (c.sent < known.seq && G.playerById(known, c.pid)) sendState(c, known);
      return;
    }
    L.room = room;
    schedule(code);
    for (const c of [...L.conns]) {
      if (!G.playerById(room, c.pid)) { send(c, { t: 'error', code: 'removed' }); unbindLocal(c); continue; }
      if (renewed || room.seq > c.sent) sendState(c, room);
    }
  }

  // Zugzeit und Bots im Blick behalten: Kurz nach Ablauf der Zugzeit oder wenn der nächste Bot-Schritt
  // fällig ist, prüft der Server selbst. Ohne Verbindungen gibt es keinen Timer: Dann steht das Spiel,
  // auch für die Bots, bis jemand zurückkommt.
  function schedule(code, pause = 0) {
    const L = rooms.get(code);
    if (!L) return;
    clearTimeout(L.timer);
    L.timer = 0;
    const room = L.room;
    if (!room || room.status !== 'playing' || !room.turn) return;
    const bot = G.playerById(room, room.turn.player);
    // Ohne Zeitlimit (eigene Würfel) gibt es für Menschen nichts zu prüfen
    if (!(bot && bot.bot) && room.turn.deadline == null) return;
    const due = bot && bot.bot ? room.turn.botAt : room.turn.deadline + times.grace;
    const wait = Math.max(pause, due - Date.now()) + 20;
    L.timer = setTimeout(async () => {
      L.timer = 0;
      let retry = 0;
      try {
        await change(code, () => {});
      } catch (e) {
        if (!(e instanceof G.GameError)) { log.error('Zugzeit prüfen:', e); retry = 2000; }
        else if (e.code === 'room-not-found') deliver(code, null);   // Lobby ist weg
      }
      if (rooms.get(code) === L && !L.timer) schedule(code, retry);
    }, wait);
  }

  /* ---------- Verbindungen und Lobbys ---------- */
  function bindLocal(c, code, pid) {
    if (c.code === code && c.pid === pid) return;
    if (c.code) unbindLocal(c);
    c.code = code;
    c.pid = pid;
    c.sent = -1;
    let L = rooms.get(code);
    if (!L) {
      L = { conns: new Set(), timer: 0, room: null };
      rooms.set(code, L);
    }
    L.conns.add(c);
  }
  function unbindLocal(c) {
    const L = c.code ? rooms.get(c.code) : null;
    if (L) {
      L.conns.delete(c);
      if (!L.conns.size) {
        clearTimeout(L.timer);
        rooms.delete(c.code);
      }
    }
    c.code = null;
    c.pid = null;
    c.sent = -1;
  }
  // Verbindung zu oder „Zum Hauptmenü“: Die Person bleibt im Spiel, gilt aber als nicht verbunden.
  async function goAway(c) {
    if (!c.code || closing) return;
    const { code, pid } = c;
    unbindLocal(c);
    try {
      await change(code, room => { G.detach(room, pid, c.id); });
    } catch (e) {
      if (!(e instanceof G.GameError)) log.error('Abmelden:', e);
    }
  }
  // Zurück in eine Lobby, in der das Gerät schon ist (nach dem Neuladen oder Wiederverbinden)
  async function resume(c, raw) {
    const code = codeOf(raw);
    if (!code) G.fail('room-not-found');
    if (c.code && c.code !== code) await goAway(c);
    const out = await change(code, (room, ctx) => {
      const p = G.playerByKey(room, c.key);
      if (!p) G.fail('not-in-room');
      G.attach(room, p.id, c.id, ctx.now);
      return p.id;
    });
    bindLocal(c, code, out.result);
    deliver(code, out.room);
  }
  // Aktion in der eigenen Lobby
  function act(c, fn) {
    if (!c.code) G.fail('not-in-room');
    const pid = c.pid;
    return change(c.code, (room, ctx) => {
      if (!G.playerById(room, pid)) G.fail('removed');
      G.attach(room, pid, c.id, ctx.now);   // falls die Verbindung zwischendurch als getrennt galt
      return fn(room, pid, ctx);
    });
  }

  /* ---------- Bremsen ---------- */
  function ipInfo(ip) {
    let s = ips.get(ip);
    if (!s) {
      s = { open: 0 };
      for (const kind in LIMITS) s[kind] = [];
      ips.set(ip, s);
    }
    return s;
  }
  // Vergessen, wer keine Verbindung mehr hat und gerade nicht gebremst wird
  function sweep(now) {
    for (const [ip, s] of ips) {
      if (!s.open && Object.entries(LIMITS).every(([kind, [, win]]) => !s[kind].some(t => now - t < win))) ips.delete(ip);
    }
  }
  function limit(ip, kind) {
    const [max, win] = LIMITS[kind];
    const s = ipInfo(ip);
    const now = Date.now();
    s[kind] = s[kind].filter(t => now - t < win);
    if (s[kind].length >= max) return false;
    s[kind].push(now);
    return true;
  }
  // true: Diese Nachricht wird abgelehnt
  function flood(c) {
    const now = Date.now();
    while (c.hits.length && now - c.hits[0] > MSG_WINDOW) c.hits.shift();
    c.hits.push(now);
    if (c.hits.length > MSG_HARD) { c.ws.close(1008, 'Zu viele Nachrichten'); return true; }
    return c.hits.length > MSG_SOFT;
  }

  /* ---------- Nachrichten ---------- */
  const handlers = {
    ping(c) {
      send(c, { t: 'pong', now: Date.now() });
    },
    // Verbinden: Protokollversion und Geräteschlüssel. Mit code geht es zurück ins eigene Spiel.
    async hello(c, m) {
      if (!online) G.fail('online-off');
      if (!Number.isInteger(m.v) || typeof m.key !== 'string' || !KEY_RE.test(m.key)) G.fail('bad-message');
      if (m.v < G.PROTOCOL) G.fail('update-needed');
      if (m.v > G.PROTOCOL) G.fail('server-old');
      const key = await hashKey(m.key);
      if (c.key && c.key !== key) G.fail('bad-message');
      c.key = key;
      send(c, { t: 'welcome', now: Date.now(), protocol: G.PROTOCOL, times });
      if (m.code != null) await resume(c, m.code);
    },
    async create(c, m) {
      const name = G.onlineName(m.name);
      if (!name) G.fail('name-invalid');
      if (!limit(c.ip, 'create')) G.fail('too-many');
      await goAway(c);
      const now = Date.now();
      const pid = G.randomId();
      const room = S.createRoom(db, r => {
        G.join(r, { id: pid, name, key: c.key });
        G.attach(r, pid, c.id, now);
      }, now);
      bindLocal(c, room.code, pid);
      deliver(room.code, room);
    },
    async join(c, m) {
      const name = G.onlineName(m.name);
      if (!name) G.fail('name-invalid');
      if (!limit(c.ip, 'join')) G.fail('too-many');
      const code = codeOf(m.code);
      if (!code) G.fail('room-not-found');
      if (c.code && c.code !== code) await goAway(c);
      const out = await change(code, (room, ctx) => {
        const known = G.playerByKey(room, c.key);
        if (known) { G.attach(room, known.id, c.id, ctx.now); return known.id; }   // schon dabei
        const p = G.join(room, { id: G.randomId(), name, key: c.key });
        G.attach(room, p.id, c.id, ctx.now);
        return p.id;
      });
      bindLocal(c, code, out.result);
      deliver(code, out.room);
    },
    // Lobby oder Spiel verlassen: Die Person ist raus, ihre Punkte sind weg.
    async leave(c) {
      if (!c.code) G.fail('not-in-room');
      const { code, pid } = c;
      unbindLocal(c);
      try {
        await change(code, (room, ctx) => G.leave(room, pid, ctx));
      } catch (e) {
        if (!(e instanceof G.GameError)) throw e;
      }
      send(c, { t: 'left', code });
    },
    // Zum Hauptmenü: Das Spiel läuft ohne die Person weiter, bis sie zurückkommt.
    async away(c) {
      const code = c.code;
      await goAway(c);
      send(c, { t: 'away', code });
    },
    async start(c) {
      await act(c, (room, pid, ctx) => G.start(room, pid, ctx));
      await count('online');
    },
    order(c, m) {
      if (!Array.isArray(m.ids) || m.ids.length > G.MAX_PLAYERS || !m.ids.every(x => typeof x === 'string')) G.fail('bad-message');
      return act(c, (room, pid) => G.order(room, pid, m.ids));
    },
    kick(c, m) {
      if (typeof m.id !== 'string') G.fail('bad-message');
      return act(c, (room, pid, ctx) => G.kick(room, pid, m.id, ctx));
    },
    // Nur der Host, nur in der Lobby. Entfernt werden Bots wie Menschen mit kick. level ist freiwillig, ohne spielt der Bot schwer.
    addBot(c, m) {
      if (m.level !== undefined && !G.BOT_LEVELS.includes(m.level)) G.fail('bad-message');
      return act(c, (room, pid, ctx) => G.addBot(room, pid, ctx, m.level));
    },
    botLevel(c, m) {
      if (typeof m.id !== 'string' || !G.BOT_LEVELS.includes(m.level)) G.fail('bad-message');
      return act(c, (room, pid) => G.setBotLevel(room, pid, m.id, m.level));
    },
    // Mit der App oder mit eigenen Würfeln (nur Host, nur in der Lobby)
    via(c, m) {
      if (!G.VIAS.includes(m.via)) G.fail('bad-message');
      return act(c, (room, pid) => G.setVia(room, pid, m.via));
    },
    roll: (c, m) => act(c, (room, pid, ctx) => G.roll(room, pid, m.n, ctx)),
    hold(c, m) {
      if (typeof m.on !== 'boolean') G.fail('bad-message');
      return act(c, (room, pid) => G.hold(room, pid, m.i, m.on));
    },
    // pts und cd nur mit eigenen Würfeln, sonst rechnet der Server selbst
    enter: (c, m) => act(c, (room, pid, ctx) => G.enter(room, pid, m.field, ctx, m.pts, m.cd)),
    fix: (c, m) => act(c, (room, pid) => G.fix(room, pid, m.field, m.pts)),
    cds: (c, m) => act(c, (room, pid) => G.setCds(room, pid, m.list)),
    skip: (c, m) => act(c, (room, pid, ctx) => G.skip(room, pid, m.turn, ctx)),
    cdRoll: (c, m) => act(c, (room, pid, ctx) => G.cdRoll(room, pid, m.stage, ctx)),
    // „Bei mir ist die Zeit um.“ Der Server prüft selbst und schickt auf jeden Fall den aktuellen Stand.
    async expired(c) {
      const out = await act(c, () => {});
      if (!out.changed && out.room) sendState(c, out.room);
    },
  };

  async function onMessage(c, data) {
    if (flood(c)) { send(c, { t: 'error', code: 'too-many' }); return; }
    let m = null;
    if (typeof data === 'string' && data.length <= MAX_MSG) {
      try { m = JSON.parse(data); } catch (e) { m = null; }
    }
    const ok = m && typeof m === 'object' && !Array.isArray(m) && typeof m.t === 'string';
    const re = ok ? m.t.slice(0, 20) : undefined;
    if (!ok || !Object.hasOwn(handlers, m.t)) { send(c, { t: 'error', code: 'bad-message', re }); return; }
    if (!c.key && m.t !== 'hello' && m.t !== 'ping') { send(c, { t: 'error', code: 'no-hello', re }); return; }
    try {
      await handlers[m.t](c, m);
    } catch (e) {
      if (e instanceof G.GameError) send(c, { t: 'error', code: e.code, re });
      else {
        log.error('Fehler bei', m.t + ':', e);
        send(c, { t: 'error', code: 'server-error', re });
      }
    }
  }

  /* ---------- Aufräumen ---------- */
  // Jede Minute vergessen die Bremsen alte Einträge. Einmal pro Stunde verschwinden abgelaufene Lobbys
  // und alte Stunden der Statistik aus der Datenbank.
  function maintain() {
    const now = Date.now();
    sweep(now);
    if (now - purged < PURGE_MS) return;
    purged = now;
    try {
      S.purgeRooms(db, now);
      St.pruneHours(db, now);
    } catch (e) {
      log.warn('Aufräumen:', String(e));
    }
  }
  const maintenance = setInterval(maintain, MAINTAIN_MS);
  if (maintenance.unref) maintenance.unref();

  /* ---------- Statistik ---------- */
  // Ein gestartetes Spiel zählen. Klappt das nicht, läuft trotzdem alles weiter.
  async function count(kind) {
    try {
      St.countGame(db, kind, Date.now());
      shown = null;
    } catch (e) {
      log.warn('Zählen fehlgeschlagen:', String(e));
    }
  }
  function readStats() {
    const now = Date.now();
    if (shown && now - shown.at < STATS_FRESH) return shown.data;
    const data = St.readStats(db, now);
    shown = { at: now, data };
    return data;
  }

  /* ---------- HTTP ---------- */
  // server: der laufende Bun-Server, für die Adresse der Verbindung und das Umschalten auf WebSocket
  async function handle(req, server) {
    const url = new URL(req.url);
    const peer = server.requestIP(req);
    const ipOf = () => ipKey(clientIp(peer && peer.address, req.headers.get('x-forwarded-for')));
    const cors = { 'access-control-allow-origin': '*' };
    if (url.pathname === '/health') {
      return Response.json({ app: 'hexa', protocol: G.PROTOCOL, online, ok: true }, { headers: cors });
    }
    // Lokales Spiel oder Tagesspiel (?kind=daily) gestartet. Die App schickt nur diese Anfrage, ohne Inhalt.
    if (url.pathname === '/count') {
      if (req.method !== 'POST') return new Response('Nur POST', { status: 405, headers: Object.assign({ allow: 'POST' }, cors) });
      const kind = url.searchParams.get('kind') || 'local';
      if (kind !== 'local' && kind !== 'daily') return new Response('Unbekannte Art', { status: 400, headers: cors });
      if (ips.size > 5000) sweep(Date.now());
      if (!limit(ipOf(), 'count')) return new Response(null, { status: 429, headers: cors });
      await count(kind);
      return new Response(null, { status: 204, headers: cors });
    }
    if (url.pathname === '/stats' || url.pathname === '/stats.json') {
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Nur GET', { status: 405, headers: { allow: 'GET, HEAD' } });
      let data;
      try { data = readStats(); } catch (e) {
        log.error('Statistik:', e);
        return new Response('Statistik gerade nicht verfügbar', { status: 503 });
      }
      const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
      if (url.pathname === '/stats.json') return Response.json(data, { headers: Object.assign(headers, cors) });
      return new Response(St.statsPage(data), { headers: Object.assign(headers, { 'content-type': TYPES.html }) });
    }
    if ((url.pathname === '/' || url.pathname === '/index.html') && redirectHosts.includes(url.hostname)) {
      return new Response(null, { status: 302, headers: { location: appUrl } });
    }
    if (url.pathname !== '/ws') {
      const file = req.method === 'GET' || req.method === 'HEAD' ? await appFile(url.pathname) : null;
      return file || new Response('Nicht gefunden', { status: 404 });
    }
    if ((req.headers.get('upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('Hier geht es nur per WebSocket.', { status: 426 });
    }
    const ip = ipOf();
    const who = ipInfo(ip);
    if (who.open >= MAX_CONNS_PER_IP) return new Response('Zu viele Verbindungen', { status: 429 });
    const c = { id: instance + '.' + (++counter), ws: null, who, ip, key: null, code: null, pid: null, sent: -1, hits: [], queue: Promise.resolve() };
    if (closing || !server.upgrade(req, { data: c })) return new Response('WebSocket geht nicht', { status: 400 });
    who.open += 1;
    return undefined;
  }

  /* ---------- WebSocket ---------- */
  const websocket = {
    idleTimeout: 60,                  // Sekunden ohne Lebenszeichen, dann ist die Verbindung zu. Bun schickt selbst Pings.
    maxPayloadLength: 16 * 1024,      // Bytes. Mehr als MAX_MSG Zeichen lehnt onMessage ohnehin ab.
    open(ws) {
      const c = ws.data;
      c.ws = ws;
      conns.add(c);
    },
    // Nachrichten einer Verbindung werden nacheinander bearbeitet, in der Reihenfolge, in der sie kommen.
    message(ws, data) {
      const c = ws.data;
      c.queue = c.queue.then(() => onMessage(c, data)).catch(err => log.error('Nachricht:', err));
    },
    close(ws) {
      const c = ws.data;
      c.who.open -= 1;
      conns.delete(c);
      c.queue = c.queue.then(() => goAway(c)).catch(err => log.error('Verbindung zu:', err));
    },
  };

  // Anhalten, beim Update und in Tests: keine neuen Verbindungen, alle offenen mit 1001 schließen.
  // Die Leute bleiben in ihren Lobbys. Die Apps verbinden sich von selbst neu, mit dem neuen Server.
  async function close() {
    closing = true;
    clearInterval(maintenance);
    for (const L of rooms.values()) clearTimeout(L.timer);
    rooms.clear();
    for (const c of conns) { try { c.ws.close(1001, 'Server hält an'); } catch (e) { /* schon zu */ } }
    await Promise.all([...conns].map(c => c.queue));
  }

  return { fetch: handle, websocket, close, instance, stats: () => ({ connections: conns.size, rooms: rooms.size }) };
}

if (import.meta.main) {
  // Im Container liegt die Datenbank auf dem Volume (HEXA_DB=/data/hexa.sqlite), lokal neben dem Repo.
  const db = openDb(process.env.HEXA_DB || 'hexa.sqlite');
  const hub = createHub({ db });
  // Port 3000 wie bei Bun und Coolify üblich
  const server = Bun.serve({ port: Number(process.env.PORT) || 3000, fetch: hub.fetch, websocket: hub.websocket });
  console.log(`HEXA läuft auf http://localhost:${server.port}, Datenbank ${process.env.HEXA_DB || 'hexa.sqlite'}`);
  // docker stop schickt SIGTERM. Ohne eigene Behandlung würde Bun erst nach 10 Sekunden hart beendet.
  let stopping = false;
  async function stop(signal) {
    if (stopping) return;
    stopping = true;
    console.log(signal, '– halte an');
    setTimeout(() => process.exit(0), 5000).unref();   // falls etwas hängt
    server.stop();
    await hub.close();
    db.close();
    process.exit(0);
  }
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}
