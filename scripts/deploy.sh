#!/usr/bin/env bash
# Actualiza el código desplegado en el servidor. Los datos diarios no lo necesitan: la web los lee de GitHub.
# No reconstruyen la imagen los commits que solo cambian datos ni los de news/ (el cron ya usa el código nuevo).
set -euo pipefail
cd "$(dirname "$0")/.."

before=$(git rev-parse HEAD)
git pull --ff-only --quiet
after=$(git rev-parse HEAD)

if [ "$before" != "$after" ] && git diff --name-only "$before" "$after" | grep -qvE '^(web/public/data|news)/'; then
  docker compose up -d --build
  # El reverse proxy resuelve isbtccheap_frontend a una IP al arrancar; el contenedor recreado puede tener otra.
  # Recargar es instantáneo y no corta las demás webs. Si el proxy no está (p. ej. en local), no pasa nada
  docker exec nginx_reverse_proxy nginx -s reload 2>/dev/null || echo "Aviso: no se pudo recargar nginx_reverse_proxy"
  docker image prune -f
fi
