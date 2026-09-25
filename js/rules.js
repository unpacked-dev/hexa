/* HEXA – Spielregeln als Daten und Wertung der Felder.
   Läuft im Browser (window.HexaRules) und in Node (für die Tests). */
(function (root) {
  'use strict';

  const UPPER = [
    { key: 'u1', n: 1, name: 'Einser', plural: 'Einsen' },
    { key: 'u2', n: 2, name: 'Zweier', plural: 'Zweien' },
    { key: 'u3', n: 3, name: 'Dreier', plural: 'Dreien' },
    { key: 'u4', n: 4, name: 'Vierer', plural: 'Vieren' },
    { key: 'u5', n: 5, name: 'Fünfer', plural: 'Fünfen' },
    { key: 'u6', n: 6, name: 'Sechser', plural: 'Sechsen' },
  ].map(f => Object.assign(f, { type: 'upper' }));

  const LOWER = [
    { key: 'pasch5', name: 'Fünferpasch', pts: 40, req: 'mind. 5 gleiche' },
    { key: 'pasch6', name: 'Sechserpasch', pts: 75, req: '6 gleiche' },
    { key: 'paare', name: 'Drei Paare', pts: 30, req: '3 Paare' },
    { key: 'drillinge', name: 'Zwei Drillinge', pts: 40, req: '2 Drillinge' },
    { key: 'kstrasse', name: 'Kleine Straße', pts: 25, req: '5 in Folge' },
    { key: 'gstrasse', name: 'Große Straße', pts: 40, req: '1 bis 6' },
    { key: 'tief', name: 'Tiefflug', pts: 25, req: 'nur 1 bis 3' },
    { key: 'hoch', name: 'Höhenflug', pts: 25, req: 'nur 4 bis 6' },
    { key: 'chance', name: 'Chance', pts: 0, req: 'Augensumme' },
  ].map(f => Object.assign(f, { type: f.key === 'chance' ? 'chance' : 'fixed' }));

  const FIELDS = UPPER.concat(LOWER);
  const F = {};
  FIELDS.forEach(f => { F[f.key] = f; });
  const NF = FIELDS.length;
  const BONUS_MIN = 70;
  const BONUS_PTS = 40;

  const sum = a => a.reduce((x, y) => x + y, 0);

  function countFaces(vals) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    vals.forEach(v => { c[v]++; });
    return c;
  }
  function scoreFor(key, vals) {
    const f = F[key];
    const c = countFaces(vals);
    const s = sum(vals);
    const max = Math.max.apply(null, c);
    if (f.type === 'upper') return c[f.n] * f.n;
    switch (key) {
      case 'pasch5': return max >= 5 ? f.pts : 0;
      case 'pasch6': return max === 6 ? f.pts : 0;
      case 'paare': return sum(c.map(x => Math.floor(x / 2))) >= 3 ? f.pts : 0;
      case 'drillinge': return sum(c.map(x => Math.floor(x / 3))) >= 2 ? f.pts : 0;
      case 'kstrasse': return ((c[1] && c[2] && c[3] && c[4] && c[5]) || (c[2] && c[3] && c[4] && c[5] && c[6])) ? f.pts : 0;
      case 'gstrasse': return (c[1] && c[2] && c[3] && c[4] && c[5] && c[6]) ? f.pts : 0;
      case 'tief': return c[1] + c[2] + c[3] === 6 ? f.pts : 0;
      case 'hoch': return c[4] + c[5] + c[6] === 6 ? f.pts : 0;
      case 'chance': return s;
      default: return 0;
    }
  }

  const api = { UPPER, LOWER, FIELDS, F, NF, BONUS_MIN, BONUS_PTS, sum, countFaces, scoreFor };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HexaRules = api;
})(typeof self !== 'undefined' ? self : this);
