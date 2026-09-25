# Online-Modus – Konzept

> **Entwurf zum Brainstormen.** Noch ist nichts davon gebaut. Stand: 25. September 2026.

## Kurz gesagt

Mehrere Leute spielen HEXA zusammen, jede Person am eigenen Gerät. Eine Person erstellt eine Lobby und bekommt einen Code. Die anderen treten mit diesem Code bei. Man kann auch allein online spielen. Es gibt keine Konten, nur Spitznamen.

Der Server würfelt, prüft jeden Zug und achtet auf die Zugzeit von 60 Sekunden. Er läuft mit Deno auf Deno Deploy und speichert alles in Deno KV.

## Schon entschieden

- Der Server kommt ins selbe Repo, in den Ordner `server/`. Er ist open source wie der Rest.
- Keine Konten, nur Spitznamen.
- Beitritt nur per Code, ohne Einladungslink. Später soll es auch eine Handy-App geben.
- „Online“ im Hauptmenü führt zu: Lobby erstellen oder Lobby beitreten.
- Online wird nur mit App-Würfeln gespielt.
- Man kann auch allein online spielen.
- Jeder Zug hat 60 Sekunden. Man sieht immer, wer dran ist.
- Kurz vor Schluss blinkt die Zeit, ab 10 Sekunden tickt es.
- Ist die Zeit um, streicht der Server ein zufälliges freies Feld.
- Server mit Deno, Datenbank Deno KV.

## Grundsätze (Vorschlag)

1. **Der Server entscheidet.** Er würfelt, prüft jeden Eintrag mit `js/rules.js` und führt den Spielstand. Die App zeigt an und schickt nur Wünsche wie „würfeln“, „Würfel 3 halten“ oder „Große Straße eintragen“. So kann niemand schummeln, obwohl der ganze Code offen ist.
2. **Immer der ganze Stand.** Nach jeder Änderung schickt der Server den kompletten Spielstand, nicht nur die Änderung. Das sind nur ein paar KB. Wer kurz weg war, ist nach dem Wiederverbinden sofort auf dem neuesten Stand.
3. **Gleiche Form wie lokal.** Der Online-Stand hat dieselben Teile wie der lokale (`players`, `scores`, `cds`, `dice`, `cdGame`). So können Block, Würfel, Countdown und Ergebnis fast unverändert bleiben.
4. **Lokal bleibt lokal.** Erst wenn jemand auf „Online“ tippt, verbindet sich die App mit dem Server. Der lokale Modus und die ZIP-Version laufen weiter ohne Internet.
5. **So wenig Daten wie möglich.** Gespeichert werden der Spitzname, ein zufälliger Geräteschlüssel und der Spielstand. Lobbys und Spiele löschen sich von selbst.

## Begriffe

| Begriff | Bedeutung |
|---|---|
| **Lobby** | Der Raum, in dem man sich vor dem Spiel sammelt. |
| **Code** | 6 Ziffern, z. B. `482 913`. Damit treten die anderen bei. |
| **Host** | Wer die Lobby erstellt hat. Startet das Spiel. |
| **Zugzeit** | 60 Sekunden pro Zug. Bewusst nicht „Countdown“, denn so heißt in HEXA schon das Bonusspiel. |

## So läuft es ab

```mermaid
flowchart LR
  S[Hauptmenü] --> O[Online]
  O --> E[Lobby erstellen]
  O --> B[Lobby beitreten<br/>Code eingeben]
  E --> L[Lobby<br/>Code und Personen]
  B --> L
  L -->|Host startet| G[Spiel<br/>Würfel · Block · Regeln]
  G --> R[Ergebnis]
  R --> S
```

