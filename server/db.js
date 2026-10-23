/* HEXA – Datenbank: eine SQLite-Datei, ohne weitere Pakete (bun:sqlite).
   Zwei Tabellen:
     rooms  eine Zeile pro Lobby mit dem ganzen Stand als JSON (store.js)
     stats  Spielzähler pro Tag, Stunde und insgesamt (stats.js)
   Der Pfad kommt aus HEXA_DB, im Container /data/hexa.sqlite, in Tests ':memory:'.
   bun:sqlite arbeitet synchron. Lesen, rechnen und schreiben passiert darum in einem Stück, ohne dass etwas
   anderes dazwischenkommt. */
import { Database } from 'bun:sqlite';

export function openDb(path = ':memory:') {
  const db = new Database(path, { create: true, strict: true });
  // Erst warten können, dann auf WAL umschalten: Das Umschalten braucht die Datei kurz für sich allein.
  // Bei einem Update läuft für ein paar Sekunden ein zweiter Server an derselben Datei.
  db.run('PRAGMA busy_timeout = 5000');
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');
  db.run(`CREATE TABLE IF NOT EXISTS rooms (
    code    TEXT PRIMARY KEY,
    data    TEXT NOT NULL,
    expires INTEGER NOT NULL
  ) WITHOUT ROWID`);
  db.run(`CREATE TABLE IF NOT EXISTS stats (
    scope  TEXT NOT NULL,
    bucket TEXT NOT NULL,
    kind   TEXT NOT NULL,
    n      INTEGER NOT NULL,
    PRIMARY KEY (scope, bucket, kind)
  ) WITHOUT ROWID`);
  return db;
}

// fn in einem Schritt mit Schreibsperre. Ein zweiter Server an derselben Datei wartet so lange.
// Wirft fn einen Fehler, wird nichts gespeichert.
export const atomic = (db, fn) => db.transaction(fn).immediate();
