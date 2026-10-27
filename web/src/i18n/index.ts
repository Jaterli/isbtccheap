import { en } from "./en";
import { es, type Messages } from "./es";

export type Lang = "es" | "en";
export type Page = "index" | "volatility" | "cycles" | "valuation" | "drawdown";

/** Ruta de cada página en cada idioma: el español en la raíz y el inglés bajo /en/ (cada una con su index.html, ver
 * vite.config.ts) */
export const PAGE_PATH: Record<Page, Record<Lang, string>> = {
  index: { es: "/", en: "/en/" },
  volatility: { es: "/volatilidad/", en: "/en/volatility/" },
  cycles: { es: "/ciclos/", en: "/en/cycles/" },
  valuation: { es: "/valoracion/", en: "/en/valuation/" },
  drawdown: { es: "/caidas/", en: "/en/drawdown/" },
};
const PREF_KEY = "isbtccheap:lang";

// El idioma lo fija la URL: cambiar de idioma es navegar a la otra ruta, así que basta con leerlo al cargar
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
 * En una página en español, la primera vez, lleva a su versión en inglés a quien no tiene el navegador en español; si
 * ya eligió idioma con el selector, respeta su elección. Devuelve true si redirige (no hace falta pintar la página).
 * Las páginas en inglés nunca redirigen: un enlace a la versión en inglés siempre abre en inglés.
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
