/* HEXA – Spielablauf für den Online-Modus.
   Hier wird nur gerechnet, ohne Netz und ohne Datenbank: Stand + Aktion + Uhrzeit ergibt den neuen Stand.
   Die Funktionen ändern den übergebenen Stand direkt. Geht etwas nicht, werfen sie einen GameError mit
   einem kurzen Code wie 'not-your-turn'. Die App übersetzt den Code später ins Deutsche oder Englische.
   Die Regeln kommen aus js/rules.js, genau wie in der App.

   ctx, das viele Funktionen bekommen: { now, rng, times }
     now   Uhrzeit des Servers in ms
     rng   Zufall: { d6() → 1…6, int(n) → 0…n-1 }, in Tests vorgegeben
     times Zugzeit, Countdown-Zeit und Puffer in ms, siehe TIMES */
import '../js/rules.js';

const { FIELDS, UPPER, LOWER, NF, BONUS_MIN, BONUS_PTS, scoreFor, countFaces, onlineName } = globalThis.HexaRules;

export const PROTOCOL = 1;
// 60 Sekunden pro Zug, 30 für einen freigeschalteten Countdown, 1 Sekunde Puffer für langsames Netz
export const TIMES = { turn: 60_000, cd: 30_000, grace: 1_000 };
// Keine Grenze fürs Spiel, nur eine technische gegen Lobbys voller Fake-Personen
export const MAX_PLAYERS = 50;
// Codes aus 4 Konsonanten: Ohne A, E, I, O, U und Y entstehen kaum echte Wörter. 20^4 = 160.000 Codes.
export const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
export const CODE_RE = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/;
export const FIELD_KEYS = FIELDS.map(f => f.key);
export { onlineName };

const MAX_EVENTS = 12;
// Eine Verbindung gilt erst nach dieser Zeit als verloren, wenn ihre Server-Instanz nicht mehr antwortet.
const CONN_GRACE = 40_000;

export class GameError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export function fail(code) {
  throw new GameError(code);
}

/* ---------- Zufall ---------- */
// Fair wie in der App: Werte, die nicht glatt aufgehen, werden verworfen. Für n bis 256.
export function randomInt(n) {
  const a = new Uint8Array(1);
  const limit = 256 - (256 % n);
  do { crypto.getRandomValues(a); } while (a[0] >= limit);
  return a[0] % n;
}
export const fairRandom = { int: randomInt, d6: () => randomInt(6) + 1 };

export function randomId(len = 10) {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += abc[randomInt(abc.length)];
  return s;
}
export function randomCode(int = randomInt) {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_LETTERS[int(CODE_LETTERS.length)];
  return s;
}

/* ---------- Stand ---------- */
// Die Würfel wie im lokalen Spiel. turn: zu welchem Zug sie gehören. cd: Countdown freigeschaltet.
const freshDice = () => ({ vals: null, held: [false, false, false, false, false, false], rolls: 0, owner: null, turn: 0, cd: null });

export function newRoom(code, now) {
  return {
    v: 1,
    code,
    status: 'lobby',      // lobby | playing
    seq: 0,               // zählt bei jeder gespeicherten Änderung hoch
    game: 0,              // wie viele Spiele in dieser Lobby gestartet wurden
    host: null,
    players: [],          // { id, name, key (Hash des Geräteschlüssels), conns, missed }
    scores: {},           // wie lokal: { Person: { Feld: Punkte } }
    cds: {},              // wie lokal: { Person: [Countdown-Punkte] }
    dice: freshDice(),
    cdGame: null,         // wie lokal: { owner, stage, pts, got, last, hit, status }
    turn: null,           // { no, player, phase: 'roll' | 'cd', deadline }
    turnNo: 0,
    events: [],           // die letzten Ereignisse, z. B. „Zeit um – Große Straße gestrichen“
    eventNo: 0,
    last: null,           // Ergebnis der letzten Partie, für das Popup und die Revanche
    created: now,
  };
}

export const playerById = (room, id) => room.players.find(p => p.id === id) || null;
export const playerByKey = (room, key) => room.players.find(p => p.key === key) || null;
const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
const scoresOf = (room, id) => (has(room.scores, id) ? room.scores[id] : (room.scores[id] = {}));
const filled = (room, id) => (has(room.scores, id) ? FIELD_KEYS.filter(k => has(room.scores[id], k)).length : 0);
export const isOnline = p => p.conns.length > 0;

