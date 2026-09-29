/* HEXA – Verbindung zum Online-Server.
   Eine WebSocket-Verbindung pro Gerät. Reißt sie ab (Handy gesperrt, Funkloch, Server-Update), verbindet die
   App von selbst neu und bekommt den ganzen Stand. Hier liegen auch Geräteschlüssel, Spitzname und die
   aktuelle Lobby. Die Ansichten stehen in js/app.js, das Protokoll in server/README.md. */
window.HexaOnline = (() => {
  'use strict';

  const PROTOCOL = 2;   // 2: Bots in der Lobby. Muss zum Server passen (server/game.js).
  const STORE = 'hexa-online';
  // Der HEXA-Server auf Deno Deploy. Kommt die App selbst von einem HEXA-Server (etwa zum Testen), nimmt sie den.
  const SERVER = 'wss://hexa.unpacked-dev.deno.net/ws';
  const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;

  // Geräteschlüssel: einmal zufällig erzeugt, damit der Server das Gerät nach dem Neuladen wiedererkennt.
  function newKey() {
    const a = new Uint8Array(24);
    crypto.getRandomValues(a);
    return btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function read() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { d = {}; }
    return {
      key: typeof d.key === 'string' && KEY_RE.test(d.key) ? d.key : newKey(),
      name: typeof d.name === 'string' ? d.name.slice(0, 20) : '',
      code: typeof d.code === 'string' && /^[A-Z]{4}$/.test(d.code) ? d.code : null,
    };
  }
  const data = read();
  function write() {
    try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) { /* Speicher gesperrt */ }
  }
  write();

  let url = null;
  let ws = null;
  let want = false;        // soll eine Verbindung bestehen?
  let tries = 0;
  let timer = 0;
  let probe = 0;
  let status = 'off';      // off | connecting | online
  let offset = 0;          // Uhr des Servers minus eigene Uhr
  let room = null;
  const subs = [];

  function emit(type, msg) {
    subs.forEach(fn => {
      try { fn(type, msg); } catch (e) { setTimeout(() => { throw e; }); }
    });
  }
  function setStatus(s) {
    if (s === status) return;
    status = s;
    emit('status', { status: s });
  }
  function forget() {
    data.code = null;
    room = null;
    write();
  }

  // Liefert ein HEXA-Server diese Seite aus, beantwortet er /health. Dann ist er auch der Spiel-Server.
  async function findServer() {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      try {
        const r = await fetch(new URL('health', location.href), { cache: 'no-store' });
        const j = r.ok ? await r.json() : null;
        if (j && j.app === 'hexa') return new URL('ws', location.href).href.replace(/^http/, 'ws');
      } catch (e) { /* hier läuft kein HEXA-Server */ }
    }
    return SERVER;
  }

  async function open() {
    clearTimeout(timer);
    if (!want || ws) return;
    setStatus('connecting');
    if (!url) url = await findServer();
    if (!want || ws) return;
    let sock;
    try { sock = new WebSocket(url); } catch (e) { later(); return; }
    ws = sock;
    sock.onopen = () => {
      if (ws !== sock) return;
      const hello = { t: 'hello', v: PROTOCOL, key: data.key };
      if (data.code) hello.code = data.code;
      sock.send(JSON.stringify(hello));
    };
    sock.onmessage = e => { if (ws === sock) handle(e.data); };
    sock.onclose = () => {
      if (ws !== sock) return;
      ws = null;
      clearTimeout(probe);
      if (want) { setStatus('connecting'); later(); } else setStatus('off');
    };
    sock.onerror = () => { /* onclose kommt danach */ };
  }
  // Tote Verbindung sofort aufgeben. Auf das Ende des Schließens zu warten dauert ohne Netz sehr lange.
  function drop() {
    const s = ws;
    if (!s) return;
    ws = null;
    clearTimeout(probe);
    s.onopen = s.onmessage = s.onclose = s.onerror = null;
    try { s.close(); } catch (e) { /* schon zu */ }
    if (want) { setStatus('connecting'); later(); } else setStatus('off');
  }
  // Neuer Versuch, jedes Mal etwas später (bis 8 Sekunden)
  function later() {
    clearTimeout(timer);
    const wait = Math.min(8000, 400 * Math.pow(2, tries++)) * (0.8 + Math.random() * 0.4);
    timer = setTimeout(open, wait);
  }

  function handle(raw) {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    clearTimeout(probe);
    if (typeof m.now === 'number') offset = m.now - Date.now();
    switch (m.t) {
      case 'welcome':
        tries = 0;
        setStatus('online');
        emit('welcome', m);
        break;
      case 'state':
        room = m.room;
        if (data.code !== room.code) { data.code = room.code; write(); }
        emit('state', m);
        break;
      case 'left':
        forget();
        emit('left', m);
        break;
      case 'error':
        // Nicht (mehr) in der Lobby: Den Code braucht es dann nicht mehr.
        if (['removed', 'room-closed', 'not-in-room'].includes(m.code) || (m.code === 'room-not-found' && m.re === 'hello')) forget();
        emit('error', m);
        break;
      default:
        emit(m.t, m);
    }
  }

  // Wieder sichtbar (Handy entsperrt), Netz weg oder wieder da: Verbindung prüfen. Nach dem Sperren oder im
  // Funkloch wirkt eine Verbindung oft noch offen, obwohl sie längst tot ist. Kommt auf ein ping keine Antwort,
  // geht es neu los. Dazu alle 25 Sekunden ein Herzschlag, solange die App sichtbar ist.
  function check() {
    if (!want) return;
    if (!ws) { tries = 0; open(); return; }
    if (ws.readyState !== 1) return;
    try { ws.send(JSON.stringify({ t: 'ping' })); } catch (e) { return; }
    clearTimeout(probe);
    probe = setTimeout(drop, 4000);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('online', check);
  window.addEventListener('offline', check);
  setInterval(() => { if (status === 'online' && document.visibilityState === 'visible') check(); }, 25000);

  return {
    PROTOCOL,
    name: () => data.name,
    setName(n) { data.name = String(n || '').slice(0, 20); write(); },
    code: () => data.code,
    room: () => room,
    status: () => status,
    now: () => Date.now() + offset,
    connect() { want = true; tries = 0; open(); },
    disconnect() {
      want = false;
      clearTimeout(timer);
      clearTimeout(probe);
      room = null;
      const s = ws;
      ws = null;
      if (s) { try { s.close(); } catch (e) { /* schon zu */ } }
      setStatus('off');
    },
    // Schickt eine Nachricht, wenn die Verbindung steht. Sonst false.
    send(msg) {
      if (!ws || ws.readyState !== 1 || status !== 'online') return false;
      ws.send(JSON.stringify(msg));
      return true;
    },
    on(fn) { subs.push(fn); },
    forget,
  };
})();
