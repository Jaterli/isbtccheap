import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";

// En WSL, node_modules es un enlace simbólico al disco de Linux (mucho más rápido que /mnt/e):
// hay que permitir a Vite servir ficheros desde su ubicación real
const nodeModules = realpathSync(fileURLToPath(new URL("./node_modules", import.meta.url)));

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Nada de esto es código de la web; vigilarlo solo ralentiza (un .venv son miles de ficheros)
      ignored: ["**/.venv/**", "**/dist/**", "**/*.tsbuildinfo"],
      // En WSL sobre un disco de Windows (/mnt/...) no llegan los eventos de cambio de ficheros: hay que sondear.
      // followSymlinks: false evita que el sondeo entre en node_modules (enlace simbólico al disco de Linux)
      ...(process.env.WSL_DISTRO_NAME && { usePolling: true, interval: 300, followSymlinks: false }),
    },
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), nodeModules] },
  },
});
