#!/usr/bin/env bash
# Actualiza el código desplegado. Los commits que solo cambian datos o news/ no reconstruyen la imagen: la web lee los
# datos de GitHub y el cron ya usa el código nuevo de news/.
set -euo pipefail
cd "$(dirname "$0")/.."

before=$(git rev-parse HEAD)
git pull --ff-only --quiet
after=$(git rev-parse HEAD)

if [ "$before" != "$after" ] && git diff --name-only "$before" "$after" | grep -qvE '^(web/public/data|news)/'; then
  docker compose up -d --build
  # El reverse proxy resuelve isbtccheap_frontend al arrancar y el contenedor recreado puede tener otra IP
  docker exec nginx_reverse_proxy nginx -s reload 2>/dev/null || echo "Aviso: no se pudo recargar nginx_reverse_proxy"
  docker image prune -f
fi
