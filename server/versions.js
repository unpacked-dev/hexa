// Schreibt beim Bauen des Images die Versionen für die Sicherheitsprüfung: bun server/versions.js <versions.json> <ziel>
// Übernimmt versions.json aus dem Repo und ergänzt unter image, was im Image wirklich steckt: Bun, Alpine, SQLite
// und alle Alpine-Pakete. Weicht Bun von versions.json ab, bricht der Build ab. Siehe „Versionen“ in server/README.md.
import { Database } from 'bun:sqlite';

const [from, to] = process.argv.slice(2);
if (!from || !to) {
  console.error('Aufruf: bun server/versions.js <versions.json> <ziel>');
  process.exit(2);
}
const info = await Bun.file(from).json();

const text = async path => {
  try { return (await Bun.file(path).text()).trim(); } catch (e) { return null; }
};

// Alpine-Pakete aus der Datenbank von apk: Blöcke mit P: (Name) und V: (Version)
function apkPackages(db) {
  const out = {};
  if (!db) return out;
  for (const block of db.split(/\n\s*\n/)) {
    const name = /^P:(.+)$/m.exec(block);
    const version = /^V:(.+)$/m.exec(block);
    if (name && version) out[name[1]] = version[1];
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

const db = new Database(':memory:');
const image = {
  built: new Date().toISOString(),
  bun: Bun.version,
  alpine: await text('/etc/alpine-release'),
  sqlite: db.query('SELECT sqlite_version() AS v').get().v,
  apk: apkPackages(await text('/lib/apk/db/installed')),
};
db.close();

const bun = info.components.find(c => c.name === 'bun');
if (!bun || bun.version !== Bun.version) {
  console.error(`versions.json nennt Bun ${bun ? bun.version : '(fehlt)'}, im Image steckt Bun ${Bun.version}. Bitte versions.json anpassen.`);
  process.exit(1);
}

await Bun.write(to, JSON.stringify(Object.assign({}, info, { image }), null, 2) + '\n');
console.log(`${to}: Bun ${image.bun}, Alpine ${image.alpine || '–'}, SQLite ${image.sqlite}, ${Object.keys(image.apk).length} Alpine-Pakete`);
