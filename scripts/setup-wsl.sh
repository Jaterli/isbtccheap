#!/bin/bash
# Prepara el proyecto para trabajar desde WSL estando en un disco de Windows (/mnt/...).
#
# Leer miles de ficheros a través de /mnt es muy lento, así que las dependencias viven en el disco
# de Linux (~/satoshi_score_deps) y en el proyecto solo hay enlaces simbólicos:
#   web/node_modules -> ~/satoshi_score_deps/web/node_modules
#   .venv            -> ~/satoshi_score_deps/venv
#
# Uso (desde la raíz del proyecto, en WSL):  bash scripts/setup-wsl.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPS="${SATOSHI_DEPS:-$HOME/satoshi_score_deps}"

echo "== Web: dependencias de npm"
bash "$ROOT/scripts/npm.sh" install

echo "== Pipeline: entorno de Python"
[ -d "$DEPS/venv" ] || python3 -m venv "$DEPS/venv"
if [ -e "$ROOT/.venv" ] && [ ! -L "$ROOT/.venv" ]; then
  echo "Ya existe .venv como carpeta real en /mnt (lenta): bórrala y vuelve a ejecutar este script." >&2
  exit 1
fi
ln -sfn "$DEPS/venv" "$ROOT/.venv"
"$ROOT/.venv/bin/pip" install -q --disable-pip-version-check -r "$ROOT/pipeline/requirements.txt"

echo "Listo. Arranca la web con:  cd web && npm run dev"
