# HEXA: Hinweise für Claude

## Versionen und Abhängigkeiten nur nach Absprache

Der Inhaber prüft täglich automatisch alle Versionen auf seinem Server auf Sicherheitslücken. Dafür steht jede Version in `versions.json`, und jedes Image bringt sie unter `/versions.json` mit (siehe „Versionen und Sicherheitsprüfung“ in `server/README.md`).

- Keine Version ändern und nichts Neues aufnehmen ohne ausdrückliche Zustimmung des Inhabers. Das gilt für Bun, das Docker-Image, Node.js, GitHub Actions, npm-Pakete, Schriften und alles, was neu in `versions.json` käme. Auch kleine Updates nicht nebenbei.
- Fällt eine veraltete Version oder eine Sicherheitslücke auf: melden, mit Quelle und Vorschlag, und erst nach Zustimmung umsetzen.
- Jede geänderte Version auch in `versions.json` eintragen. Dort stehen nur der Projektname und die Versionen, keine Beschreibungen, damit die tägliche Prüfung kurz bleibt. `node --test` prüft, dass sie zu `Dockerfile`, `.github/workflows/` und `package.json` passt. Der Docker-Build bricht ab, wenn Bun nicht stimmt.
- `versions.json` und `/versions.json` nie öffentlich ausliefern, also nicht in `PUBLIC_FILES` oder `PUBLIC_DIRS` in `server/main.js` aufnehmen.
