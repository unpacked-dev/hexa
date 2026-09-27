/* HEXA – Lobbys in Deno KV.
   Jede Lobby ist ein einziger Eintrag unter ["room", Code] mit dem ganzen Stand.
   Geändert wird immer gleich: lesen, rechnen, atomar schreiben. Hat dazwischen jemand anderes
   geschrieben, geht es mit dem neuen Stand von vorn los. So kann niemand doppelt würfeln.
   Lobbys ohne Start verschwinden nach 1 Stunde, Spiele 24 Stunden nach der letzten Aktion. */
import { newRoom, randomCode } from './game.js';

export const LOBBY_TTL = 60 * 60_000;
export const GAME_TTL = 24 * 60 * 60_000;
const INSTANCE_TTL = 35_000;

export const roomKey = code => ['room', code];
const ttl = room => (room.status === 'playing' ? GAME_TTL : LOBBY_TTL);
// Abgelaufene Einträge löscht Deno KV erst irgendwann danach. Darum zählt die eigene Ablaufzeit.
export const isLive = (room, now) => !!room && !(room.expires < now);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function readRoom(kv, code, now) {
  const e = await kv.get(roomKey(code));
  return isLive(e.value, now) ? e.value : null;
}

// Neue Lobby mit freiem Code. Prüfen und Anlegen passieren in einem Schritt: Ziehen zwei
// gleichzeitig denselben Code, bekommt ihn nur eine Lobby, die andere zieht einen neuen.
// setup(room) trägt zum Beispiel den Host ein.
export async function createRoom(kv, setup, now, nextCode = randomCode) {
  for (let i = 0; i < 40; i++) {
    const code = nextCode();
    const e = await kv.get(roomKey(code));
    if (isLive(e.value, now)) continue;
    const room = newRoom(code, now);
    setup(room);
    room.expires = now + ttl(room);
    const res = await kv.atomic().check(e).set(roomKey(code), room, { expireIn: ttl(room) }).commit();
    if (res.ok) return room;
  }
  throw new Error('Kein freier Code gefunden');
}

// Lobby ändern. fn bekommt eine Kopie des Stands, ändert sie und gibt ein Ergebnis zurück.
// Wirft fn einen Fehler, wird nichts gespeichert. Setzt fn room.gone, wird die Lobby gelöscht.
// Gibt { room, result, changed, gone, missing } zurück. missing: Die Lobby gibt es nicht (mehr).
export async function mutate(kv, code, fn, now) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const e = await kv.get(roomKey(code));
    if (!isLive(e.value, now)) return { room: null, result: undefined, changed: false, gone: false, missing: true };
    const room = structuredClone(e.value);
    const result = fn(room);
    if (!room.gone && same(room, e.value)) return { room: e.value, result, changed: false, gone: false, missing: false };
    const op = kv.atomic().check(e);
    if (room.gone) {
      op.delete(roomKey(code));
    } else {
      room.seq = e.value.seq + 1;
      room.expires = now + ttl(room);
      op.set(roomKey(code), room, { expireIn: ttl(room) });
    }
    const res = await op.commit();
    if (res.ok) return { room: room.gone ? null : room, result, changed: true, gone: !!room.gone, missing: false };
    // Jemand war schneller: kurz warten, dann mit dem neuen Stand noch einmal
    await sleep(Math.random() * 15 * (attempt + 1));
  }
  throw new Error('Lobby ist gerade zu beschäftigt');
}

// Meldet jede Änderung einer Lobby, auch die von anderen Server-Instanzen. Am Anfang kommt einmal
// der aktuelle Stand. null heißt: gelöscht. Reißt die Verbindung zur Datenbank ab, wird neu beobachtet.
// Klappt kv.watch gar nicht, fragt die Instanz stattdessen jede Sekunde nach.
// Gibt eine Funktion zum Beenden zurück.
export function watchRoom(kv, code, onChange, onError = () => {}) {
  let stopped = false;
  let reader = null;
  let timer = 0;
  let fails = 0;
  function poll() {
    const once = async () => {
      try {
        const e = await kv.get(roomKey(code));
        if (!stopped) onChange(e.value);
      } catch (err) { /* nächster Versuch */ }
      if (!stopped) timer = setTimeout(once, 1000);
    };
    once();
  }
  async function run() {
    let got = false;
    try {
      reader = kv.watch([roomKey(code)]).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (stopped) return;
        if (done) break;
        got = true;
        fails = 0;
        onChange(value[0].value);
      }
    } catch (err) {
      if (stopped) return;
      onError(err);
    }
    if (stopped) return;
    if (!got && ++fails >= 3) poll();
    else timer = setTimeout(run, 1000);
  }
  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    if (reader) reader.cancel().catch(() => {});
  };
}

// Jede Server-Instanz meldet sich regelmäßig. Verbindungen von Instanzen, die sich nicht mehr melden
// (etwa nach einem Update), gelten nach einer Schonfrist als getrennt, siehe prune in game.js.
export async function heartbeat(kv, instance, now) {
  await kv.set(['instance', instance], now, { expireIn: INSTANCE_TTL });
}
export async function liveInstances(kv, now) {
  const out = new Set();
  for await (const e of kv.list({ prefix: ['instance'] })) {
    if (now - e.value < INSTANCE_TTL) out.add(e.key[1]);
  }
  return out;
}
export async function forgetInstance(kv, instance) {
  await kv.delete(['instance', instance]);
}
