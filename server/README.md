# Online-Server für HEXA: Countdown

Der Server würfelt, prüft jeden Zug und achtet auf die Zugzeit. Er läuft mit [Deno](https://deno.com), ganz ohne weitere Pakete: `Deno.serve` für HTTP und WebSocket, [Deno KV](https://docs.deno.com/deploy/kv/) als Datenbank. Die Regeln kommen aus `../js/rules.js`, genau wie in der App.

> **Stand:** Läuft seit Version 1.8.0 unter [hexa.unpacked-dev.deno.net](https://hexa.unpacked-dev.deno.net/): die App unter der Adresse selbst, der WebSocket unter `/ws`. Das Konzept steht in [`docs/online-konzept.md`](../docs/online-konzept.md).

## Dateien

| Datei | Was drin ist |
|---|---|
| `main.js` | Einstieg: HTTP (App und `/health`), WebSocket, Nachrichten, Zugzeit, Anwesenheit, Bremsen |
| `game.js` | Spielablauf, nur Rechnen: Stand + Aktion + Uhrzeit ergibt den neuen Stand |
| `store.js` | Deno KV: Lobbys anlegen, atomar ändern, beobachten |
| `tests/*.spec.js` | Tests für Spielablauf, Datenbank und den ganzen Server |

Die `deno.json` liegt im Hauptordner des Repos und nicht hier. Der Server lädt nämlich `js/rules.js`, deshalb muss Deno Deploy das ganze Repo sehen.

## Lokal starten und testen

Nötig ist nur [Deno 2](https://docs.deno.com/runtime/getting_started/installation/). Aus dem Hauptordner des Repos:

```bash
deno task dev    # App und Server auf http://localhost:8000, WebSocket unter ws://localhost:8000/ws
deno task test   # alle Server-Tests
```

`http://localhost:8000/` öffnet die App, `http://localhost:8000/health` zeigt `{"app":"hexa","protocol":1,"ok":true}`. Mit zwei Browserfenstern (oder einem privaten Fenster) lässt sich so gegen sich selbst spielen. Die Datenbank liegt lokal in einer Datei im Deno-Cache. Mit `HEXA_KV=./hexa.kv` bestimmst du den Ort selbst.

## Auf Deno Deploy einrichten

1. Auf [console.deno.com](https://console.deno.com) eine neue App anlegen und das GitHub-Repo `unpacked-dev/hexa` verbinden. Das App-Verzeichnis bleibt leer (Hauptordner des Repos).
2. **Datenbank:** unter *Databases* eine Deno-KV-Datenbank anlegen (*Provision Database*) und der App zuweisen (*Assign*). Mehr ist nicht nötig, `Deno.openKv()` findet sie von selbst. Jeder Branch bekommt automatisch eine eigene Datenbank.
3. **Prüfen:** An die Adresse eines Builds `/health` anhängen. Dort muss `{"app":"hexa","protocol":1,"ok":true}` stehen. Der WebSocket ist dann `wss://<adresse>/ws`, unter der Adresse selbst läuft die App.

Einstiegspunkt und Laufzeit stehen in der `deno.json` unter `deploy.runtime`: `mode: "dynamic"` mit `entrypoint: "server/main.js"`. Diese Angabe geht den Einstellungen im Dashboard vor. Ohne sie findet Deno Deploy die `index.html` im Hauptordner und liefert einfach die Website aus. Die `deno.json` schaltet außerdem mit `"unstable": ["kv"]` Deno KV frei, sonst bricht der Start mit „Deno.openKv is not a function“ ab.

Die Produktion baut aus `main` und läuft unter https://hexa.unpacked-dev.deno.net. Jeder andere Branch bekommt eine eigene Adresse mit eigener Datenbank, zu finden unter *Timelines*. Deno Deploy baut bei jedem Push neu, auch wenn sich nur die App ändert, denn der Server liefert sie mit aus. Laufende Spiele verbinden sich danach von selbst kurz neu.

### Die App gleich mit

Der Server liefert auch die App aus: `index.html`, `favicon.svg`, `manifest.webmanifest` und die Ordner `css/`, `js/`, `lang/`, `fonts/` und `icons/`. Alles andere (etwa `server/`, `docs/` oder `.github/`) gibt es nicht, nur diese Liste. So ist jede Adresse auf Deno Deploy gleich eine fertige Seite zum Spielen, auch jede Testadresse eines Branches.

Die App fragt beim Start `health` auf ihrer eigenen Adresse. Antwortet dort ein HEXA-Server, spielt sie über ihn. Sonst nimmt sie den festen Server `wss://hexa.unpacked-dev.deno.net/ws`, zum Beispiel auf GitHub Pages oder aus der ZIP.

### Einstellungen über Umgebungsvariablen

| Variable | Wofür | Standard |
|---|---|---|
| `HEXA_POLL_MS` | Sicherheitsnetz: So oft (in ms) fragt jede Instanz zusätzlich nach dem Stand ihrer Lobbys. `0` schaltet es aus. | `5000` |
| `HEXA_KV` | Nur lokal: Pfad der Datenbank-Datei | Deno-Cache |
| `PORT` | Nur lokal: Port | `8000` |

## So arbeitet der Server

- **Eine WebSocket-Verbindung pro Gerät.** Es gibt keine Konten und keine Cookies. Das Gerät erzeugt einmal einen zufälligen Schlüssel und meldet sich damit an. Auf dem Server liegt davon nur ein Hash.
- **Ein Eintrag pro Lobby** unter `["room", Code]` mit dem ganzen Stand. Jede Änderung läuft so: lesen, prüfen, atomar schreiben. Kommen zwei Aktionen gleichzeitig, gewinnt eine, die andere wird mit dem neuen Stand wiederholt.
- **Mehrere Instanzen:** Jede Instanz beobachtet ihre Lobbys mit `kv.watch()` und schickt Änderungen sofort an ihre Verbindungen. Zusätzlich fragt sie alle 5 Sekunden nach (siehe `HEXA_POLL_MS`).
- **Zugzeit:** Gespeichert wird nur das Ende des Zugs. Kurz danach (1 Sekunde Puffer) streicht die Instanz ein zufälliges freies Feld. Ein Countdown bekommt eigene 30 Sekunden. Wer zweimal hintereinander die Zeit verpasst und nicht verbunden ist, wird sofort übersprungen.
- **Anwesenheit:** Jede Instanz meldet sich alle 10 Sekunden in der Datenbank. Stürzt eine ab, gelten ihre Verbindungen nach etwa 40 Sekunden als getrennt.
- **Aufräumen:** Lobbys ohne Start verschwinden nach 1 Stunde, Spiele 24 Stunden nach der letzten Aktion. IP-Adressen kommen nie in die Datenbank, die Bremsen merken sie sich nur kurz im Arbeitsspeicher. Bei IPv6 zählt der ganze Anschluss (/64-Netz), sonst ließe sich die Bremse mit immer neuen Adressen umgehen.

## Nachrichten

Alle Nachrichten sind JSON mit dem Feld `t` für die Art. Höchstens 4 KB pro Nachricht.

### Von der App an den Server

| `t` | Felder | Wofür |
|---|---|---|
| `hello` | `v` (Protokoll, jetzt `1`), `key` (Geräteschlüssel, 16–128 Zeichen `A-Z a-z 0-9 _ -`), optional `code` | Als Erstes. Mit `code` geht es zurück ins eigene Spiel. |
| `create` | `name` | Lobby erstellen |
| `join` | `code`, `name` | Lobby beitreten. Ist das Gerät schon drin, geht es einfach zurück. |
| `order` | `ids` (alle Personen in neuer Reihenfolge) | Nur Host, nur in der Lobby |
| `kick` | `id` | Nur Host, nur in der Lobby |
| `start` | | Nur Host. Auch allein. |
| `roll` | `n`: der wievielte Wurf (1–3) | Würfeln |
| `hold` | `i` (0–5), `on` (`true`/`false`) | Würfel halten oder loslassen |
| `enter` | `field`, z. B. `gstrasse` | Feld eintragen |
| `cdRoll` | `stage`: welche Stufe (0–5) | Countdown würfeln |
| `expired` | | „Bei mir ist die Zeit um.“ Der Server prüft selbst. |
| `away` | | Zum Hauptmenü: Das Spiel läuft ohne dich weiter. |
| `leave` | | Lobby oder Spiel verlassen. Deine Punkte sind dann weg. |
| `ping` | | Antwort `pong` mit der Uhrzeit des Servers |

`n` bei `roll` und `stage` bei `cdRoll` schützen vor doppelten Tipps: Kommt dieselbe Zahl noch einmal, lehnt der Server mit `stale` ab.

### Vom Server an die App

| `t` | Inhalt |
|---|---|
| `welcome` | Nach `hello`: `now` (Uhrzeit des Servers), `protocol`, `times` |
| `state` | Der ganze Stand in `room`, dazu `now` und `times`. Kommt nach jeder Änderung an alle in der Lobby. |
| `error` | `code` und `re` (auf welche Nachricht). Die App übersetzt den Code. |
| `left`, `away` | Bestätigung für `leave` und `away` |
| `pong` | Antwort auf `ping` |

`room` sieht so aus (Beispiel gekürzt):

```js
{
  code: 'KXMP', status: 'playing',        // lobby | playing
  seq: 42, game: 1, host: 'a1b2c3d4e5', you: 'f6g7h8i9j0',
  players: [{ id, name, online, missed }], // in der Reihenfolge des Hosts
  scores: { [id]: { u1: 3, gstrasse: 40 } },
  cds: { [id]: [20] },
  dice: { vals: [2, 3, 3, 5, 5, 6], held: [false, true, true, false, false, false], rolls: 2, owner, turn: 7, cd: null },
  cdGame: null,                           // wie lokal: { owner, stage, pts, got, last, hit, status }
  turn: { no: 7, player, phase: 'roll', deadline: 1790000000000 },   // phase: roll | cd
  events: [{ no, type: 'timeout', player, field: 'gstrasse' }],     // die letzten 12 Ereignisse
  last: null,                             // nach dem Spiel: { game, at, ranking: [{ id, name, upper, bonus, lower, cd, total }] }
}
```

- Die Restzeit rechnet die App selbst aus: `turn.deadline - now` aus der letzten Nachricht, dazu die eigene Uhr seit dem Empfang.
- Die Würfel der vorigen Person bleiben in `dice` liegen, bis die nächste würfelt (`dice.turn` ≠ `turn.no`). Ein fertiger Countdown bleibt ebenso in `cdGame` sichtbar.
- Ereignisse (`events[].type`): `join`, `leave`, `kick`, `host`, `start`, `enter`, `timeout`, `countdown`, `end`.

### Fehlercodes

| Code | Bedeutung |
|---|---|
| `bad-message` | Nachricht kaputt oder unbekannt |
| `no-hello` | Erst `hello` schicken |
| `update-needed` / `server-old` | App zu alt / Server zu alt |
| `name-invalid` | Name nicht erlaubt (siehe `onlineName` in `js/rules.js`) |
| `too-many` | Zu viele Versuche oder Nachrichten, kurz warten |
| `room-not-found` | Code gibt es nicht (mehr) |
| `room-closed` | Lobby wurde gelöscht |
| `game-running` | Spiel läuft schon, Beitreten geht nicht |
| `room-full` | 50 Personen sind die technische Obergrenze |
| `not-in-room`, `removed` | Nicht (mehr) in der Lobby, etwa weil der Host dich entfernt hat |
| `not-host` | Nur der Host darf das |
| `not-playing`, `not-your-turn` | Kein Spiel oder nicht dein Zug |
| `countdown-running`, `no-countdown` | Gerade läuft ein Countdown / kein Countdown |
| `no-roll-yet`, `no-rolls`, `all-held` | Erst würfeln / drei Würfe sind vorbei / alle Würfel gehalten |
| `field-taken` | Feld schon ausgefüllt |
| `stale` | Doppelter Tipp oder veraltete Ansicht |
| `server-error` | Unerwarteter Fehler auf dem Server |
