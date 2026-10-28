#!/bin/bash
# npm install/uninstall desde WSL con el proyecto en un disco de Windows. npm no admite que web/node_modules sea un
# enlace simbólico: se ejecuta en una réplica de web/ en el disco de Linux y se copian de vuelta package.json y
# package-lock.json.
#
# Uso (desde cualquier carpeta del proyecto):
#   bash scripts/npm.sh install            # instalar todo
#   bash scripts/npm.sh install paquete    # añadir un paquete
#   bash scripts/npm.sh uninstall paquete
# Para lo demás (npm run dev, npm run build…), npm normal dentro de web/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPS="${ISBTCCHEAP_DEPS:-$HOME/isbtccheap_deps}/web"
WEB="$ROOT/web"

mkdir -p "$DEPS"
cp "$WEB/package.json" "$DEPS/"
[ -f "$WEB/package-lock.json" ] && cp "$WEB/package-lock.json" "$DEPS/"

(cd "$DEPS" && npm --no-audit --no-fund "$@")

cp "$DEPS/package.json" "$WEB/"
[ -f "$DEPS/package-lock.json" ] && cp "$DEPS/package-lock.json" "$WEB/"

# Enlace web/node_modules -> réplica en el disco de Linux
if [ -e "$WEB/node_modules" ] && [ ! -L "$WEB/node_modules" ]; then
  echo "web/node_modules es una carpeta real en /mnt (lenta): la sustituyo por el enlace…"
  rm -rf "$WEB/node_modules"
fi
ln -sfn "$DEPS/node_modules" "$WEB/node_modules"
