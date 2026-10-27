/** Metadatos del index.html de cada página e idioma. Los usa vite.config.ts al compilar (rellena los __CLAVE__ del
 * HTML). Sin dependencias del navegador: se importa desde vite.config.ts */
export interface PageMeta {
  LANG: string;
  OG_LOCALE: string;
  URL: string;
  /** URL de la misma página en cada idioma (hreflang) */
  URL_ES: string;
  URL_EN: string;
  TITLE: string;
  DESCRIPTION: string;
  /** Imagen para redes sociales, 1200×630 (se genera con web/og/og-image.html) */
  OG_IMAGE: string;
  OG_IMAGE_ALT: string;
}

const SITE = "https://isbtccheap.com";
const INDEX = { URL_ES: `${SITE}/`, URL_EN: `${SITE}/en/` };
const VOLATILITY = { URL_ES: `${SITE}/volatilidad/`, URL_EN: `${SITE}/en/volatility/` };

const INDEX_META: Record<"es" | "en", PageMeta> = {
  es: {
    LANG: "es",
    OG_LOCALE: "es_ES",
    ...INDEX,
    URL: INDEX.URL_ES,
    OG_IMAGE: "https://isbtccheap.com/og-es.png",
    OG_IMAGE_ALT: "Is BTC Cheap?: ¿Está Bitcoin barato o caro? Índice de 1 a 100",
    // La búsqueda primero y la marca al final: Google da más peso al principio del título
    TITLE: "¿Está Bitcoin barato o caro hoy? Índice de 1 a 100 | Is BTC Cheap?",
    DESCRIPTION:
      "Índice de 1 a 100 que estima si Bitcoin está barato o caro combinando valoración on-chain, ciclos, liquidez, sentimiento y análisis técnico.",
  },
  en: {
    LANG: "en",
    OG_LOCALE: "en_US",
    ...INDEX,
    URL: INDEX.URL_EN,
    OG_IMAGE: "https://isbtccheap.com/og-en.png",
    OG_IMAGE_ALT: "Is BTC Cheap?: Is Bitcoin cheap or expensive? 1 to 100 index",
    TITLE: "Is Bitcoin cheap or expensive today? 1–100 index | Is BTC Cheap?",
    DESCRIPTION:
      "A 1 to 100 index that estimates whether Bitcoin is cheap or expensive by combining on-chain valuation, cycles, liquidity, sentiment and technical analysis.",
  },
};

const VOLATILITY_META: Record<"es" | "en", PageMeta> = {
  es: {
    ...INDEX_META.es,
    ...VOLATILITY,
    URL: VOLATILITY.URL_ES,
    TITLE: "Volatilidad de Bitcoin hoy: gráfico por temporalidad | Is BTC Cheap?",
    DESCRIPTION:
      "Volatilidad realizada de Bitcoin en velas de 1 hora, 4 horas, 1 día y 1 semana, con el precio de BTC superpuesto y el histórico desde 2011.",
  },
  en: {
    ...INDEX_META.en,
    ...VOLATILITY,
    URL: VOLATILITY.URL_EN,
    TITLE: "Bitcoin volatility today: chart by timeframe | Is BTC Cheap?",
    DESCRIPTION:
      "Bitcoin's realized volatility on 1-hour, 4-hour, 1-day and 1-week candles, with the BTC price overlaid and history since 2011.",
  },
};

/** Por página: la principal (index.html) y la de volatilidad (volatilidad/index.html) */
export const META = { index: INDEX_META, volatility: VOLATILITY_META };
