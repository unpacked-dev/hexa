# Changelog

Alle wichtigen Änderungen an HEXA stehen hier.
Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionen folgen [Semantic Versioning](https://semver.org/lang/de/).

## [1.7.0] – 2026-09-26

Noch mehr Abwechslung beim Würfeln.

### Neu

- **Vier neue Wurfarten:** Schütteln wie im Becher, Hüpfen wie ein Flummi, Kreiseln und die Welle, bei der die Würfel nacheinander springen und ihre Zahl zeigen, sobald sie landen. Jede hat eine eigene Bewegung und einen eigenen Klang. Zusammen mit Kullern, Hochwerfen und über den Tisch rollen sind es jetzt sieben.

### Geändert

- **Mehr Wechsel:** Die Wurfart wechselt zufällig, aber es kommt nie eine der letzten drei. Die drei Würfe eines Zugs sehen also immer verschieden aus.

## [1.6.0] – 2026-09-26

Mehr Abwechslung beim Würfeln, und die Musik läuft stabiler.

### Neu

- **Drei Wurfarten:** Kullern, Hochwerfen und über den Tisch rollen, jede mit eigener Bewegung und eigenem Klang. Sie wechseln zufällig, aber nie zweimal hintereinander dieselbe. Dazu dreht sich jeder Würfel etwas anders, fliegt unterschiedlich hoch und startet leicht versetzt.
- **Steigende Töne:** Liegen mehr gleiche Würfel als vorher, gibt es einen Ton: leise bei 4, höher bei 5, bei 6 mit hellem Akkord.
- **Große Straße:** Die sechs Töne des Countdowns spielen als kurzer Lauf nach oben.
- **Konfetti:** bei 6 gleichen, beim perfekten Countdown und bei einem neuen Rekord. Bei „Bewegung reduzieren“ gibt es keins.

### Behoben

- **Musik stockt nicht mehr:** Auf dem iPhone fing die Musik nach etwa einer halben Stunde an zu stocken. Jeder Ton ließ kleine Audio-Bausteine zurück, die Safari nicht aufräumt. Jetzt werden sie nach dem Ausklingen abgehängt. Zusätzlich baut sich der Weg der Musik nach 20 Minuten weich neu auf.
- **Kein fremder Ton beim Sperren:** Beim Sperren des Handys war ein Ton zu hören, der nicht zur Musik passte. Jetzt wird erst ausgeblendet und dann angehalten, und schon geplante Töne werden abgesagt.

## [1.5.0] – 2026-09-25

Computergegner: Jetzt könnt ihr gegen Bots spielen.

### Neu

- **Bots:** In der Spieler-Auswahl holt „Bot hinzufügen“ einen Computergegner dazu, mit Namen wie Randy, Pasch-Paula oder Dr. Wurf. Bots spielen sichtbar Zug für Zug: Sie würfeln, überlegen, lassen Würfel liegen, tragen ein und spielen ihren Countdown.
- **Fast perfektes Spiel:** Bots rechnen jeden Zug exakt durch. In 100.000 Testspielen holen sie im Schnitt 322,5 Punkte, perfektes Spiel bringt 323,7.
- **Werkzeuge für die Bots:** `tools/` rechnet das perfekte Spiel für alle 1,65 Millionen Spielstände aus, leitet daraus die Bot-Werte ab und simuliert Partien.
- **Konzept für den Online-Modus:** steht in `docs/online-konzept.md`.

### Geändert

- **Mit Bots nur App-Würfel:** Ihre Spalten im Block sind gesperrt, während ihres Zugs kann niemand für sie würfeln. In die Highscores kommen nur Menschen.
- **Rückgängig mit Bots:** Ist als Nächstes ein Bot dran, bleibt „Rückgängig“ 3,5 statt 5 Sekunden, und der Bot wartet so lange.
- **Zurücksetzen-Knopf im Würfel-Tab entfernt:** Schlechte Würfe lassen sich nicht mehr einfach wegwerfen. Nach dem Spielende geht freies Würfeln trotzdem weiter.
- **Lange Namen** brechen im Würfel-Tab in zwei Zeilen um, statt abgeschnitten zu werden.
- **Screenshots** im README zeigen den neuen Stand.

## [1.4.0] – 2026-09-25

HEXA spricht jetzt auch Englisch.

### Neu

- **Englisch:** Steht der Browser nicht auf Deutsch, startet HEXA auf Englisch. Übersetzt sind alle Texte, auch die Regeln. Tiefflug und Höhenflug heißen dort Low Roll und High Roll, der Block heißt Scorecard.
- **Sprache in den Einstellungen:** Deutsch oder English. Die Wahl gilt sofort und bleibt gespeichert.
- **Sprachdateien:** Alle Texte stehen in `lang/de.js` und `lang/en.js`. Ein Test prüft, dass in keiner Sprache ein Text fehlt.

### Geändert

- **Datum:** Die Highscores zeigen das Datum so, wie es in der gewählten Sprache und im Browser üblich ist.
- **Startbildschirm:** erscheint erst, wenn alle Texte in der richtigen Sprache stehen. So blitzt nichts in der falschen Sprache auf.

### Behoben

- Die Taste M bei offenen Highscores löste einen Fehler aus, und der Hinweis „Töne aus“ erschien nicht.

## [1.3.0] – 2026-09-25

Neuer Spielablauf mit Spielende und Highscores.

### Neu

- **Spieler-Auswahl:** „Lokal“ führt zuerst zu „Wer spielt mit?“. Dort wählt ihr, ob mit der App oder mit eigenen Würfeln gespielt wird. Mit der App geht es zum Würfeln, mit eigenen Würfeln direkt zum Block.
- **Spiel beenden:** Sind alle Runden gespielt, erscheint im Würfel- und im Block-Tab „Spiel beenden“. Das Ergebnis zeigt die Platzierung aller Personen und neue Rekorde. Danach geht es zurück ins Hauptmenü oder mit „Nochmal spielen“ direkt in ein neues Spiel.
- **Highscores:** eigener Button im Hauptmenü mit den Tabs „Lokal“ (die zehn besten Ergebnisse auf diesem Gerät) und „Online“ (bald verfügbar).
- **Pausieren und Abbrechen:** Über „Menü“ geht es jederzeit ins Hauptmenü. Ein pausiertes Spiel geht mit „Lokal“ weiter, ein abgebrochenes lässt sich rückgängig machen.
- **Spieler im Spiel bearbeiten:** Ein Tipp auf einen Namen im Block benennt die Person um oder entfernt sie. Stehen schon Punkte drin, fragt die App vorher nach.

### Geändert

- **Leiste unten:** Aus „Spieler“ wird „Menü“. Es führt zurück ins Hauptmenü, das Logo oben ebenso.
- **Bestenliste:** ist jetzt Teil der Highscores und zeigt zehn statt fünf Ergebnisse.
- **Neues Spiel:** Der bisherige Knopf entfällt. Ein neues Spiel startet über „Nochmal spielen“ im Ergebnis oder über „Lokal“ im Hauptmenü.
- **Ältere Spielstände:** Ein laufendes Spiel aus einer früheren Version geht einfach weiter.

## [1.2.0] – 2026-09-25

Startbildschirm, Einstellungen und fallende Würfel.

### Neu

- **Startbildschirm:** Logo, Spielmodi „Lokal“ und „Online“ (bald verfügbar) und Einstellungen. Das Logo in der Kopfzeile führt zurück.
- **Einstellungen:** Design hell, dunkel oder automatisch, Musik und Spielsounds getrennt schaltbar mit eigener Lautstärke, Sprache (bald verfügbar).
- **Fallende Würfel:** auf dem Startbildschirm echte Würfel, im Spiel dezente gezeichnete. Lassen sich in den Einstellungen ausschalten und stehen bei „Bewegung reduzieren“ still.

### Geändert

- **Kopfzeile:** nur noch Rundenanzeige und Zahnrad für die Einstellungen.
- **Nebeneinander am Desktop:** Der Knopf sitzt jetzt im aktiven Würfel- bzw. Block-Tab.
- **Taste M:** schaltet alle Töne aus und wieder so an, wie sie vorher waren.
- **Suchmaschinen:** nehmen die Seite nicht mehr auf (`noindex`).

## [1.1.0] – 2026-09-25

Keine Verbindung mehr zu fremden Servern.

### Geändert

- **Schriften lokal:** Archivo und Kalam liegen jetzt im Repository statt bei Google Fonts. Beim Spielen entsteht keine Verbindung mehr zu Google (DSGVO). Aussehen und Verhalten bleiben gleich.
- **Release-Workflow:** prüft die Versionsnummer vorab und nennt den Grund direkt in der Übersicht, wenn etwas fehlt.

### Neu

- **Lizenzhinweise:** `THIRD-PARTY-NOTICES.md` mit den Lizenzen der Schriften (SIL Open Font License) und der Lucide-Icons (ISC/MIT). Die Lizenztexte der Schriften liegen neben den Schriftdateien.
- Die ZIP-Datei im Release enthält jetzt auch Schriften und Lizenzhinweise und funktioniert komplett offline.

## [1.0.0] – 2026-09-25

Die erste Version von HEXA.

### Neu

- **Würfel:** 6 Würfel, bis zu 3 Würfe pro Zug, Würfel per Tippen halten und lösen. Mit Rollanimation, Ton und Vibration.
- **Spielblock:** 15 Felder in oberem und unterem Block. Summen, Bonus (40 Punkte ab 70 oben) und Endstand werden automatisch berechnet.
- **Schnell eintragen:** Nach jedem Wurf zeigt die App, was jedes freie Feld bringt. Felder lassen sich auch direkt im Block setzen, ändern oder löschen.
- **Countdown:** Bonusspiel bei mindestens 4 gleichen im ersten Wurf. Startet nach dem Eintragen automatisch.
- **Spieler:** beliebig viele Personen, Reihenfolge änderbar, Bestenliste mit den fünf besten Ergebnissen. Solo-Spiel mit Richtwert.
- **Rückgängig:** Einträge, gelöschte Personen und ein neues Spiel lassen sich zurücknehmen.
- **Regeln:** Kurzübersicht, ausführliche Regeln mit Beispielen und Wahrscheinlichkeiten.
- **Design:** hell und dunkel, Nebeneinander-Ansicht für große Bildschirme, Tastaturkürzel.
- **Ton:** Effekte und Lo-Fi-Musik, komplett im Browser erzeugt, jederzeit stumm schaltbar.
- **Web-App:** installierbar auf dem Home-Bildschirm, Bildschirm bleibt während des Spiels an.
- **Tests:** Wertung aller Felder mit `node --test` abgedeckt.

[1.7.0]: https://github.com/unpacked-dev/hexa/releases/tag/v1.7.0
[1.6.0]: https://github.com/unpacked-dev/hexa/releases/tag/v1.6.0
[1.5.0]: https://github.com/unpacked-dev/hexa/releases/tag/v1.5.0
[1.4.0]: https://github.com/unpacked-dev/hexa/releases/tag/v1.4.0
[1.3.0]: https://github.com/unpacked-dev/hexa/releases/tag/v1.3.0
[1.2.0]: https://github.com/unpacked-dev/hexa/releases/tag/v1.2.0
[1.1.0]: https://github.com/unpacked-dev/hexa/releases/tag/v1.1.0
[1.0.0]: https://github.com/unpacked-dev/hexa/releases/tag/v1.0.0
