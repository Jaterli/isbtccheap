#!/usr/bin/env bash
# Ejecuta un script de news/ con la clave de news/.env. Lo lanza el cron del droplet (horarios en el README):
# noticias cada 15 min en horario de datos de EE. UU. y la eurozona, cada hora el resto; agenda cada hora.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
set -a
. "$DIR/.env"
set +a
echo "== $(date -u +%FT%TZ) $1"
# -n: si la ejecución anterior aún no ha terminado, se salta esta en lugar de solaparse
exec flock -n "/tmp/isbtccheap-${1%.py}.lock" python3 "$DIR/$1"