1. **Hauptmenü → Online.** Einmal einen Spitznamen eingeben, die App merkt ihn sich. Dann wählen: Lobby erstellen oder beitreten.
2. **Lobby erstellen.** Der Server vergibt einen Code. Den sagt man den anderen, zum Beispiel am Tisch oder im Videocall.
3. **Lobby beitreten.** Code eintippen, fertig. Das Handy zeigt dafür den Ziffernblock.
4. **In der Lobby** sehen alle live, wer schon da ist. Der Host startet, wenn alle da sind. Allein geht es sofort los.
5. **Beim Start** lost der Server die Reihenfolge aus. Danach kann niemand mehr beitreten, wie im lokalen Spiel.
6. **Im Spiel** gibt es die gewohnten Tabs: Würfel, Block, Regeln und Menü. Wer dran ist, würfelt. Alle anderen sehen die Würfel live mit.
7. **Am Ende** kommt das bekannte Ergebnis-Popup mit allen Punkten.

### Entwürfe

**Online-Start**

```
┌────────────────────────────────┐
│ < Hauptmenü                    │
│                                │
│ Dein Spitzname                 │
│ [ Lena                       ] │
│                                │
│ ┌────────────────────────────┐ │
│ │ + Lobby erstellen          │ │
│ │   Du bekommst einen Code   │ │
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │ > Lobby beitreten          │ │
│ │   Code eingeben            │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

**Lobby**, so sieht es der Host:

```
┌────────────────────────────────┐
│ < Lobby verlassen              │
│                                │
│           LOBBY-CODE           │
│            482 913             │
│   Sag den anderen den Code.    │
│                                │
│ Dabei: 3 von 6                 │
│   Lena (du, Host)              │
│   Tim                          │
│   Mia                          │
│                                │
│ 60 Sekunden pro Zug            │
│                                │
│ [       Spiel starten        ] │
└────────────────────────────────┘
```

Alle anderen sehen statt des Knopfs: „Warte, bis Lena startet …“ Ist noch niemand beigetreten, heißt der Knopf „Allein starten“.

**Im Spiel mit der Zugleiste oben**

```
┌────────────────────────────────┐
│ HEXA            Runde 3 von 15 │
│ Tim ist dran              0:42 │
│ [================------------] │
├────────────────────────────────┤
│ Tims Würfel, live:             │
│ [2] [3] [3] [5] [5] [6]        │
│                                │
│ Tim würfelt ...                │
└────────────────────────────────┘
```

## Wer ist dran? Die Zugleiste

- Oben im Spiel, in allen Tabs: „Tim ist dran“, die Restzeit und ein Balken, der abläuft.
- **Bist du dran**, steht dort „Du bist dran!“ in der Akzentfarbe. Das Handy vibriert kurz, und es gibt einen Ton, wenn Töne an sind. Die App springt zum Würfel-Tab.
- **Ab 10 Sekunden** werden Zeit und Balken rot und blinken. Wer dran ist, hört jede Sekunde ein leises Ticken. Die anderen sehen nur das Blinken.
- **Würfel-Tab bei den anderen:** Man sieht die Würfel der Person, die dran ist, mit derselben Animation. Die Knöpfe sind gesperrt, dort steht z. B. „Tim würfelt …“.
- **Block-Tab:** Die Spalte der Person, die dran ist, ist hervorgehoben. Deine Spalte trägt ein „Du“. Ein grauer Punkt zeigt, wer gerade keine Verbindung hat.

## Zugzeit

- Jeder Zug hat 60 Sekunden, für alle drei Würfe und das Eintragen. Für die nächste Person startet die Zeit neu. Einstellen muss man nichts.
- Das Ticken ist ein neuer Spielsound. Wie alle Töne entsteht er im Browser und folgt der Einstellung „Spielsounds“.
- Wer im System „Bewegung reduzieren“ eingeschaltet hat, sieht kein Blinken. Die Zeit wird dann nur rot.

**Ist die Zeit um**, streicht der Server ein zufälliges freies Feld. Dort steht dann eine 0, egal was die Würfel zeigen. Alle sehen kurz, was passiert ist, zum Beispiel: „Zeit um – bei Tim wurde die Große Straße gestrichen.“

**Countdown (Vorschlag):** Hatte die Person im ersten Wurf 4 gleiche, darf sie den Countdown trotzdem spielen. Laut Regeln kommt er nach dem Eintragen, und ein gestrichenes Feld gilt als eingetragen. Für den Countdown gibt es eigene 30 Sekunden. Läuft diese Zeit ab, ist der Countdown vorbei, und die geschafften Stufen zählen.

**Abwesend:** Wer zwei Züge hintereinander verpasst, gilt als abwesend. Dann streicht der Server bei dieser Person sofort, ohne die 60 Sekunden abzuwarten. So müssen die anderen nicht jedes Mal warten. Sobald die Person wieder verbunden ist, wartet das Spiel wieder auf sie.

### So läuft die Zeit technisch

- Der Server speichert nur den Zeitpunkt, an dem der Zug endet (Deadline). Die Apps rechnen die Restzeit selbst aus. Jede Nachricht vom Server enthält seine Uhrzeit, darum stört eine falsch gehende Handy-Uhr nicht.
- Verzögerte Aufgaben (KV-Queues) gibt es auf dem neuen Deno Deploy nicht. Darum löst das Streichen aus, wer den Ablauf zuerst bemerkt: ein Timer auf dem Server oder eine App im Spiel, die „Zeit um“ meldet. Der Server prüft die Uhrzeit immer selbst.
- Ein atomarer Check in Deno KV sorgt dafür, dass pro Zug genau einmal gestrichen wird, auch wenn es mehrere gleichzeitig versuchen.
- Das Feld lost der Server mit derselben fairen Methode aus wie die Würfel.
- Eine Sekunde Puffer: Ein Tipp in letzter Sekunde zählt auch bei langsamem Netz noch.
- Ist niemand mehr verbunden, bleibt das Spiel einfach stehen.

## Verbindung weg, App zu, Handy gesperrt

Handys trennen die Verbindung oft, sobald der Bildschirm ausgeht oder man kurz eine andere App öffnet. Das ist der Normalfall, kein Sonderfall.

- Die App verbindet sich automatisch neu und bekommt den kompletten Stand.
- Code und Geräteschlüssel liegen im Gerät. Im Hauptmenü steht dann „Weiterspielen“, wie beim lokalen Spiel.
- Während eines Online-Spiels bleibt der Bildschirm an. Das kann die App schon.

| Was passiert | Was dann |
|---|---|
| Internet kurz weg | Die App verbindet neu, die Zugzeit läuft weiter. |
| Menü → „Zum Hauptmenü“ | Das Spiel läuft ohne dich weiter, bis du zurückkommst. Bei jedem verpassten Zug wird ein zufälliges Feld gestrichen. |
| Menü → „Spiel verlassen“ | Du bist raus, und deine Punkte sind weg. Vorher kommt eine Warnung, wie lokal beim Entfernen. |
| Der Host geht | Die nächste Person wird Host. |
| Alle sind weg | Das Spiel bleibt stehen. Nach 24 Stunden wird es gelöscht. |
| Server-Update | Verbindungen können kurz abreißen, die Apps verbinden neu. |
| Code falsch, Lobby voll, Spiel läuft schon | Eine klare Meldung in der App |
| Name schon vergeben | Der Server hängt eine Zahl an: „Lena 2“. |
| Alte App-Version, z. B. aus einer alten ZIP | Meldung „Bitte HEXA aktualisieren“ |

## Online-Highscores

Den Tab „Online“ bei den Highscores gibt es schon als Platzhalter.

- In die Liste kommen nur fertige Online-Spiele, auch Solo-Spiele. Weil der Server würfelt, sind alle Punkte echt.
- Ein Eintrag besteht aus Spitzname, Punkten und Datum. Vorschlag: die Top 10 aller Zeiten.
- Beim Spitznamen steht ein Hinweis: Er kann öffentlich in der Bestenliste stehen, also lieber nicht den vollen Namen nehmen.
- In den Einstellungen gibt es „Meine Online-Einträge löschen“. Das klappt auch ohne Konto, über den Geräteschlüssel.
- Ein einfacher Wortfilter hält die schlimmsten Namen draußen. Als Betreiber kannst du Einträge löschen.
- Dein eigenes Ergebnis kommt zusätzlich in deine lokalen Highscores, das der anderen nicht.

## Datenschutz und Recht

Das muss vor dem Start fertig sein:

- **Impressum und Datenschutzerklärung**, erreichbar aus der App und auf der Seite.
- **Nur das Nötigste speichern:** Spitzname, zufälliger Geräteschlüssel (auf dem Server nur als Hash), Spielstand und Online-Highscores. Keine E-Mail, kein Konto. IP-Adressen kommen nicht in die Datenbank. Der Schutz vor zu vielen Versuchen arbeitet nur im Arbeitsspeicher.
- **Automatisch löschen:** Deno KV kann Einträge mit Ablaufzeit speichern. Eine Lobby ohne Start verschwindet nach 1 Stunde, ein Spiel 24 Stunden nach der letzten Aktion.
- **Deno als Dienstleister:** Deno ist ein US-Anbieter. Vor dem Start klären: Gibt es einen Vertrag zur Auftragsverarbeitung (AVV)? Wo liegen die Daten? Was protokolliert Deno selbst, zum Beispiel IP-Adressen?

## Technik

### Überblick

```mermaid
flowchart LR
  A[App von Lena] <-->|WebSocket| S1[Server-Instanz 1]
  B[App von Tim] <-->|WebSocket| S2[Server-Instanz 2]
  S1 <--> KV[(Deno KV)]
  S2 <--> KV