function event(room, e) {
  room.eventNo += 1;
  room.events.push(Object.assign({ no: room.eventNo }, e));
  if (room.events.length > MAX_EVENTS) room.events.shift();
}
// Wer etwas tut, ist nicht abwesend.
function active(room, id) {
  const p = playerById(room, id);
  if (p) p.missed = 0;
}

/* ---------- Lobby ---------- */
// Ist der Name schon vergeben (egal ob groß oder klein), kommt eine Zahl dazu: „Lena 2“.
function uniqueName(room, name) {
  const taken = n => room.players.some(p => p.name.toLowerCase() === n.toLowerCase());
  if (!taken(name)) return name;
  for (let k = 2; ; k++) {
    const suffix = ' ' + k;
    const candidate = name.slice(0, 20 - suffix.length).trimEnd() + suffix;
    if (!taken(candidate)) return candidate;
  }
}

export function join(room, { id, name, key }) {
  const clean = onlineName(name);
  if (!clean) fail('name-invalid');
  if (room.status !== 'lobby') fail('game-running');
  if (room.players.length >= MAX_PLAYERS) fail('room-full');
  const p = { id, name: uniqueName(room, clean), key, conns: [], missed: 0 };
  room.players.push(p);
  if (!room.host) room.host = id;
  event(room, { type: 'join', player: id, name: p.name });
  return p;
}

// Verlassen (why 'leave') oder vom Host entfernt ('kick'). Die Punkte der Person sind dann weg.
// Ist niemand mehr da, bekommt der Stand gone = true und wird gelöscht.
export function leave(room, id, ctx, why = 'leave') {
  const i = room.players.findIndex(p => p.id === id);
  if (i < 0) fail('not-in-room');
  const [p] = room.players.splice(i, 1);
  delete room.scores[id];
  delete room.cds[id];
  event(room, { type: why, player: id, name: p.name });
  if (room.host === id) {
    const next = room.players[0] || null;
    room.host = next ? next.id : null;
    if (next) event(room, { type: 'host', player: next.id, name: next.name });
  }
  if (!room.players.length) {
    room.gone = true;
    return;
  }
  if (room.status !== 'playing') return;
  if (room.dice.owner === id) room.dice = freshDice();
  if (room.cdGame && room.cdGame.owner === id) room.cdGame = null;
  if (room.turn && room.turn.player === id) nextTurn(room, ctx);
}

export function kick(room, by, id, ctx) {
  if (room.status !== 'lobby') fail('game-running');
  if (room.host !== by) fail('not-host');
  if (id === by || !playerById(room, id)) fail('not-in-room');
  leave(room, id, ctx, 'kick');
}

// Der Host schickt die ganze neue Reihenfolge. Passt sie nicht mehr zu den Personen
// (jemand kam dazu oder ging), ist seine Ansicht veraltet.
export function order(room, by, ids) {
  if (room.status !== 'lobby') fail('game-running');
  if (room.host !== by) fail('not-host');
  const byId = new Map(room.players.map(p => [p.id, p]));
  if (!Array.isArray(ids) || ids.length !== byId.size || new Set(ids).size !== ids.length || !ids.every(id => byId.has(id))) fail('stale');
  room.players = ids.map(id => byId.get(id));
}

export function start(room, by, ctx) {
  if (room.status !== 'lobby') fail('game-running');
  if (room.host !== by) fail('not-host');
  room.status = 'playing';
  room.game += 1;
  room.scores = {};
  room.cds = {};
  room.dice = freshDice();
  room.cdGame = null;
  room.players.forEach(p => { p.missed = 0; });
  event(room, { type: 'start', game: room.game });
  nextTurn(room, ctx);
}

/* ---------- Züge ---------- */
// Dran ist die erste Person in der Reihenfolge mit den wenigsten Feldern, wie im lokalen Spiel.
function nextPlayer(room) {
  let best = null;
  let min = NF;
  room.players.forEach(p => {
    const n = filled(room, p.id);
    if (n < min) { min = n; best = p; }
  });
  return best;
}

// Die Würfel der vorigen Person bleiben liegen, bis die nächste würfelt. So sehen alle, was eingetragen wurde.
function nextTurn(room, ctx) {
  const p = nextPlayer(room);
  if (!p) { finish(room, ctx); return; }
  room.turnNo += 1;
  room.turn = { no: room.turnNo, player: p.id, phase: 'roll', deadline: ctx.now + ctx.times.turn };
}

function myTurn(room, by, phase) {
  if (room.status !== 'playing' || !room.turn) fail('not-playing');
  if (room.turn.player !== by) fail('not-your-turn');
  if (room.turn.phase !== phase) fail(phase === 'cd' ? 'no-countdown' : 'countdown-running');
}

