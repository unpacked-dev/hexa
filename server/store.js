/* HEXA – Lobbys in SQLite.
   Jede Lobby ist eine Zeile in der Tabelle rooms mit dem ganzen Stand als JSON.
   Geändert wird immer gleich: lesen, rechnen, schreiben, alles in einem Schritt mit Schreibsperre (db.js).
   So kann niemand doppelt würfeln, auch nicht, wenn beim Update kurz zwei Server an derselben Datei hängen.
   Lobbys ohne Start verschwinden nach 1 Stunde, Spiele 24 Stunden nach der letzten Aktion. */
import { newRoom, randomCode } from './game.js';
import { atomic } from './db.js';

export const LOBBY_TTL = 60 * 60_000;
export const GAME_TTL = 24 * 60 * 60_000;

const ttl = room => (room.status === 'playing' ? GAME_TTL : LOBBY_TTL);
// Abgelaufene Zeilen löscht purgeRooms erst später. Darum zählt beim Lesen immer die eigene Ablaufzeit.
export const isLive = (room, now) => !!room && !(room.expires < now);

const readRaw = (db, code) => {
  const row = db.query('SELECT data FROM rooms WHERE code = ?').get(code);
  return row ? row.data : null;
};
const write = (db, room) => {
  db.query('INSERT INTO rooms (code, data, expires) VALUES (?, ?, ?) ON CONFLICT (code) DO UPDATE SET data = excluded.data, expires = excluded.expires')
    .run(room.code, JSON.stringify(room), room.expires);
};

export function readRoom(db, code, now) {
  const raw = readRaw(db, code);
  const room = raw && JSON.parse(raw);
  return isLive(room, now) ? room : null;
}

// Neue Lobby mit freiem Code. Prüfen und Anlegen passieren in einem Schritt: Einen vergebenen Code
// bekommt keine zweite Lobby. setup(room) trägt zum Beispiel den Host ein.
export function createRoom(db, setup, now, nextCode = randomCode) {
  return atomic(db, () => {
    for (let i = 0; i < 40; i++) {
      const code = nextCode();
      if (readRoom(db, code, now)) continue;
      const room = newRoom(code, now);
      setup(room);
      room.expires = now + ttl(room);
      write(db, room);
      return room;
    }
    throw new Error('Kein freier Code gefunden');
  });
}

// Lobby ändern. fn bekommt eine Kopie des Stands, ändert sie und gibt ein Ergebnis zurück.
// Wirft fn einen Fehler, wird nichts gespeichert. Setzt fn room.gone, wird die Lobby gelöscht.
// Gibt { room, result, changed, gone, missing } zurück. missing: Die Lobby gibt es nicht (mehr).
export function mutate(db, code, fn, now) {
  return atomic(db, () => {
    const raw = readRaw(db, code);
    const old = raw && JSON.parse(raw);
    if (!isLive(old, now)) return { room: null, result: undefined, changed: false, gone: false, missing: true };
    const room = JSON.parse(raw);
    const result = fn(room);
    if (room.gone) {
      db.query('DELETE FROM rooms WHERE code = ?').run(code);
      return { room: null, result, changed: true, gone: true, missing: false };
    }
    if (JSON.stringify(room) === raw) return { room: old, result, changed: false, gone: false, missing: false };
    room.seq = old.seq + 1;
    room.expires = now + ttl(room);
    write(db, room);
    return { room, result, changed: true, gone: false, missing: false };
  });
}

// Abgelaufene Lobbys löschen. Gibt zurück, wie viele es waren.
export function purgeRooms(db, now) {
  return db.query('DELETE FROM rooms WHERE expires < ?').run(now).changes;
}
