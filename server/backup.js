/* HEXA – Sicherung der Datenbank. Läuft einmal am Tag als geplante Aufgabe in Coolify: bun server/backup.js
   Schreibt eine Kopie neben die Datenbank (backup-2026-10-23.sqlite) und behält die letzten 7 Kopien.
   VACUUM INTO schreibt eine saubere Kopie, auch während der Server läuft. Den Pfad nimmt es aus HEXA_DB. */
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { openDb } from './db.js';

const KEEP = 7;
const NAME_RE = /^backup-\d{4}-\d\d-\d\d\.sqlite$/;

// Gibt { file, removed } zurück: die neue Kopie und die gelöschten alten.
export function backup(path, now = Date.now()) {
  const dir = dirname(path);
  const file = join(dir, `backup-${new Date(now).toISOString().slice(0, 10)}.sqlite`);
  if (existsSync(file)) unlinkSync(file);   // zweimal am selben Tag: die neuere zählt
  const db = openDb(path);
  try {
    db.query('VACUUM INTO ?').run(file);
  } finally {
    db.close();
  }
  const all = readdirSync(dir).filter(f => NAME_RE.test(f)).sort();
  const removed = all.slice(0, Math.max(0, all.length - KEEP));
  removed.forEach(f => unlinkSync(join(dir, f)));
  return { file, removed };
}

if (import.meta.main) {
  const { file, removed } = backup(process.env.HEXA_DB || 'hexa.sqlite');
  console.log('Gesichert:', file + (removed.length ? `, gelöscht: ${removed.join(', ')}` : ''));
}