```

- **Eine WebSocket-Verbindung pro Gerät.** Alles läuft darüber: Lobby erstellen, beitreten, würfeln, eintragen. Es gibt keine Cookies und kein Login. Darum klappt es gleich von GitHub Pages, aus der ZIP-Version und später aus der Handy-App.
- **Ein Eintrag pro Lobby in KV** mit dem ganzen Stand. Jede Änderung läuft so: lesen, prüfen, dann atomar schreiben (`atomic().check()`). Kommen zwei Aktionen gleichzeitig, gewinnt eine. Die andere wird neu geprüft. So kann niemand doppelt würfeln.
- **Live über mehrere Instanzen:** Deno Deploy kann die Verbindungen auf mehrere Server-Instanzen verteilen. Lena und Tim hängen dann an verschiedenen. Jede Instanz beobachtet mit `kv.watch()` die Lobbys ihrer Verbindungen und schickt jede Änderung sofort weiter.
- **Würfeln** mit derselben fairen Methode wie in der App (`crypto.getRandomValues`, ohne Verzerrung).
- **Regeln** kommen aus `js/rules.js`. Deno lädt die Datei direkt, es gibt sie also nur einmal.
- **Versionen:** Die App meldet beim Verbinden ihre Protokollversion. Ist sie zu alt, kommt „Bitte aktualisieren“.

Lokal mit Deno 2.9 ausprobiert: `js/rules.js` lädt ohne Änderung. In Deno KV wird ein schon vergebener Code abgelehnt, eine veraltete Änderung auch, und `kv.watch()` meldet jede Änderung.

### Ein Wurf, Schritt für Schritt

```mermaid
sequenceDiagram
  participant L as App von Lena (dran)
  participant S1 as Instanz 1
  participant KV as Deno KV
  participant S2 as Instanz 2
  participant T as App von Tim
  L->>S1: roll
  S1->>KV: lesen, würfeln, atomar schreiben
  KV-->>S1: watch meldet Änderung
  KV-->>S2: watch meldet Änderung
  S1-->>L: state (neue Würfel, Restzeit)
  S2-->>T: state (neue Würfel, Restzeit)
