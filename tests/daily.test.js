/* Tests für das Tagesspiel (js/daily.js). Ausführen mit: node --test */
const test = require('node:test');
const assert = require('node:assert/strict');
const Daily = require('../js/daily.js');

test('Tag nach deutscher Zeit, Wechsel um Mitternacht', () => {
  assert.equal(Daily.dayKey(Date.UTC(2026, 9, 12, 21, 59)), '2026-10-12');
  assert.equal(Daily.dayKey(Date.UTC(2026, 9, 12, 22, 0)), '2026-10-13');   // Sommerzeit
  assert.equal(Daily.dayKey(Date.UTC(2026, 11, 31, 23, 0)), '2027-01-01');   // Winterzeit
  assert.match(Daily.dayKey(), Daily.DAY_RE);
  assert.equal(Daily.addDays('2026-10-25', 1), '2026-10-26');               // Zeitumstellung
  assert.equal(Daily.addDays('2026-03-01', -1), '2026-02-28');
});

test('Gleiches Datum, gleiche Würfe. Ein anderer Tag hat andere', () => {
  const table = day => {
    const out = [];
    for (let t = 0; t < 15; t++) for (let r = 1; r <= 3; r++) for (let s = 0; s < 6; s++) out.push(Daily.die(day, t, r, s));
    for (let t = 0; t < 15; t++) for (let st = 0; st < 6; st++) for (let s = 0; s < 6 - st; s++) out.push(Daily.cd(day, t, st, s));
    return out.join('');
  };
  assert.equal(table('2026-10-12'), table('2026-10-12'));
  assert.notEqual(table('2026-10-12'), table('2026-10-13'));
  // Würfel und Countdown sind nicht dieselbe Folge
  const first = day => [0, 1, 2, 3, 4, 5].map(s => Daily.die(day, 0, 1, s)).join('');
  const cd = day => [0, 1, 2, 3, 4, 5].map(s => Daily.cd(day, 0, 0, s)).join('');
  assert.notEqual(first('2026-10-12') + first('2026-10-13'), cd('2026-10-12') + cd('2026-10-13'));
});

test('Fair: jede Augenzahl etwa gleich oft, auch über viele Tage', () => {
  const n = [0, 0, 0, 0, 0, 0, 0];
  let total = 0;
  let day = '2026-01-01';
  for (let d = 0; d < 200; d++, day = Daily.addDays(day, 1)) {
    for (let t = 0; t < 15; t++) for (let r = 1; r <= 3; r++) for (let s = 0; s < 6; s++) { n[Daily.die(day, t, r, s)]++; total++; }
  }
  assert.equal(n[0], 0);
  // Chi-Quadrat mit 5 Freiheitsgraden: über 20,5 nur in 0,1 % der Fälle
  const exp = total / 6;
  const chi = n.slice(1).reduce((a, x) => a + (x - exp) ** 2 / exp, 0);
  assert.ok(chi < 20.5, 'Chi-Quadrat ' + chi.toFixed(1) + ' bei ' + n.slice(1).join(', '));
  // Countdown im Tagesspiel so oft wie sonst: 4 gleiche im ersten Wurf in etwa 5 % der Züge
  let cd = 0;
  day = '2026-01-01';
  for (let d = 0; d < 400; d++, day = Daily.addDays(day, 1)) {
    for (let t = 0; t < 15; t++) {
      const c = [0, 0, 0, 0, 0, 0, 0];
      for (let s = 0; s < 6; s++) c[Daily.die(day, t, 1, s)]++;
      if (Math.max(...c) >= 4) cd++;
    }
  }
  const rate = cd / (400 * 15);
  assert.ok(rate > 0.035 && rate < 0.07, 'Countdown-Quote ' + (rate * 100).toFixed(1) + ' %');
});
