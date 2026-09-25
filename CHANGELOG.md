# Changelog

Alle wichtigen Änderungen an HEXA stehen hier.
Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionen folgen [Semantic Versioning](https://semver.org/lang/de/).

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

[1.2.0]: https://github.com/unpacked-dev/hexa/releases/tag/v1.2.0
[1.1.0]: https://github.com/unpacked-dev/hexa/releases/tag/v1.1.0
[1.0.0]: https://github.com/unpacked-dev/hexa/releases/tag/v1.0.0