```

### Nachrichten

Von der App an den Server:

| Nachricht | Wofür |
|---|---|
| `hello` | Verbinden, mit Protokollversion und Geräteschlüssel. Bringt dich zurück in dein Spiel. |
| `create` | Lobby erstellen, mit Spitzname |
| `join` | Beitreten, mit Code und Spitzname |
| `start`, `kick` | Nur für den Host in der Lobby: starten, jemanden entfernen |
| `roll`, `hold`, `enter` | Würfeln, einen Würfel halten oder loslassen, ein Feld eintragen |
| `cdRoll` | Eine Stufe im Countdown würfeln |
| `expired` | „Bei mir ist die Zeit um.“ Der Server prüft selbst. |
| `leave` | Lobby oder Spiel verlassen |

Vom Server an die App:

| Nachricht | Inhalt |
|---|---|
| `state` | Der ganze Stand, wer du bist und die Uhrzeit des Servers |
| `error` | Ein Fehlercode wie `room-not-found`, `room-full`, `not-your-turn` oder `update-needed`. Die App übersetzt ihn ins Deutsche oder Englische. |

Jede Aktion schickt die Nummer des Stands mit, auf den sie sich bezieht. Ein doppelter Tipp auf „Eintragen“ wird so einfach ignoriert.

### Daten in Deno KV

| Schlüssel | Inhalt | Wie lange |
|---|---|---|
| `["room", "482913"]` | Lobby oder Spiel: Status, Host, Personen, Block, Würfel, Countdown, Deadline | 1 Stunde ohne Start, sonst 24 Stunden nach der letzten Aktion |
| `["best", …]` | Online-Highscores. Die Punkte stecken im Schlüssel, so liefert KV die Liste schon sortiert. | dauerhaft |

So könnte eine Lobby mitten im Spiel aussehen (Runde 3, Tim ist dran):

```js
{
  v: 1,                     // Format-Version
  code: '482913',
  status: 'playing',        // lobby | playing | done
  host: 'p1',
  seq: 42,                  // zählt bei jeder Änderung hoch
  deadline: 1790000000000,  // Ende des aktuellen Zugs
  players: [
    { id: 'p1', name: 'Lena', key: '<Hash>', online: true, missed: 0 },
    { id: 'p2', name: 'Tim', key: '<Hash>', online: true, missed: 0 },
    { id: 'p3', name: 'Mia', key: '<Hash>', online: false, missed: 1 },
  ],
  // Ab hier wie im lokalen Spielstand:
  scores: {
    p1: { u1: 3, gstrasse: 40, u6: 24 },
    p2: { chance: 23, u5: 15 },
    p3: { tief: 25, u2: 4 },
  },
  cds: { p1: [20] },
  dice: { vals: [2, 3, 3, 5, 5, 6], held: [false, true, true, false, false, false], rolls: 2, owner: 'p2' },
  cdGame: null,
}
```

Den Geräteschlüssel (`key`) schickt der Server nie an die Apps.

### Ordner im Repo

```
hexa/
├── index.html, css/, lang/   App wie bisher
├── js/
│   ├── rules.js              Regeln, nutzen App und Server
│   ├── online.js             neu: Verbindung zum Server, Online-Ansichten
│   └── app.js                bekommt Anschlüsse für den Online-Modus
└── server/                   neu
    ├── main.ts               Einstieg für Deno Deploy: WebSocket, Highscores
    ├── game.ts               Spielablauf: würfeln, prüfen, Zugzeit, Streichen
    ├── store.ts              alles rund um Deno KV
    ├── deno.json             Befehle wie dev und test
    └── *_test.ts             Tests
