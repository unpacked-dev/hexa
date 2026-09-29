/* HEXA – Server für den Online-Modus.
   Nur Deno, keine weiteren Pakete: Deno.serve für HTTP und WebSocket, Deno KV als Datenbank.
   Lokal starten: deno task dev (http://localhost:8000, WebSocket unter /ws). Tests: deno task test
   Auf Deno Deploy: Einstiegspunkt server/main.js und eine Deno-KV-Datenbank zuweisen, siehe server/README.md.

   Jede App hat eine WebSocket-Verbindung. Darüber schickt sie Wünsche wie „würfeln“ oder „Große Straße
   eintragen“. Der Server prüft sie, würfelt selbst und schickt allen in der Lobby den ganzen neuen Stand.
   Läuft der Server auf mehreren Instanzen, erfährt jede über kv.watch von den Änderungen der anderen. */
import * as G from './game.js';
import * as S from './store.js';

const MAX_MSG = 4096;                 // Zeichen pro Nachricht
const MAX_CONNS_PER_IP = 20;
// Lobbys erstellen und beitreten: so oft pro Minute und Internetverbindung. Gemerkt nur im Arbeitsspeicher.
const LIMITS = { create: [6, 60_000], join: [12, 60_000] };
const MSG_WINDOW = 10_000;
const MSG_SOFT = 100;                 // mehr Nachrichten in 10 Sekunden werden abgelehnt
const MSG_HARD = 300;                 // noch mehr: Verbindung zu
const BEAT_MS = 10_000;
const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;

// Die App selbst liefert der Server auch aus. Dann reicht zum Testen eine Adresse für App und WebSocket.
// Nur diese Dateien und Ordner, alles andere im Repo (Server-Code, Doku, Werkzeuge) bleibt verborgen.
const ROOT = new URL('../', import.meta.url);
const PUBLIC_FILES = ['index.html', 'favicon.svg', 'manifest.webmanifest'];
const PUBLIC_DIRS = ['css/', 'js/', 'lang/', 'fonts/', 'icons/'];
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
  try {
    const body = await Deno.readFile(new URL(p, ROOT));
    // Code immer frisch, damit nach einem neuen Build nicht noch alte Teile im Browser stecken. Schriften und Icons ändern sich kaum.
    const still = p.startsWith('fonts/') || p.startsWith('icons/');
    return new Response(body, {
      headers: { 'content-type': type, 'cache-control': still ? 'public, max-age=86400' : 'no-cache', 'x-content-type-options': 'nosniff' },
    });
  } catch (e) {
    return null;
  }
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
// Den Header X-Forwarded-For nutzt der Server bewusst nicht: Deno Deploy reicht ihn ungeprüft durch.
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
const replace = (target, source) => {
  Object.keys(target).forEach(k => { delete target[k]; });
  Object.assign(target, source);
};

