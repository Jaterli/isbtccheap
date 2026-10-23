#!/usr/bin/env bash
# Actualiza el código desplegado en el servidor. Los datos diarios no lo necesitan: la web los lee de GitHub.
# Los commits que solo cambian datos no reconstruyen la imagen.
set -euo pipefail
cd "$(dirname "$0")/.."

before=$(git rev-parse HEAD)
git pull --ff-only --quiet
after=$(git rev-parse HEAD)

if [ "$before" != "$after" ] && git diff --name-only "$before" "$after" | grep -qv '^web/public/data/'; then
  docker compose up -d --build
  docker image prune -f
fi