```

- Der Server ist in TypeScript geschrieben. Deno braucht dafür keinen Build-Schritt.
- `game.ts` rechnet nur: Stand + Aktion + Uhrzeit ergibt den neuen Stand. Kein Netz, keine Datenbank. Dadurch lässt sich der ganze Spielablauf leicht testen.
- Die Release-ZIP bleibt, wie sie ist. `server/` kommt nicht hinein.
- Die CI lässt zusätzlich `deno test` laufen.
- Deno Deploy baut bei jedem Push neu. Commits, die nur die App ändern, bekommen `[skip deploy]` in die Nachricht. So müssen sich laufende Spiele nicht unnötig neu verbinden.

### Testen

- `deno test`: Spielablauf mit festgelegten Würfeln, Zugzeit, Streichen bei Zeitablauf, Reihenfolge, Countdown und Verlassen.
- Zwei simulierte Apps spielen gegen den lokalen Server (`deno task dev`).
- Playwright: Zwei Browserfenster spielen ein ganzes Spiel.

## Umsetzung in Schritten

0. **Technik-Check zuerst, klein:** ein Mini-Server auf Deno Deploy mit WebSocket und `kv.watch()`, dazu zwei Handys. Wir messen, wie schnell Änderungen ankommen und was beim Sperren des Bildschirms passiert. Lokal klappt alles schon. Offen ist nur, ob `kv.watch()` auf dem neuen Deno Deploy genauso läuft, denn beschrieben ist es bisher nur für die alte Plattform. Plan B wäre, dass die Apps regelmäßig nachfragen. Das kostet aber viel mehr Anfragen.
1. **Spielablauf auf dem Server** (`game.ts`) mit Tests, noch ohne Netz.
2. **Server fertig:** WebSocket, KV, Zugzeit, Wiederverbinden, Schutz vor Missbrauch.
3. **App:** Online-Start, Lobby, Zugleiste mit Blinken und Ticken, Spiel und Ergebnis. Alle Texte auf Deutsch und Englisch.
4. **Online-Highscores.**
5. **Vor dem Start:** Impressum, Datenschutz, AVV, Limits des kostenlosen Tarifs prüfen, README, Changelog, Release.

Später vielleicht: Handy-App, Push-Nachricht „Du bist dran“, Emoji-Reaktionen, Zuschauen.

## Bewusst nicht dabei

- Konten, Passwörter, E-Mail-Adressen
- Einladungslinks
- Eigene Würfel im Online-Modus
- Eine einstellbare Zugzeit
- Chat, denn der bräuchte Moderation
- Beitreten, wenn das Spiel schon läuft
- Änderungen am lokalen Modus

## Offene Fragen

1. **Personen pro Lobby:** Ich plane mit höchstens 6, sonst dauert ein Spiel sehr lange. Passt das?
2. **Countdown bei Zeitablauf:** Passt der [Vorschlag oben](#zugzeit) mit eigenen 30 Sekunden, bei dem die geschafften Stufen zählen?
3. **Reihenfolge:** auslosen? Oder soll der Host sie in der Lobby festlegen können?
4. **Code:** 6 Ziffern? Die sind auf dem Ziffernblock schnell getippt und auf Deutsch und Englisch gleich leicht vorzulesen. Die Alternative wären 4 Buchstaben wie `KXMP`.
5. **Revanche:** Nach dem Spiel „Nochmal“ in derselben Lobby mit denselben Leuten?
6. **Bestenliste:** nur „aller Zeiten“ oder zusätzlich „dieser Monat“?

## Quellen

- Deno Deploy Classic wurde am 20. Juli 2026 abgeschaltet. Deno KV gibt es auf dem neuen Deno Deploy, KV-Queues nicht: [Migration Guide](https://docs.deno.com/deploy/migration_guide/)
- Apps aus einem Unterordner und `[skip deploy]`: [Deno Deploy Changelog](https://docs.deno.com/deploy/changelog/)
- `kv.watch()` auf Deno Deploy: [Deno-Blog](https://deno.com/blog/kv-watch)
