import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { META } from "./src/i18n/meta";
import { SEO, SEO_CATEGORIES, SEO_CYCLES, SEO_DRAWDOWN, SEO_VALUATION, SEO_VOL } from "./src/i18n/seo";

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

/** Lo mismo para las páginas de gráficas (volatilidad, ciclos, valoración, caídas, categorías): título, introducción y secciones explicativas */
function chartSeoHtml(texts: typeof SEO_VOL, lang: "es" | "en") {
  const s = texts[lang];
  const secs = s.sections.map((x) => `<h2>${esc(x.h)}</h2><p>${esc(x.p)}</p>`).join("");
  return `<main class="container"><h1>${esc(s.title)}</h1><p>${esc(s.intro)}</p>${secs}</main>`;
}

type Page = keyof typeof META;
// Cada página: su HTML de entrada (español) y dónde se escribe la versión en inglés
const PAGES: Record<Page, { input: string; en: string; seo: (lang: "es" | "en") => string }> = {
  index: { input: "index.html", en: "en/index.html", seo: seoHtml },
  volatility: { input: "volatilidad/index.html", en: "en/volatility/index.html", seo: (l) => chartSeoHtml(SEO_VOL, l) },
  cycles: { input: "ciclos/index.html", en: "en/cycles/index.html", seo: (l) => chartSeoHtml(SEO_CYCLES, l) },
  valuation: { input: "valoracion/index.html", en: "en/valuation/index.html", seo: (l) => chartSeoHtml(SEO_VALUATION, l) },
  drawdown: { input: "caidas/index.html", en: "en/drawdown/index.html", seo: (l) => chartSeoHtml(SEO_DRAWDOWN, l) },
  categories: { input: "categorias/index.html", en: "en/categories/index.html", seo: (l) => chartSeoHtml(SEO_CATEGORIES, l) },
};

const pageMeta = (page: Page, lang: "es" | "en") => ({ ...META[page][lang], SEO: PAGES[page].seo(lang) });

/** Un index.html por página e idioma: el español en la ruta de la página y el inglés bajo en/, con sus metadatos para
 * buscadores y redes sociales. Cada página es su propia app; el idioma lo decide la ruta (src/i18n). */
function i18nPages(): Plugin {
  const templates = new Map<Page, string>();
  let outDir = "";
  return {
    name: "isbtccheap:i18n-pages",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // "post": el HTML ya lleva los <script> y <link> de la compilación, que comparten las dos versiones
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const file = ctx.path.replace(/^\//, "");
        const page = (Object.keys(PAGES) as Page[]).find((p) => PAGES[p].input === file) ?? "index";
        templates.set(page, html);
        return fillMeta(html, pageMeta(page, "es"));
      },
    },
    writeBundle() {
      for (const [page, html] of templates) {
        const file = resolve(outDir, PAGES[page].en);
        mkdirSync(resolve(file, ".."), { recursive: true });
        writeFileSync(file, fillMeta(html, pageMeta(page, "en")));
      }
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
      // Las páginas en inglés no tienen HTML propio en desarrollo: usan el de su versión en español
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith("/en/volatility")) req.url = "/volatilidad/";
        else if (req.url?.startsWith("/en/cycles")) req.url = "/ciclos/";
        else if (req.url?.startsWith("/en/valuation")) req.url = "/valoracion/";
        else if (req.url?.startsWith("/en/drawdown")) req.url = "/caidas/";
        else if (req.url?.startsWith("/en/categories")) req.url = "/categorias/";
        next();
      });
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
  build: {
    // Una entrada por página (sus versiones en inglés las escribe i18nPages)
    rollupOptions: { input: Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, resolve(__dirname, v.input)])) },
  },
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
