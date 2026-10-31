import { en } from "./en";
import { es, type Messages } from "./es";

export type Lang = "es" | "en";
export type Page = "index" | "volatility" | "cycles" | "valuation" | "drawdown" | "categories" | "etf" | "liquidity" | "analysis";

/** El español en la raíz y el inglés bajo /en/, cada página con su index.html (vite.config.ts) */
export const PAGE_PATH: Record<Page, Record<Lang, string>> = {
  index: { es: "/", en: "/en/" },
  volatility: { es: "/volatilidad/", en: "/en/volatility/" },
  cycles: { es: "/ciclos/", en: "/en/cycles/" },
  valuation: { es: "/valoracion/", en: "/en/valuation/" },
  drawdown: { es: "/caidas/", en: "/en/drawdown/" },
  categories: { es: "/categorias/", en: "/en/categories/" },
  etf: { es: "/etf/", en: "/en/etf/" },
  liquidity: { es: "/liquidez/", en: "/en/liquidity/" },
  analysis: { es: "/analisis/", en: "/en/analysis/" },
};
const PREF_KEY = "isbtccheap:lang";

// El idioma lo fija la URL: cambiar de idioma es navegar a la otra ruta
export const lang: Lang = /^\/en(\/|$)/.test(window.location.pathname) ? "en" : "es";
export const t: Messages = lang === "en" ? en : es;
export const locale = lang === "en" ? "en-US" : "es-ES";
const path = window.location.pathname.replace(/\/?$/, "/");
export const page: Page = (Object.keys(PAGE_PATH) as Page[]).find((p) => p !== "index" && Object.values(PAGE_PATH[p]).includes(path)) ?? "index";

/** Etiqueta traducida de la escala por su posición (mismo orden que LABELS del pipeline) */
export const labelAt = (index: number, fallback: string) => t.labels[index] ?? fallback;

export function savePref(l: Lang) {
  try {
    localStorage.setItem(PREF_KEY, l);
  } catch {
    /* almacenamiento no disponible: no pasa nada */
  }
}

/**
 * Lleva de una página en español a la inglesa a quien no tiene el navegador en español, salvo que ya eligiera idioma.
 * Las páginas en inglés nunca redirigen. Devuelve true si redirige.
 */
export function redirectToPreferredLang(): boolean {
  if (lang !== "es") return false;
  let pref: string | null = null;
  try {
    pref = localStorage.getItem(PREF_KEY);
  } catch {
    /* sin almacenamiento: se decide por el navegador */
  }
  // Los buscadores deben indexar cada idioma en su URL
  const bot = navigator.webdriver || /bot|crawl|spider|slurp|preview/i.test(navigator.userAgent);
  const browserEs = (navigator.languages?.length ? navigator.languages : [navigator.language]).some((l) => l.toLowerCase().startsWith("es"));
  const target = pref === "en" || (!pref && !bot && !browserEs) ? "en" : null;
  if (!target) return false;
  window.location.replace(PAGE_PATH[page][target] + window.location.search + window.location.hash);
  return true;
}
