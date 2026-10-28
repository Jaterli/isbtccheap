#!/bin/bash
# Prepara el proyecto para WSL en un disco de Windows (/mnt/...): leer miles de ficheros a través de /mnt es muy lento,
# así que las dependencias viven en el disco de Linux (~/isbtccheap_deps) y aquí solo hay enlaces simbólicos:
#   web/node_modules -> ~/isbtccheap_deps/web/node_modules
#   .venv            -> ~/isbtccheap_deps/venv
#
# Uso (desde la raíz del proyecto, en WSL):  bash scripts/setup-wsl.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPS="${ISBTCCHEAP_DEPS:-$HOME/isbtccheap_deps}"

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
