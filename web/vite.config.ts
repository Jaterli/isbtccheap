import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { META, type PageMeta } from "./src/i18n/meta";

// En WSL, node_modules es un enlace simbólico al disco de Linux (mucho más rápido que /mnt/e):
// hay que permitir a Vite servir ficheros desde su ubicación real
const nodeModules = realpathSync(fileURLToPath(new URL("./node_modules", import.meta.url)));

const fillMeta = (html: string, meta: PageMeta) =>
  html.replace(/__([A-Z_]+)__/g, (m, key: string) => meta[key as keyof PageMeta] ?? m);

/** Un index.html por idioma: el español en la raíz y el inglés en en/index.html, con sus metadatos para buscadores
 * y redes sociales. La app es la misma; el idioma lo decide la ruta (src/i18n). */
function i18nPages(): Plugin {
  let template = "";
  let outDir = "";
  return {
    name: "isbtccheap:i18n-pages",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // "post": el HTML ya lleva los <script> y <link> de la compilación, que comparten las dos versiones
    transformIndexHtml: {
      order: "post",
      handler(html) {
        template = html;
        return fillMeta(html, META.es);
      },
    },
    writeBundle() {
      mkdirSync(resolve(outDir, "en"), { recursive: true });
      writeFileSync(resolve(outDir, "en/index.html"), fillMeta(template, META.en));
    },
  };
}

export default defineConfig({
  plugins: [react(), i18nPages()],
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
