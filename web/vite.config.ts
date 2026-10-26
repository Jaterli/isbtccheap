import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { META } from "./src/i18n/meta";
import { SEO } from "./src/i18n/seo";

// En WSL, node_modules es un enlace simbólico al disco de Linux (mucho más rápido que /mnt/e):
// hay que permitir a Vite servir ficheros desde su ubicación real
const nodeModules = realpathSync(fileURLToPath(new URL("./node_modules", import.meta.url)));

const fillMeta = (html: string, meta: Record<string, string>) =>
  html.replace(/__([A-Z_]+)__/g, (m, key: string) => meta[key] ?? m);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Presentación y preguntas frecuentes en el HTML inicial (dentro de #root: React lo sustituye al cargar). Es lo que
 * leen los rastreadores que no ejecutan JavaScript; Google indexa la sección visible de components/Faq.tsx */
function seoHtml(lang: "es" | "en") {
  const s = SEO[lang];
  const faq = s.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("");
  return `<main class="container"><h1>${esc(s.title)}</h1><p>${esc(s.intro)}</p><h2>${esc(s.faqTitle)}</h2>${faq}</main>`;
}

const pageMeta = (lang: "es" | "en") => ({ ...META[lang], SEO: seoHtml(lang) });

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
        return fillMeta(html, pageMeta("es"));
      },
    },
    writeBundle() {
      mkdirSync(resolve(outDir, "en"), { recursive: true });
      writeFileSync(resolve(outDir, "en/index.html"), fillMeta(template, pageMeta("en")));
    },
  };
}

/** En desarrollo sirve /news/*.json (noticias y agenda) desde news/out, donde los dejan los scripts de news/.
 * En producción los sirve nginx desde la carpeta en la que escriben los scripts del droplet. */
function devNews(): Plugin {
  const dir = fileURLToPath(new URL("../news/out/", import.meta.url));
  return {
    name: "isbtccheap:dev-news",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/news", (req, res) => {
        const name = (req.url ?? "").split("?")[0].replace(/^\//, "");
        const file = dir + name;
        if (!/^[\w-]+\.json$/.test(name) || !existsSync(file)) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(file));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), i18nPages(), devNews()],
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
