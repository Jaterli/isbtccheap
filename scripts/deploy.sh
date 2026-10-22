#!/usr/bin/env bash
# Actualiza el despliegue del droplet. Lo lanza el cron cada día, después de la GitHub Action.
# Si solo han cambiado los datos basta el git pull (están montados como volumen); si cambia el código, reconstruye.
set -euo pipefail
cd "$(dirname "$0")/.."

before=$(git rev-parse HEAD)
git pull --ff-only --quiet
after=$(git rev-parse HEAD)

if [ "$before" != "$after" ] && git diff --name-only "$before" "$after" | grep -qv '^web/public/data/'; then
  docker compose up -d --build
  docker image prune -f
fi
