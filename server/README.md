# Online-Server für HEXA: Countdown

Der Server würfelt, prüft jeden Zug und achtet auf die Zugzeit. Er läuft mit [Bun](https://bun.sh), ganz ohne weitere Pakete: `Bun.serve` für HTTP und WebSocket, SQLite (`bun:sqlite`) als Datenbank. Die Regeln kommen aus `../js/rules.js`, genau wie in der App. Betrieben wird er in einem Docker-Container mit [Coolify](https://coolify.io) auf einem eigenen Server bei ZAP-Hosting in Frankfurt.

> **Stand:** Online seit Version 1.8.0, seit Version 1.13.0 unter der eigenen Adresse [backend.hexa-countdown.app](https://backend.hexa-countdown.app/): die App unter der Adresse selbst, der WebSocket unter `/ws`. Bis Version 1.16 lief der Server auf Deno Deploy mit Deno KV, seit Version 1.17.0 läuft er mit Bun auf dem eigenen Server ([#16](https://github.com/unpacked-dev/hexa/issues/16), Plan und Anleitung in [`docs/umzug-konzept.md`](../docs/umzug-konzept.md)). Das Konzept des Online-Modus steht in [`docs/online-konzept.md`](../docs/online-konzept.md).

## Dateien

| Datei | Was drin ist |
|---|---|
| `main.js` | Einstieg: HTTP (App, `/health`, `/count`, `/stats`), WebSocket, Nachrichten, Zugzeit, Anwesenheit, Bremsen, Anhalten |
| `game.js` | Spielablauf, nur Rechnen: Stand + Aktion + Uhrzeit ergibt den neuen Stand |
| `db.js` | Öffnet die SQLite-Datei und legt die Tabellen an |
| `store.js` | Lobbys anlegen und in einem Schritt ändern |
| `stats.js` | Spielzähler und die Seite unter `/stats` |
| `backup.js` | Sicherung der Datenbank, einmal am Tag |
| `tests/*.spec.js` | Tests für Spielablauf, Datenbank und den ganzen Server |

Im Hauptordner liegen dazu `package.json` (Befehle), `Dockerfile` und `.dockerignore`. Der Server lädt `js/config.js`, `js/rules.js` und `js/bot.js`, deshalb baut das Dockerfile aus dem ganzen Repo.

## Einstellungen in `js/config.js`

App und Server lesen dieselbe Datei. Nach einer Änderung auf `main` bringen, dann übernehmen GitHub Pages und Coolify sie von selbst. `node --test` prüft, ob die Werte gültig sind.

| Eintrag | Wofür | Standard |
|---|---|---|
| `enableOnline` | Online spielen an oder aus. Aus: Der Server lehnt jede Verbindung mit `online-off` ab, in der App ist „Online“ ausgegraut. | `true` |
| `maxPlayers` | Höchstens so viele Personen pro Spiel, Menschen und Bots zusammen (lokal wie online) | `50` |
| `maxBots` | Höchstens so viele Bots pro Spiel | `18` |
| `botNames` | Namen für Bots | 18 Namen |
| `turnSeconds`, `countdownSeconds` | Online: Zeit pro Zug und für den Countdown | `60`, `30` |
| `botDelays` | Tempo der Bots in ms (lokal wie online) | wie bisher |

## Lokal starten und testen

Nötig ist nur [Bun](https://bun.sh/docs/installation) 1.3 oder neuer. Aus dem Hauptordner des Repos:

```bash
bun run dev    # App und Server auf http://localhost:3000, WebSocket unter ws://localhost:3000/ws
bun run test   # alle Server-Tests
```

`http://localhost:3000/` öffnet die App, `http://localhost:3000/health` zeigt `{"app":"hexa","protocol":3,"online":true,"ok":true}`. Mit zwei Browserfenstern (oder einem privaten Fenster) lässt sich so gegen sich selbst spielen. Die Datenbank liegt lokal in `hexa.sqlite` im Hauptordner (steht in der `.gitignore`). Mit `HEXA_DB=pfad/zur/datei.sqlite` bestimmst du den Ort selbst.

So wie im Betrieb, im Container:

```bash
docker build -t hexa .
docker run --rm -p 3000:3000 -v hexa-data:/data hexa
```

## Betrieb mit Coolify

Der Server läuft als Anwendung in Coolify, gebaut aus dem `Dockerfile`. Wie man sie einrichtet, steht Schritt für Schritt in [`docs/umzug-konzept.md`](../docs/umzug-konzept.md#anleitung-schritt-für-schritt).

| Einstellung | Produktion | Test |
|---|---|---|
| Branch | `main` | Neben-Branch `claude/charming-maxwell-yrwmwc` |
| Domain | `https://backend.hexa-countdown.app` | `https://hexa.unpacked.dev` |
| Build Pack | Dockerfile | Dockerfile |
| Ports Exposes | `3000` (Standard in Coolify) | `3000` |
| Port Mappings | leer | leer |
| Persistent Storage | Volume `hexa-data` nach `/data` | Volume `hexa-test-data` nach `/data` |
| Health Check | aus dem Dockerfile (`/health`) | aus dem Dockerfile |

- **Port Mappings bleiben leer.** Sonst klappen die Updates ohne Pause nicht, und man käme am Proxy vorbei (siehe Bremsen unten).
- **Jeder Push** auf den Branch baut neu, auch wenn sich nur die App ändert, denn der Server liefert sie mit aus. Coolify startet den neuen Container, wartet auf den Health Check und hält dann den alten an.
- **Beim Anhalten** (`SIGTERM`) nimmt der Server keine neuen Verbindungen mehr an und schließt alle offenen mit `1001` („Server hält an“). Die Apps verbinden sich von selbst neu, mit dem neuen Container. Die Lobbys stehen in der Datei auf dem Volume, laufende Spiele gehen also weiter.
- **Sicherung:** Eine geplante Aufgabe in Coolify (*Scheduled Tasks*) führt täglich `bun server/backup.js` aus. Das schreibt `/data/backup-<datum>.sqlite` und behält die letzten 7 Kopien.
- Das Zertifikat für die Domain holt Coolify von selbst (Let's Encrypt). Bei Spaceship steht dafür ein A-Eintrag `backend` auf den Server. `unpacked.dev` zeigt mit allen Subdomains schon dorthin, für die Testadresse ist also nichts einzutragen.

### Die App gleich mit

Der Server liefert auch die App aus: `index.html`, `favicon.svg`, `manifest.webmanifest`, `sw.js` und die Ordner `css/`, `js/`, `lang/`, `fonts/` und `icons/`. Alles andere (etwa `server/`, `docs/` oder `.github/`) gibt es nicht, nur diese Liste. So ist jede Adresse gleich eine fertige Seite zum Spielen, auch die Testadresse.

Nur in der Produktion (`backend.hexa-countdown.app`) leitet die Startseite auf https://hexa-countdown.app weiter. So gibt es nur eine Adresse, unter der man HEXA als App installiert, denn jede Adresse hat ihren eigenen Speicher. `/ws`, `/health` und die Dateien bleiben. Die Liste steht in `REDIRECT_HOSTS` in `server/main.js`.

Die App fragt beim Start `health` auf ihrer eigenen Adresse. Antwortet dort ein HEXA-Server, spielt sie über ihn. Sonst nimmt sie den festen Server `wss://backend.hexa-countdown.app/ws`, zum Beispiel unter hexa-countdown.app (GitHub Pages) oder aus der ZIP. Versionen vor 1.13.0 nutzten noch `wss://hexa.unpacked-dev.deno.net/ws`. Die Adresse gibt es seit dem Umzug nicht mehr.

### Einstellungen über Umgebungsvariablen

| Variable | Wofür | Standard |
|---|---|---|
| `HEXA_DB` | Pfad der Datenbank-Datei | `hexa.sqlite`, im Container `/data/hexa.sqlite` |
| `PORT` | Port | `3000` |

## So arbeitet der Server

- **Eine WebSocket-Verbindung pro Gerät.** Es gibt keine Konten und keine Cookies. Das Gerät erzeugt einmal einen zufälligen Schlüssel und meldet sich damit an. Auf dem Server liegt davon nur ein Hash.
- **Ein Server.** Alle Verbindungen hängen am selben Server. Er schickt jeden neuen Stand direkt an alle in der Lobby.
- **Eine Zeile pro Lobby** in der Tabelle `rooms`, mit dem ganzen Stand als JSON. Jede Änderung läuft so: lesen, prüfen, schreiben, alles in einem Schritt mit Schreibsperre. `bun:sqlite` arbeitet synchron, dazwischen kann nichts anderes passieren. Bei einem Update hängen für ein paar Sekunden zwei Container an derselben Datei. Die Schreibsperre sorgt dafür, dass dabei nichts verloren geht.
- **Mit eigenen Würfeln** (`room.via` ist `own`): Niemand würfelt in der App, `roll`, `hold` und `cdRoll` lehnt der Server mit `own-dice` ab. Jede Person trägt reihum ihren Wert selbst ein, der Server prüft nur, ob es ihn für das Feld gibt. Es gibt kein Zeitlimit (`turn.deadline` ist `null`), niemand wird automatisch übersprungen. Ist jemand weg, kann der Host mit `skip` weitermachen. Bots gibt es in diesem Modus nicht.
- **Zugzeit:** Gespeichert wird nur das Ende des Zugs. Kurz danach (1 Sekunde Puffer) streicht der Server ein zufälliges freies Feld. Ein Countdown bekommt eigene 30 Sekunden. Wer zweimal hintereinander die Zeit verpasst und nicht verbunden ist, wird sofort übersprungen.
- **Bots:** Der Server spielt sie selbst, mit derselben Logik wie die App (`js/bot.js`), in der Stufe, die der Host gewählt hat. Die Fehler leichterer Bots hängen an Lobby, Spiel und Bot, nicht am Zufall des Servers. So entscheidet ein Bot bei jedem Schritt seines Zugs gleich, auch nach einem Neustart. Wann der nächste Schritt fällig ist, steht in `turn.botAt`, genau wie das Ende der Zugzeit. Pro Aufruf gibt es höchstens einen Schritt, die Pausen dazwischen kommen aus `botDelays`. Bots verpassen nie die Zeit. Ohne Verbindungen gibt es keinen Timer: Dann steht das Spiel, auch für die Bots, bis jemand zurückkommt.
- **Anwesenheit:** Nach einem Neustart gelten die Verbindungen von vorher nach etwa 40 Sekunden als getrennt, falls die Apps sich nicht schon neu verbunden haben.
- **Bremsen** zählen pro Internetverbindung, nur im Arbeitsspeicher. Hinter dem Proxy von Coolify kommt jede Verbindung vom Proxy. Die echte Adresse hängt er als letzten Eintrag an `X-Forwarded-For` an. Der Server nimmt genau diesen Eintrag, und nur, wenn die Verbindung aus einem privaten Netz kommt. Direkt von außen ließe sich der Header sonst fälschen.
- **Aufräumen:** Lobbys ohne Start verschwinden nach 1 Stunde, Spiele 24 Stunden nach der letzten Aktion. Einmal pro Stunde löscht der Server sie auch aus der Datei. Dauerhaft bleiben nur die Zähler der Statistik, ohne Bezug zu Personen. IP-Adressen kommen nie in die Datenbank, die Bremsen merken sie sich nur kurz. Bei IPv6 zählt der ganze Anschluss (/64-Netz), sonst ließe sich die Bremse mit immer neuen Adressen umgehen.

## Antwortzeiten messen

In der App zeigt `HexaOnline.timing()` in der Konsole, wie lange Aktionen bis zur Antwort brauchen (Durchschnitt, Maximum, zuletzt, in ms). Mit `localStorage.setItem('hexa-timing', '1')` kommt jede Messung auch als eigene Zeile. Zum Vergleich ein Messlauf gegen die Produktion vom Testrechner aus (Oktober 2026, noch auf Deno Deploy): `ping` 42 ms, Aktionen wie würfeln, halten und eintragen 53 bis 87 ms. Der größte Teil ist also das Netz, Deno KV kam mit rund 15 bis 45 ms dazu. SQLite auf demselben Server braucht für eine Aktion weit unter einer Millisekunde.

Damit es sich trotzdem schnell anfühlt, zeigt die App eigene Aktionen sofort: Gehaltene Würfel und eingetragene Felder stehen gleich da, die Würfel rollen los, bevor die Zahlen kommen. Ein eingetragenes Feld ist blasser, bis der Server es bestätigt. Lehnt er ab oder kommt nach 6 Sekunden nichts, verschwindet die Zahl wieder, und ein Hinweis bittet, noch einmal einzutragen.

## Statistik

Unter [backend.hexa-countdown.app/stats](https://backend.hexa-countdown.app/stats) steht, wie viele Spiele gestartet wurden: in den letzten 24 Stunden, 7, 30 und 365 Tagen und insgesamt, jeweils online, lokal und als Tagesspiel. Dieselben Zahlen gibt es als JSON unter `/stats.json`. Die Seite ist öffentlich, sie zeigt nur Zahlen.

- **Online** zählt der Server selbst, sobald der Host ein Spiel startet, auch bei jeder Revanche.
- **Lokal** schickt die App beim Tippen auf „Spiel starten“ ein leeres `POST /count`, ohne Spitzname und ohne Geräteschlüssel. Ohne Internet geht die Meldung verloren. Läuft die App auf einem einfachen Testserver auf localhost, meldet sie nichts. Pro Internetverbindung zählen höchstens 10 Meldungen in 10 Minuten.
- **Tagesspiel** meldet die App genauso, mit `POST /count?kind=daily`. Übungsrunden zählen mit. Ergebnisse von Tagesspielen bleiben auf dem Gerät.
- **Zeiträume:** „Letzte 24 Stunden“ rechnet in ganzen Stunden (diese und die 23 davor), alles andere in ganzen Tagen nach deutscher Zeit. Heute zählt mit: „Letzte 7 Tage“ sind heute und die 6 Tage davor.
- **In der Datenbank** liegen nur Zähler, in der Tabelle `stats`. Ein Start erhöht drei Zeilen in einem Schritt:

| `scope` | `bucket` | `kind` | Inhalt | Wie lange |
|---|---|---|---|---|
| `day` | `2026-10-12` | `online`, `local`, `daily` | Spiele an diesem Tag (deutsche Zeit) | bleibt |
| `hour` | `2026-10-12T14` | wie oben | Spiele in dieser Stunde (UTC), nur für die letzten 24 Stunden | 2 Tage |
| `total` | leer | wie oben | alle Spiele seit Beginn | bleibt |

Der Server zeigt bis zu 30 Sekunden denselben Stand, damit häufiges Neuladen nicht jedes Mal rechnet. Nach einem neu gezählten Spiel gibt es gleich den neuen. Einmal pro Stunde löscht er die alten Stunden. Mit dem Umzug auf Bun hat die Statistik neu angefangen.

## Nachrichten

Alle Nachrichten sind JSON mit dem Feld `t` für die Art. Höchstens 4 KB pro Nachricht.

### Von der App an den Server

| `t` | Felder | Wofür |
|---|---|---|
| `hello` | `v` (Protokoll, jetzt `3`), `key` (Geräteschlüssel, 16–128 Zeichen `A-Z a-z 0-9 _ -`), optional `code` | Als Erstes. Mit `code` geht es zurück ins eigene Spiel. Apps mit Protokoll 1 (vor den Bots) und 2 (vor den eigenen Würfeln) bekommen `update-needed`. |
| `create` | `name` | Lobby erstellen |
| `join` | `code`, `name` | Lobby beitreten. Ist das Gerät schon drin, geht es einfach zurück. |
| `order` | `ids` (alle Personen in neuer Reihenfolge) | Nur Host, nur in der Lobby |
| `kick` | `id` | Nur Host, nur in der Lobby. Entfernt auch Bots. |
| `addBot` | optional `level`: `easy`, `medium` oder `hard` | Nur Host, nur in der Lobby. Name kommt aus `botNames`. Ohne `level` spielt der Bot schwer, so schicken es ältere Apps. |
| `botLevel` | `id`, `level` | Nur Host, nur in der Lobby: Stufe eines Bots wechseln |
| `via` | `via`: `app` oder `own` | Nur Host, nur in der Lobby: mit der App oder mit eigenen Würfeln. `own` nur ohne Bots. |
| `start` | | Nur Host. Auch allein. |
| `roll` | `n`: der wievielte Wurf (1–3) | Würfeln |
| `hold` | `i` (0–5), `on` (`true`/`false`) | Würfel halten oder loslassen |
| `enter` | `field`, z. B. `gstrasse`. Mit eigenen Würfeln dazu `pts` und optional `cd` | Feld eintragen. Mit eigenen Würfeln der selbst gewählte Wert (muss für das Feld möglich sein, siehe `valuesFor` in `js/rules.js`) und die Punkte aus dem Countdown dieses Zugs (10 bis 60). |
| `fix` | `field`, `pts` | Nur mit eigenen Würfeln: ein eigenes, schon ausgefülltes Feld korrigieren |
| `cds` | `list`, z. B. `[20, 10]` | Nur mit eigenen Würfeln: die eigenen Countdowns korrigieren, höchstens einer pro ausgefülltem Feld |
| `skip` | `turn`: die Nummer des Zugs | Nur mit eigenen Würfeln, nur Host: den Zug der Person überspringen, die gerade dran ist. Ein zufälliges freies Feld wird gestrichen. |
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
  via: 'app',                             // app | own (eigene Würfel)
  seq: 42, game: 1, host: 'a1b2c3d4e5', you: 'f6g7h8i9j0',
  players: [{ id, name, online, missed }], // in der Reihenfolge des Hosts, Bots mit bot: true und level
  scores: { [id]: { u1: 3, gstrasse: 40 } },
  cds: { [id]: [20] },
  dice: { vals: [2, 3, 3, 5, 5, 6], held: [false, true, true, false, false, false], rolls: 2, owner, turn: 7, cd: null },
  cdGame: null,                           // wie lokal: { owner, stage, pts, got, last, hit, status }
  turn: { no: 7, player, phase: 'roll', deadline: 1790000000000 },   // phase: roll | cd, bei Bots dazu botAt
  events: [{ no, type: 'timeout', player, field: 'gstrasse' }],     // die letzten 12 Ereignisse
  last: null,                             // nach dem Spiel: { game, at, ranking: [{ id, name, bot?, level?, upper, bonus, lower, cd, total }] }
}
```

- Die Restzeit rechnet die App selbst aus: `turn.deadline - now` aus der letzten Nachricht, dazu die eigene Uhr seit dem Empfang.
- Die Würfel der vorigen Person bleiben in `dice` liegen, bis die nächste würfelt (`dice.turn` ≠ `turn.no`). Ein fertiger Countdown bleibt ebenso in `cdGame` sichtbar.
- Ereignisse (`events[].type`): `join` (bei Bots mit `bot: true`), `leave`, `kick`, `host`, `start`, `enter`, `timeout`, `countdown`, `end`.
- Host wird immer ein Mensch. Geht der letzte Mensch, wird die Lobby gelöscht, auch wenn noch Bots drin sind.

### Fehlercodes

| Code | Bedeutung |
|---|---|
| `bad-message` | Nachricht kaputt oder unbekannt |
| `no-hello` | Erst `hello` schicken |
| `online-off` | Online spielen ist abgeschaltet (`enableOnline` in `js/config.js`) |
| `update-needed` / `server-old` | App zu alt / Server zu alt |
| `name-invalid` | Name nicht erlaubt (siehe `onlineName` in `js/rules.js`) |
| `too-many` | Zu viele Versuche oder Nachrichten, kurz warten |
| `room-not-found` | Code gibt es nicht (mehr) |
| `room-closed` | Lobby wurde gelöscht |
| `game-running` | Spiel läuft schon, Beitreten geht nicht |
| `room-full` | Die Lobby ist voll (`maxPlayers`, Menschen und Bots zusammen) |
| `bots-full` | Mehr Bots gehen nicht (`maxBots` oder alle Namen vergeben) |
| `not-in-room`, `removed` | Nicht (mehr) in der Lobby, etwa weil der Host dich entfernt hat |
| `not-host` | Nur der Host darf das |
| `not-playing`, `not-your-turn` | Kein Spiel oder nicht dein Zug |
| `countdown-running`, `no-countdown` | Gerade läuft ein Countdown / kein Countdown |
| `no-roll-yet`, `no-rolls`, `all-held` | Erst würfeln / drei Würfe sind vorbei / alle Würfel gehalten |
| `field-taken` | Feld schon ausgefüllt |
| `own-dice` | Mit eigenen Würfeln würfelt die App nicht (und es gibt keine Bots) |
| `has-bots` | Eigene Würfel gehen nur ohne Bots in der Lobby |
| `stale` | Doppelter Tipp oder veraltete Ansicht |
| `server-error` | Unerwarteter Fehler auf dem Server |
