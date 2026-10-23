// Schreibt beim Bauen des Images die Versionen für die Sicherheitsprüfung: bun server/versions.js <versions.json> <ziel>
// Übernimmt versions.json aus dem Repo und ergänzt, was im Image wirklich steckt: Alpine, SQLite und alle
// Alpine-Pakete. Nur Projektname und Versionen, damit die tägliche Prüfung kurz bleibt. Weicht Bun von
// versions.json ab, bricht der Build ab. Siehe „Versionen und Sicherheitsprüfung“ in server/README.md.
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
  for (const block of (db || '').split(/\n\s*\n/)) {
    const name = /^P:(.+)$/m.exec(block);
    const version = /^V:(.+)$/m.exec(block);
    if (name && version) out[name[1]] = version[1];
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

if (info.versions.bun !== Bun.version) {
  console.error(`versions.json nennt Bun ${info.versions.bun || '(fehlt)'}, im Image steckt Bun ${Bun.version}. Bitte versions.json anpassen.`);
  process.exit(1);
}

const db = new Database(':memory:');
const found = { alpine: await text('/etc/alpine-release'), sqlite: db.query('SELECT sqlite_version() AS v').get().v };
db.close();
if (!found.alpine) delete found.alpine;
const versions = Object.assign({}, info.versions, found, apkPackages(await text('/lib/apk/db/installed')));

await Bun.write(to, JSON.stringify({ project: info.project, versions }, null, 2) + '\n');
console.log(`${to}: ${Object.keys(versions).length} Versionen, Bun ${Bun.version}, Alpine ${found.alpine || '–'}, SQLite ${found.sqlite}`);