// Ein Hub ist eine Server-Instanz. Tests starten mehrere mit derselben Datenbank.
// poll: Sicherheitsnetz. Zusätzlich zu kv.watch fragt die Instanz so oft nach dem Stand ihrer Lobbys (ms, 0 = aus).
// Klappt kv.watch, merkt man davon nichts. Klappt es nicht, läuft das Spiel trotzdem, nur etwas verzögert.
// online: false nimmt keine Verbindungen an (enableOnline in js/config.js).
export function createHub({ kv, instance = G.randomId(8), times = G.TIMES, rng = G.fairRandom, poll = 5000, online = globalThis.HexaConfig.enableOnline, log = console } = {}) {
  const conns = new Set();
  const rooms = new Map();            // Code → { conns, stop, poll, timer, room }: Lobbys mit Verbindungen hier
  const ips = new Map();              // Internetverbindung → { open, create: [Zeiten], join: [Zeiten] }
  let counter = 0;
  let alive = null;                   // laufende Instanzen, null = noch nicht bekannt
  let beat = 0;
  let closing = false;

  const isAlive = inst => inst === instance || !alive || alive.has(inst);

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
    const out = await S.mutate(kv, code, room => {
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

  // Neuen Stand an alle Verbindungen dieser Instanz schicken, die in der Lobby sind.
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
  // fällig ist, prüft die Instanz selbst. Hängen Leute derselben Lobby an mehreren Instanzen, versuchen
  // es alle, gespeichert wird aber nur einmal. Ohne Verbindungen hier gibt es keinen Timer: Dann steht
  // das Spiel, auch für die Bots, bis jemand zurückkommt.
  function schedule(code, pause = 0) {
    const L = rooms.get(code);
    if (!L) return;
    clearTimeout(L.timer);
    L.timer = 0;
    const room = L.room;
    if (!room || room.status !== 'playing' || !room.turn) return;
    const bot = G.playerById(room, room.turn.player);
    const due = bot && bot.bot ? room.turn.botAt : room.turn.deadline + times.grace;
    const wait = Math.max(pause, due - Date.now()) + 20 + Math.floor(Math.random() * 150);
    L.timer = setTimeout(async () => {
      L.timer = 0;
      let retry = 0;
      try {
        const out = await change(code, () => {});
        // Nichts zu tun: Dann war eine andere Instanz schneller. Ihren Stand übernehmen.
        if (!out.changed) deliver(code, out.room);
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
      L = { conns: new Set(), stop: null, poll: 0, timer: 0, room: null };
      rooms.set(code, L);
      L.stop = S.watchRoom(kv, code, value => deliver(code, value), err => log.warn('Beobachten von', code, 'unterbrochen:', String(err)));
      if (poll) L.poll = setInterval(() => { kv.get(S.roomKey(code)).then(e => deliver(code, e.value), () => {}); }, poll);
    }
    L.conns.add(c);
  }
  function unbindLocal(c) {
    const L = c.code ? rooms.get(c.code) : null;
    if (L) {
      L.conns.delete(c);
      if (!L.conns.size) {
        L.stop();
        clearInterval(L.poll);
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
    sendState(c, out.room);
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
    if (!s) { s = { open: 0, create: [], join: [] }; ips.set(ip, s); }
    return s;
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
      const room = await S.createRoom(kv, r => {
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
      sendState(c, out.room);
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
    start: c => act(c, (room, pid, ctx) => G.start(room, pid, ctx)),
    order(c, m) {
      if (!Array.isArray(m.ids) || m.ids.length > G.MAX_PLAYERS || !m.ids.every(x => typeof x === 'string')) G.fail('bad-message');
      return act(c, (room, pid) => G.order(room, pid, m.ids));
    },
    kick(c, m) {
      if (typeof m.id !== 'string') G.fail('bad-message');
      return act(c, (room, pid, ctx) => G.kick(room, pid, m.id, ctx));
    },
    // Nur der Host, nur in der Lobby. Entfernt werden Bots wie Menschen mit kick.
    addBot: c => act(c, (room, pid, ctx) => G.addBot(room, pid, ctx)),
    roll: (c, m) => act(c, (room, pid, ctx) => G.roll(room, pid, m.n, ctx)),
    hold(c, m) {
      if (typeof m.on !== 'boolean') G.fail('bad-message');
      return act(c, (room, pid) => G.hold(room, pid, m.i, m.on));
    },
    enter: (c, m) => act(c, (room, pid, ctx) => G.enter(room, pid, m.field, ctx)),
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

  /* ---------- Lebenszeichen ---------- */
  async function beatOnce() {
    const now = Date.now();
    try {
      await S.heartbeat(kv, instance, now);
      alive = await S.liveInstances(kv, now);
    } catch (e) {
      log.warn('Lebenszeichen fehlgeschlagen:', String(e));
    }
    for (const [ip, s] of ips) {
      if (!s.open && !s.create.some(t => now - t < 60_000) && !s.join.some(t => now - t < 60_000)) ips.delete(ip);
    }
  }
  function startBeat() {
    beatOnce();
    beat = setInterval(() => { if (conns.size) beatOnce(); }, BEAT_MS);
  }

  /* ---------- HTTP ---------- */
  async function handle(req, info) {
    const url = new URL(req.url);
    if (url.pathname === '/health') {
      return Response.json({ app: 'hexa', protocol: G.PROTOCOL, online, ok: true }, { headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.pathname !== '/ws') {
      const file = req.method === 'GET' || req.method === 'HEAD' ? await appFile(url.pathname) : null;
      return file || new Response('Nicht gefunden', { status: 404 });
    }
    if ((req.headers.get('upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('Hier geht es nur per WebSocket.', { status: 426 });
    }
    const ip = ipKey(info && info.remoteAddr && info.remoteAddr.hostname);
    const who = ipInfo(ip);
    if (who.open >= MAX_CONNS_PER_IP) return new Response('Zu viele Verbindungen', { status: 429 });
    let upgraded;
    try {
      upgraded = Deno.upgradeWebSocket(req, { idleTimeout: 60 });
    } catch (e) {
      return new Response('WebSocket geht nicht', { status: 400 });
    }
    const { socket, response } = upgraded;
    const c = { id: instance + '.' + (++counter), ws: socket, ip, key: null, code: null, pid: null, sent: -1, hits: [], queue: Promise.resolve() };
    who.open += 1;
    conns.add(c);
    if (!beat) startBeat();
    // Nachrichten einer Verbindung werden nacheinander bearbeitet, in der Reihenfolge, in der sie kommen.
    socket.onmessage = e => { c.queue = c.queue.then(() => onMessage(c, e.data)).catch(err => log.error('Nachricht:', err)); };
    socket.onclose = () => {
      who.open -= 1;
      conns.delete(c);
      c.queue = c.queue.then(() => goAway(c)).catch(err => log.error('Verbindung zu:', err));
    };
    socket.onerror = () => { /* onclose kommt danach */ };
    return response;
  }

  // Für Tests: alles anhalten und Verbindungen schließen
  async function close() {
    closing = true;
    clearInterval(beat);
    beat = 0;
    for (const L of rooms.values()) { L.stop(); clearInterval(L.poll); clearTimeout(L.timer); }
    rooms.clear();
    for (const c of conns) { try { c.ws.close(1001, 'Server hält an'); } catch (e) { /* schon zu */ } }
    await Promise.all([...conns].map(c => c.queue));
    try { await S.forgetInstance(kv, instance); } catch (e) { /* egal */ }
  }

  return { handle, close, instance, stats: () => ({ connections: conns.size, rooms: rooms.size }) };
}

if (import.meta.main) {
  // Auf Deno Deploy verbindet Deno.openKv() automatisch mit der zugewiesenen Datenbank.
  // Lokal liegt sie in einer Datei, auf Wunsch unter HEXA_KV (z. B. HEXA_KV=./hexa.kv).
  const kv = await Deno.openKv(Deno.env.get('HEXA_KV') || undefined);
  const poll = Deno.env.get('HEXA_POLL_MS');
  const hub = createHub({ kv, poll: poll ? Number(poll) : undefined });
  const port = Deno.env.get('PORT');
  if (port) Deno.serve({ port: Number(port) }, hub.handle);
  else Deno.serve(hub.handle);
}
