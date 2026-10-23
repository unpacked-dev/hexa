/* HEXA – Spielzähler in SQLite. Gezählt wird nur, dass ein Spiel gestartet wurde, getrennt nach online, lokal und Tagesspiel.
   Keine Namen, keine Geräte, keine Adressen. Eine Zeile pro Zähler in der Tabelle stats (db.js):
     scope 'day',   bucket '2026-10-12',    kind   Spiele an diesem Tag (deutsche Zeit), bleiben
     scope 'hour',  bucket '2026-10-12T14', kind   Spiele in dieser Stunde (UTC), nur für „Letzte 24 Stunden“, nach 2 Tagen weg
     scope 'total', bucket '',              kind   alle Spiele seit Beginn
   Online-Spiele zählt der Server beim Start selbst, lokale meldet die App über POST /count, Tagesspiele über
   POST /count?kind=daily (Übungsrunden mit). */
import { atomic } from './db.js';

export const KINDS = ['online', 'local', 'daily'];
const TZ = 'Europe/Berlin';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Zeiträume: 24 Stunden laufend, sonst ganze Tage. Heute zählt mit, „Letzte 7 Tage“ ist also heute und die 6 Tage davor.
export const RANGES = [
  { id: 'last24h', label: 'Letzte 24 Stunden', hours: 24 },
  { id: 'last7d', label: 'Letzte 7 Tage', days: 7 },
  { id: 'last30d', label: 'Letzte 30 Tage', days: 30 },
  { id: 'last365d', label: 'Letzte 365 Tage', days: 365 },
  { id: 'total', label: 'Insgesamt' },
];

const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export function dayKey(now) {
  const p = Object.fromEntries(dayFmt.formatToParts(now).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export const hourKey = now => new Date(now).toISOString().slice(0, 13);
// Am Datum rechnen, nicht in Millisekunden: Bei der Zeitumstellung hat ein Tag 23 oder 25 Stunden.
const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);

export function countGame(db, kind, now) {
  if (!KINDS.includes(kind)) throw new Error('Unbekannte Art: ' + kind);
  const add = db.query('INSERT INTO stats (scope, bucket, kind, n) VALUES (?, ?, ?, 1) ON CONFLICT DO UPDATE SET n = n + 1');
  atomic(db, () => {
    add.run('day', dayKey(now), kind);
    add.run('hour', hourKey(now), kind);
    add.run('total', '', kind);
  });
}

// Gibt { last24h, last7d, last30d, last365d, total } mit je { all, online, local, daily } zurück,
// dazu since (erster gezählter Tag oder null), today und at (Zeitpunkt der Abfrage).
export function readStats(db, now) {
  const today = dayKey(now);
  const out = {};
  for (const r of RANGES) out[r.id] = Object.fromEntries([['all', 0], ...KINDS.map(k => [k, 0])]);
  Object.assign(out, { since: null, today, at: new Date(now).toISOString() });
  const add = (id, rows) => rows.forEach(r => { if (KINDS.includes(r.kind)) { out[id][r.kind] += r.n; out[id].all += r.n; } });

  // Diese angefangene Stunde und die 23 davor
  add('last24h', db.query("SELECT kind, SUM(n) AS n FROM stats WHERE scope = 'hour' AND bucket >= ? GROUP BY kind").all(hourKey(now - 23 * HOUR)));
  const days = db.query("SELECT kind, SUM(n) AS n FROM stats WHERE scope = 'day' AND bucket >= ? AND bucket <= ? GROUP BY kind");
  for (const r of RANGES) if (r.days) add(r.id, days.all(addDays(today, 1 - r.days), today));
  add('total', db.query("SELECT kind, n FROM stats WHERE scope = 'total'").all());
  out.since = db.query("SELECT MIN(bucket) AS day FROM stats WHERE scope = 'day'").get().day || null;
  return out;
}

// Stunden, die älter als 2 Tage sind, braucht niemand mehr. Gibt die Zahl der gelöschten Zeilen zurück.
export function pruneHours(db, now) {
  return db.query("DELETE FROM stats WHERE scope = 'hour' AND bucket < ?").run(hourKey(now - 2 * DAY)).changes;
}

/* ---------- Seite unter /stats ---------- */
const nf = new Intl.NumberFormat('de-DE');
const dateFmt = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const deDay = day => dateFmt.format(Date.parse(day + 'T12:00:00Z'));

export function statsPage(s) {
  const at = Date.parse(s.at);
  const rows = RANGES.map(r => `
      <tr${r.id === 'total' ? ' class="sum"' : ''}><th scope="row">${r.label}</th><td class="all">${nf.format(s[r.id].all)}</td><td>${nf.format(s[r.id].online)}</td><td>${nf.format(s[r.id].local)}</td><td>${nf.format(s[r.id].daily)}</td></tr>`).join('');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>HEXA Statistik</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
@font-face { font-family: 'Archivo'; font-weight: 100 900; font-stretch: 62% 125%; font-display: swap; src: url(/fonts/archivo/archivo-latin.woff2) format('woff2'); }
:root { color-scheme: light; --page: #EDEFF4; --sheet: #FFFFFF; --ink: #1C2030; --ink-2: #4B5165; --ink-3: #7B8196; --rule: #DDE1EA; --pen: #2340C8; }
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; --page: #0D1020; --sheet: #161A2C; --ink: #E9EBF4; --ink-2: #B3B8CC; --ink-3: #868CA4; --rule: #2A3050; --pen: #93A4FF; }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 40px 16px; background: var(--page); color: var(--ink); font: 16px/1.45 Archivo, "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif; }
main { max-width: 560px; margin: 0 auto; display: grid; gap: 20px; }
h1 { margin: 0; font-size: 30px; font-weight: 900; font-stretch: 125%; letter-spacing: .04em; line-height: 1; }
h1 span { display: block; margin-top: 8px; font-size: 13px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--pen); }
.card { background: var(--sheet); border-radius: 16px; padding: 6px 18px; box-shadow: 0 1px 1px rgba(28, 32, 48, .04), 0 10px 30px -14px rgba(28, 32, 48, .28); overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 12px 0 12px 12px; text-align: right; border-bottom: 1px solid var(--rule); white-space: nowrap; }
th:first-child { padding-left: 0; text-align: left; font-weight: 600; white-space: normal; }
td { color: var(--ink-2); }
thead th { vertical-align: bottom; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); white-space: normal; hyphens: manual; }
td.all { color: var(--ink); font-weight: 800; font-size: 18px; }
tr.sum th, tr.sum td { border-bottom: 0; }
tr.sum th { font-weight: 800; }
p { margin: 0; color: var(--ink-2); font-size: 14px; }
a { color: var(--pen); }
</style>
</head>
<body>
<main>
  <h1>HEXA<span>Gestartete Spiele</span></h1>
  <div class="card">
    <table>
      <thead><tr><th scope="col">Zeitraum</th><th scope="col">Alle</th><th scope="col">Online</th><th scope="col">Lokal</th><th scope="col">Tages&shy;spiel</th></tr></thead>
      <tbody>${rows}
      </tbody>
    </table>
  </div>
  <p>${s.since ? `Gezählt seit ${deDay(s.since)}. ` : 'Noch kein Spiel gezählt. '}Tage nach deutscher Zeit, heute zählt mit. Lokale Spiele und Tagesspiele meldet die App beim Start, ohne Internet gehen sie verloren.</p>
  <p>Stand: ${dateFmt.format(at)}, ${timeFmt.format(at)} Uhr · <a href="/stats.json">als JSON</a></p>
</main>
</body>
</html>
`;
}
