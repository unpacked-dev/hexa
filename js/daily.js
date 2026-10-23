/* HEXA – Tagesspiel: Jeden Tag bekommen alle dieselben Würfe.
   Für jeden Zug (0–14), Wurf (1–3) und Würfelplatz (0–5) steht eine feste Augenzahl, berechnet aus dem Datum.
   Wer an einem Platz neu würfelt, bekommt die Zahl aus dieser Tabelle. Was man hält und wo man einträgt,
   ändert also nichts an den Zahlen, nur daran, was man daraus macht. Der erste Wurf jedes Zugs ist bei
   allen gleich, damit auch die Chancen auf den Countdown. Für den Countdown gibt es eigene Zahlen pro
   Zug, Stufe (0–5) und Würfel.
   Der Tag wechselt um Mitternacht deutscher Zeit, damit alle am selben Tag dasselbe Spiel haben.
   Läuft im Browser (window.HexaDaily) und in Node (Tests). */
(function (root) {
  'use strict';

  const TZ = 'Europe/Berlin';
  const DAY_RE = /^\d{4}-\d\d-\d\d$/;

  // Datum in deutscher Zeit als „2026-10-12“
  let fmt = null;
  function dayKey(now) {
    if (!fmt) fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const p = {};
    fmt.formatToParts(now == null ? Date.now() : now).forEach(x => { p[x.type] = x.value; });
    return `${p.year}-${p.month}-${p.day}`;
  }
  // Am Datum rechnen, nicht in Millisekunden: Bei der Zeitumstellung hat ein Tag 23 oder 25 Stunden.
  const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

  // Zahl zwischen 0 und 1 aus Text und ganzen Zahlen, immer dieselbe für dieselben Werte
  function unit(day, ...xs) {
    let h = 0x811c9dc5;
    for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 0x01000193);
    for (const x of xs) {
      h = Math.imul(h ^ (x >>> 0), 0x01000193);
      h ^= h >>> 15;
      h = Math.imul(h, 0x2c1b3c6d);
      h ^= h >>> 12;
    }
    h = Math.imul(h ^ (h >>> 16), 0x297a2d39);
    h ^= h >>> 15;
    h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const face = (day, ...xs) => 1 + Math.floor(unit('hexa-tagesspiel:' + day, ...xs) * 6);

  const api = {
    TZ,
    DAY_RE,
    dayKey,
    addDays,
    // Ist der Tag day vorbei (deutsche Zeit)? Ein angefangenes Tagesspiel gilt nur an seinem Tag.
    expired: (day, now) => day < dayKey(now),
    // Augenzahl für Zug turn (0–14), Wurf roll (1–3) und Platz slot (0–5)
    die: (day, turn, roll, slot) => face(day, 1, turn, roll, slot),
    // Augenzahl im Countdown für Zug turn, Stufe stage (0–5) und Würfel slot
    cd: (day, turn, stage, slot) => face(day, 2, turn, stage, slot),
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HexaDaily = api;
})(typeof self !== 'undefined' ? self : this);