// n: der wievielte Wurf das sein soll (1 bis 3). Ein doppelter Tipp schickt dieselbe Zahl noch mal
// und wird so einfach abgelehnt.
export function roll(room, by, n, ctx) {
  myTurn(room, by, 'roll');
  const first = room.dice.turn !== room.turn.no;
  const done = first ? 0 : room.dice.rolls;
  if (n !== done + 1) fail('stale');
  if (done >= 3) fail('no-rolls');
  if (!first && room.dice.held.every(Boolean)) fail('all-held');
  if (first) {
    room.dice = Object.assign(freshDice(), { owner: by, turn: room.turn.no });
    room.cdGame = null;   // Ein Countdown von vorher ist jetzt vorbei
  }
  const d = room.dice;
  const vals = d.vals ? d.vals.slice() : [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6; i++) if (!d.held[i]) vals[i] = ctx.rng.d6();
  d.vals = vals;
  d.rolls += 1;
  // 4 gleiche im ersten Wurf schalten den Countdown frei
  if (d.rolls === 1 && Math.max(...countFaces(vals)) >= 4) d.cd = { owner: by, played: false };
  active(room, by);
}

// on: halten (true) oder loslassen (false). So ist es egal, wenn eine Nachricht doppelt ankommt.
export function hold(room, by, i, on) {
  if (!Number.isInteger(i) || i < 0 || i > 5) fail('bad-message');
  myTurn(room, by, 'roll');
  const d = room.dice;
  if (d.turn !== room.turn.no || !d.rolls) fail('no-roll-yet');
  if (d.rolls >= 3) fail('no-rolls');
  d.held[i] = !!on;
  active(room, by);
}

export function enter(room, by, field, ctx) {
  myTurn(room, by, 'roll');
  const d = room.dice;
  if (d.turn !== room.turn.no || !d.rolls) fail('no-roll-yet');
  if (!FIELD_KEYS.includes(field)) fail('bad-message');
  if (has(room.scores, by) && has(room.scores[by], field)) fail('field-taken');
  const pts = scoreFor(field, d.vals);
  scoresOf(room, by)[field] = pts;
  event(room, { type: 'enter', player: by, field, pts });
  active(room, by);
  afterEntry(room, ctx);
}

// Nach dem Eintragen oder Streichen: Countdown, wenn er in diesem Zug freigeschaltet wurde,
// sonst ist die nächste Person dran.
function afterEntry(room, ctx) {
  const d = room.dice;
  if (d.cd && !d.cd.played && d.turn === room.turn.no) {
    room.cdGame = { owner: room.turn.player, stage: 0, pts: 0, got: [], last: null, hit: -1, status: 'play' };
    room.turn.phase = 'cd';
    room.turn.deadline = ctx.now + ctx.times.cd;
    return;
  }
  nextTurn(room, ctx);
}

/* ---------- Countdown ---------- */
// stage: welche Stufe gewürfelt werden soll (0 = sechs Würfel, eine 6 gesucht). Wie bei roll gegen doppelte Tipps.
export function cdRoll(room, by, stage, ctx) {
  myTurn(room, by, 'cd');
  const g = room.cdGame;
  if (!g || g.status !== 'play') fail('no-countdown');
  if (stage !== g.stage) fail('stale');
  const n = 6 - g.stage;
  const vals = Array.from({ length: n }, () => ctx.rng.d6());
  const hit = vals.indexOf(n);
  g.last = vals;
  g.hit = hit;
  if (hit >= 0) {
    g.pts += 10;
    g.got.push(n);
    g.stage += 1;
    if (g.stage >= 6) g.status = 'perfect';
  } else {
    g.status = 'over';
  }
  active(room, by);
  if (g.status !== 'play') endCountdown(room, ctx, false);
}

// Die Punkte trägt der Server selbst ein. Der fertige Countdown bleibt sichtbar, bis die nächste Person würfelt.
function endCountdown(room, ctx, timeout) {
  const g = room.cdGame;
  if (g.status === 'play') g.status = 'over';
  if (g.pts > 0) (has(room.cds, g.owner) ? room.cds[g.owner] : (room.cds[g.owner] = [])).push(g.pts);
  if (room.dice.cd) room.dice.cd.played = true;
  event(room, { type: 'countdown', player: g.owner, pts: g.pts, perfect: g.status === 'perfect', timeout: !!timeout });
  nextTurn(room, ctx);
}

