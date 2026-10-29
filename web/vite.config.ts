import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { META } from "./src/i18n/meta";
import { SEO, SEO_CATEGORIES, SEO_CYCLES, SEO_DRAWDOWN, SEO_ETF, SEO_LIQUIDITY, SEO_PHASE, SEO_VALUATION, SEO_VOL } from "./src/i18n/seo";

// En WSL node_modules es un enlace simbólico al disco de Linux: Vite debe poder servir desde su ubicación real
const nodeModules = realpathSync(fileURLToPath(new URL("./node_modules", import.meta.url)));

const fillMeta = (html: string, meta: Record<string, string>) =>
  html.replace(/__([A-Z_]+)__/g, (m, key: string) => meta[key] ?? m);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Texto de la página en el HTML inicial (dentro de #root; React lo sustituye), para los rastreadores sin JavaScript */
function seoHtml(lang: "es" | "en") {
  const s = SEO[lang];
  const faq = s.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("");
  return `<main class="container seo-prerender"><h1>${esc(s.title)}</h1><p>${esc(s.intro)}</p><h2>${esc(s.faqTitle)}</h2>${faq}</main>`;
}

/** Lo mismo para las páginas de gráficas */
function chartSeoHtml(texts: typeof SEO_VOL, lang: "es" | "en") {
  const s = texts[lang];
  const secs = s.sections.map((x) => `<h2>${esc(x.h)}</h2><p>${esc(x.p)}</p>`).join("");
  return `<main class="container seo-prerender"><h1>${esc(s.title)}</h1><p>${esc(s.intro)}</p>${secs}</main>`;
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
  etf: { input: "etf/index.html", en: "en/etf/index.html", seo: (l) => chartSeoHtml(SEO_ETF, l) },
  liquidity: { input: "liquidez/index.html", en: "en/liquidity/index.html", seo: (l) => chartSeoHtml(SEO_LIQUIDITY, l) },
  phase: { input: "tendencia/index.html", en: "en/trend/index.html", seo: (l) => chartSeoHtml(SEO_PHASE, l) },
};

const pageMeta = (page: Page, lang: "es" | "en") => ({ ...META[page][lang], SEO: PAGES[page].seo(lang) });

/** Escribe la versión en inglés de cada página bajo en/, con sus metadatos. */
function i18nPages(): Plugin {
  const templates = new Map<Page, string>();
  let outDir = "";
  return {
    name: "isbtccheap:i18n-pages",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // "post": el HTML ya lleva los <script> y <link> de la compilación
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

/** En desarrollo sirve /news/*.json desde news/out (en producción, nginx). */
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
        else if (req.url?.startsWith("/en/etf")) req.url = "/etf/";
        else if (req.url?.startsWith("/en/liquidity")) req.url = "/liquidez/";
        else if (req.url?.startsWith("/en/trend")) req.url = "/tendencia/";
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
    rollupOptions: { input: Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, resolve(__dirname, v.input)])) },
  },
  server: {
    watch: {
      ignored: ["**/.venv/**", "**/dist/**", "**/*.tsbuildinfo"],
      // En WSL sobre /mnt/... no llegan los eventos de cambio: hay que sondear, sin entrar en node_modules
      ...(process.env.WSL_DISTRO_NAME && { usePolling: true, interval: 300, followSymlinks: false }),
    },
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), nodeModules] },
  },
});
