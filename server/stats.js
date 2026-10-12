/* HEXA – Spielzähler in Deno KV. Gezählt wird nur, dass ein Spiel gestartet wurde, getrennt nach online und lokal.
   Keine Namen, keine Geräte, keine Adressen.
     ["hexa_stats", "day", "2026-10-12", Art]     Spiele an diesem Tag (deutsche Zeit), bleiben
     ["hexa_stats", "hour", "2026-10-12T14", Art]  Spiele in dieser Stunde (UTC), nur für „Letzte 24 Stunden“, nach 2 Tagen weg
     ["hexa_stats", "total", Art]                  alle Spiele seit Beginn
   Gezählt wird mit sum: Starten viele gleichzeitig, geht keins verloren, und es gibt keine Konflikte.
   Online-Spiele zählt der Server beim Start selbst, lokale meldet die App über POST /count. */

export const KINDS = ['online', 'local'];
const STATS = 'hexa_stats';
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
const num = v => (v instanceof Deno.KvU64 ? Number(v.value) : 0);

export async function countGame(kv, kind, now) {
  if (!KINDS.includes(kind)) throw new Error('Unbekannte Art: ' + kind);
  const res = await kv.atomic()
    .sum([STATS, 'day', dayKey(now), kind], 1n)
    .sum([STATS, 'hour', hourKey(now), kind], 1n)
    .sum([STATS, 'total', kind], 1n)
    .commit();
  if (!res.ok) throw new Error('Zählen fehlgeschlagen');
}

// Gibt { last24h, last7d, last30d, last365d, total } mit je { all, online, local } zurück,
// dazu since (erster gezählter Tag oder null), today und at (Zeitpunkt der Abfrage).
export async function readStats(kv, now) {
  const today = dayKey(now);
  const out = {};
  for (const r of RANGES) out[r.id] = Object.fromEntries([['all', 0], ...KINDS.map(k => [k, 0])]);
  Object.assign(out, { since: null, today, at: new Date(now).toISOString() });
  const add = (id, kind, n) => { out[id][kind] += n; out[id].all += n; };

  // Diese angefangene Stunde und die 23 davor
  for await (const e of kv.list({ prefix: [STATS, 'hour'], start: [STATS, 'hour', hourKey(now - 23 * HOUR)] })) {
    if (KINDS.includes(e.key[3])) add('last24h', e.key[3], num(e.value));
  }
  const days = RANGES.filter(r => r.days).map(r => ({ id: r.id, from: addDays(today, 1 - r.days) }));
  const oldest = days.reduce((a, d) => (d.from < a ? d.from : a), today);
  for await (const e of kv.list({ prefix: [STATS, 'day'], start: [STATS, 'day', oldest] })) {
    const [, , day, kind] = e.key;
    if (!KINDS.includes(kind) || day > today) continue;
    for (const d of days) if (day >= d.from) add(d.id, kind, num(e.value));
  }
  const totals = await kv.getMany(KINDS.map(k => [STATS, 'total', k]));
  KINDS.forEach((k, i) => add('total', k, num(totals[i].value)));
  for await (const e of kv.list({ prefix: [STATS, 'day'] }, { limit: 1 })) out.since = e.key[2];
  return out;
}

// Stunden, die älter als 2 Tage sind, braucht niemand mehr. Gibt die Zahl der gelöschten Einträge zurück.
export async function pruneHours(kv, now) {
  const keys = [];
  for await (const e of kv.list({ prefix: [STATS, 'hour'], end: [STATS, 'hour', hourKey(now - 2 * DAY)] })) keys.push(e.key);
  for (let i = 0; i < keys.length; i += 50) {
    const op = kv.atomic();
    keys.slice(i, i + 50).forEach(k => op.delete(k));
    await op.commit();
  }
  return keys.length;
}

/* ---------- Seite unter /stats ---------- */
const nf = new Intl.NumberFormat('de-DE');
const dateFmt = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const deDay = day => dateFmt.format(Date.parse(day + 'T12:00:00Z'));

export function statsPage(s) {
  const at = Date.parse(s.at);
  const rows = RANGES.map(r => `
      <tr${r.id === 'total' ? ' class="sum"' : ''}><th scope="row">${r.label}</th><td class="all">${nf.format(s[r.id].all)}</td><td>${nf.format(s[r.id].online)}</td><td>${nf.format(s[r.id].local)}</td></tr>`).join('');
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
th, td { padding: 12px 0; text-align: right; border-bottom: 1px solid var(--rule); white-space: nowrap; }
th:first-child { text-align: left; padding-right: 12px; font-weight: 600; }
td { padding-left: 14px; color: var(--ink-2); }
thead th { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
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
      <thead><tr><th scope="col">Zeitraum</th><th scope="col">Alle</th><th scope="col">Online</th><th scope="col">Lokal</th></tr></thead>
      <tbody>${rows}
      </tbody>
    </table>
  </div>
  <p>${s.since ? `Gezählt seit ${deDay(s.since)}. ` : 'Noch kein Spiel gezählt. '}Tage nach deutscher Zeit, heute zählt mit. Lokale Spiele meldet die App beim Start, ohne Internet gehen sie verloren.</p>
  <p>Stand: ${dateFmt.format(at)}, ${timeFmt.format(at)} Uhr · <a href="/stats.json">als JSON</a></p>
</main>
</body>
</html>
`;
}
