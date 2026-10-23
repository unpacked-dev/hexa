# HEXA – Online-Server. Läuft mit Coolify auf dem eigenen Server, siehe server/README.md.
# Die Bun-Version nur nach Absprache ändern (CLAUDE.md), zusammen mit .github/workflows/ci.yml und versions.json.
FROM oven/bun:1.4.4-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HEXA_DB=/data/hexa.sqlite

# Keine Pakete, also kein bun install. Nur was der Server braucht und an die Apps ausliefert.
COPY server/*.js server/
COPY js/ js/
COPY css/ css/
COPY lang/ lang/
COPY fonts/ fonts/
COPY icons/ icons/
COPY index.html sw.js manifest.webmanifest favicon.svg ./
# Aus docs/ nur das Vorschaubild für geteilte Links
COPY docs/social-preview.png docs/

# Versionen für die Sicherheitsprüfung: /versions.json, außerhalb von /app, wird nie ausgeliefert.
# versions.json aus dem Repo plus das, was im Image wirklich steckt. Siehe „Versionen“ in server/README.md.
COPY versions.json /tmp/versions.json
RUN bun server/versions.js /tmp/versions.json /versions.json && rm /tmp/versions.json

# Hier liegt die Datenbank. Das Volume übernimmt beim ersten Start den Besitzer dieses Ordners.
RUN mkdir -p /data && chown bun:bun /data
USER bun

EXPOSE 3000
# wget gibt es im Alpine-Image. Coolify nimmt diesen Health Check von selbst.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
CMD ["bun", "server/main.js"]
