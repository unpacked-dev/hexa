#!/bin/sh
# Sammelt auf dem Server die Versionen aller laufenden Container in eine Datei, für die tägliche Sicherheitsprüfung.
# Gehört nicht zu HEXA selbst, sondern auf den Server mit Coolify. Gilt für jedes Projekt dort.
#
#   sh collect-versions.sh /root/versions/all.json
#
# Pro Container: Name, Image und, falls vorhanden, /versions.json aus dem Container. Projekte wie HEXA legen
# diese Datei beim Bauen an (siehe „Versionen“ in server/README.md). Für Container ohne die Datei, etwa Coolify
# selbst, seinen Proxy oder Datenbanken, steht die Version im Namen des Images. Dazu Betriebssystem, Kernel und
# Docker des Servers. Braucht nur sh, docker und tar. Läuft auch, wenn ein Container keine Shell hat.
# Täglich per cron, etwa um 5 Uhr:  0 5 * * * sh /root/collect-versions.sh /root/versions/all.json
set -eu

out="${1:-./versions-all.json}"
tmp="$out.tmp"
mkdir -p "$(dirname "$out")"

# Text als JSON-String: Backslash und Anführungszeichen maskieren, Zeilenumbrüche raus
str() { printf '"%s"' "$(printf '%s' "$1" | tr -d '\r\n' | sed 's/\\/\\\\/g; s/"/\\"/g')"; }

os="$(. /etc/os-release 2>/dev/null && printf '%s' "${PRETTY_NAME:-}")" || os=""
docker_version="$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)"

{
  printf '{\n  "collected": %s,\n' "$(str "$(date -u +%Y-%m-%dT%H:%M:%SZ)")"
  printf '  "host": { "name": %s, "os": %s, "kernel": %s, "docker": %s },\n' \
    "$(str "$(hostname)")" "$(str "$os")" "$(str "$(uname -r)")" "$(str "$docker_version")"
  printf '  "containers": ['
  first=1
  for id in $(docker ps -q); do
    name="$(docker inspect -f '{{.Name}}' "$id" | sed 's#^/##')"
    image="$(docker inspect -f '{{.Config.Image}}' "$id")"
    # docker cp liefert ein tar, tar -xO packt die Datei aus. Fehlt sie, bleibt es leer.
    versions="$(docker cp "$id:/versions.json" - 2>/dev/null | tar -xO 2>/dev/null || true)"
    [ -n "$versions" ] || versions="null"
    [ "$first" = 1 ] || printf ','
    first=0
    printf '\n    { "name": %s, "image": %s, "versions": %s }' "$(str "$name")" "$(str "$image")" "$versions"
  done
  printf '\n  ]\n}\n'
} > "$tmp"
mv "$tmp" "$out"
echo "$out: $(docker ps -q | wc -l | tr -d ' ') Container"
