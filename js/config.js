/* HEXA – Einstellungen. Hier lässt sich das Wichtigste ohne Programmieren anpassen.
   Gilt überall: für die App (lokal und online) und für den Server.
   Nach einer Änderung: committen und auf main bringen. GitHub Pages und Deno Deploy übernehmen sie dann von selbst.
   Ein Test (tests/config.test.js) prüft, ob die Werte gültig sind: node --test
   Läuft im Browser (window.HexaConfig), in Node (Tests) und in Deno (Server). */
(function (root) {
  'use strict';

  const config = {
    // Online spielen an (true) oder aus (false).
    // Aus: Im Hauptmenü ist „Online“ ausgegraut, und der Server nimmt keine Verbindungen mehr an.
    // Gedacht zum schnellen Abschalten, etwa wenn der kostenlose Tarif von Deno Deploy knapp wird.
    enableOnline: true,

    // Höchstens so viele Personen in einem Spiel, Menschen und Bots zusammen. Lokal wie online.
    maxPlayers: 50,

    // Höchstens so viele Bots in einem Spiel. Es gibt nie mehr Bots als Namen in botNames.
    maxBots: 18,

    // Namen für Bots: Wortspiele rund ums Würfeln, die auf Deutsch und Englisch klappen.
    // Erlaubt sind Buchstaben, Zahlen, Leerzeichen und - _ . ! ?, höchstens 20 Zeichen. Jeder Name nur einmal.
    botNames: [
      'Randy', 'Alea', 'Tessa', 'Dado', 'Pip', 'Rollo', 'Hexi', 'Sixtus', 'Fortuna',
      'Lady Luck', 'Mr. Chance', 'Dr. Wurf', 'Knobel-Knut', 'Pasch-Paula', 'Paschinator',
      'Würfel-Willi', 'Kubus', 'Glücks-Gustav',
    ],

    // Online: Zeit pro Zug und für einen freigeschalteten Countdown, in Sekunden
    turnSeconds: 60,
    countdownSeconds: 30,

    // Tempo der Bots in Millisekunden, lokal wie online. Größere Zahlen: Bots spielen gemächlicher.
    botDelays: {
      start: 800,    // bevor ein Bot nach einem Menschen loslegt
      land: 600,     // bis die Würfel liegen
      think: 900,    // Überlegen nach dem Wurf
      hold: 260,     // zwischen zwei Würfeln, die liegen bleiben sollen
      roll: 400,     // vor dem nächsten Wurf
      enter: 700,    // vor dem Eintragen
      after: 1200,   // nach dem Eintragen, bevor der nächste Bot dran ist
      cd: 900,       // zwischen zwei Würfen im Countdown
    },
  };

  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.HexaConfig = config;
})(typeof self !== 'undefined' ? self : this);
