#!/usr/bin/env bash
# Ejecuta un script de news/ con la clave de news/.env. Lo lanza el cron del droplet (horarios en el README).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
set -a
. "$DIR/.env"
set +a
echo "== $(date -u +%FT%TZ) $1"
# El entorno virtual de news/ si existe (lleva el SDK de Anthropic, que el sistema no deja instalar con pip); si no,
# el python3 del sistema, con el que funciona todo menos los modelos "anthropic:"
PY="$DIR/.venv/bin/python3"
[ -x "$PY" ] || PY=python3
# -n: si la ejecución anterior aún no ha terminado, se salta esta
# El resto de argumentos pasan al script (p. ej. eval_analysis.py --since AAAA-MM-DD)
exec flock -n "/tmp/isbtccheap-${1%.py}.lock" "$PY" "$DIR/$1" "${@:2}"