/* ---------- Zugzeit ---------- */
// Ist die Zeit um (mit Puffer), streicht der Server ein zufälliges freies Feld. Ein Countdown endet mit den
// Punkten, die bis dahin geschafft sind. Wer zweimal hintereinander die Zeit verpasst hat und nicht verbunden
// ist, gilt als abwesend: Dann geht es sofort weiter, solange noch jemand anderes da ist.
// Gibt zurück, ob sich etwas geändert hat.
export function tick(room, ctx) {
  let changed = false;
  for (let guard = 0; guard < 5000 && room.status === 'playing' && room.turn; guard++) {
    const t = room.turn;
    const p = playerById(room, t.player);
    if (!p) { nextTurn(room, ctx); changed = true; continue; }
    const due = ctx.now > t.deadline + ctx.times.grace;
    if (!due && !isAbsent(room, p)) break;
    changed = true;
    if (t.phase === 'cd') endCountdown(room, ctx, true);
    else strike(room, p, ctx);
  }
  return changed;
}

function isAbsent(room, p) {
  if (p.missed < 2 || isOnline(p)) return false;
  return room.players.some(q => q !== p && isOnline(q));
}

function strike(room, p, ctx) {
  const s = scoresOf(room, p.id);
  const free = FIELD_KEYS.filter(k => !has(s, k));
  const field = free[ctx.rng.int(free.length)];
  s[field] = 0;
  p.missed += 1;
  event(room, { type: 'timeout', player: p.id, field });
  afterEntry(room, ctx);
}

/* ---------- Ende und Revanche ---------- */
export function totals(room, id) {
  const s = has(room.scores, id) ? room.scores[id] : {};
  const add = list => list.reduce((n, f) => n + (has(s, f.key) ? s[f.key] : 0), 0);
  const upper = add(UPPER);
  const lower = add(LOWER);
  const bonus = upper >= BONUS_MIN ? BONUS_PTS : 0;
  const cd = (has(room.cds, id) ? room.cds[id] : []).reduce((a, b) => a + b, 0);
  return { upper, bonus, lower, cd, total: upper + bonus + lower + cd };
}

// Alle Felder voll: Das Ergebnis kommt nach last, die Lobby wartet wieder. Block und Würfel bleiben
// bis zur Revanche sichtbar. In der Pause können auch neue Leute dazukommen.
function finish(room, ctx) {
  const ranking = room.players.map(p => Object.assign({ id: p.id, name: p.name }, totals(room, p.id)))
    .sort((a, b) => b.total - a.total);
  room.last = { game: room.game, at: ctx.now, ranking };
  room.status = 'lobby';
  room.turn = null;
  event(room, { type: 'end', game: room.game });
}

/* ---------- Verbindungen ---------- */
// conns: offene Verbindungen der Person, als { id: 'Instanz.Nummer', at }. Online ist, wer mindestens eine hat.
// Gibt zurück, ob sich etwas geändert hat.
export function attach(room, id, conn, now) {
  const p = playerById(room, id);
  if (!p || p.conns.some(c => c.id === conn)) return false;
  p.conns = [{ id: conn, at: now }].concat(p.conns).slice(0, 4);
  return true;
}
export function detach(room, id, conn) {
  const p = playerById(room, id);
  if (!p || !p.conns.some(c => c.id === conn)) return false;
  p.conns = p.conns.filter(c => c.id !== conn);
  return true;
}
// Verbindungen von Server-Instanzen, die nicht mehr laufen (etwa nach einem Update), fallen weg.
// alive(instanz) sagt, ob eine Instanz noch läuft.
export function prune(room, alive, now) {
  let changed = false;
  room.players.forEach(p => {
    const keep = p.conns.filter(c => now - c.at < CONN_GRACE || alive(c.id.split('.')[0]));
    if (keep.length !== p.conns.length) { p.conns = keep; changed = true; }
  });
  return changed;
}

/* ---------- Für die Apps ---------- */
// Was die Apps sehen: alles außer den Geräteschlüsseln und Verbindungen.
export function view(room, you) {
  return {
    code: room.code,
    status: room.status,
    seq: room.seq,
    game: room.game,
    host: room.host,
    you,
    players: room.players.map(p => ({ id: p.id, name: p.name, online: isOnline(p), missed: p.missed })),
    scores: room.scores,
    cds: room.cds,
    dice: room.dice,
    cdGame: room.cdGame,
    turn: room.turn,
    events: room.events,
    last: room.last,
  };
}
