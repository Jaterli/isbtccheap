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
const CYCLES = { URL_ES: `${SITE}/ciclos/`, URL_EN: `${SITE}/en/cycles/` };
const VALUATION = { URL_ES: `${SITE}/valoracion/`, URL_EN: `${SITE}/en/valuation/` };
const DRAWDOWN = { URL_ES: `${SITE}/caidas/`, URL_EN: `${SITE}/en/drawdown/` };

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

const CYCLES_META: Record<"es" | "en", PageMeta> = {
  es: {
    ...INDEX_META.es,
    ...CYCLES,
    URL: CYCLES.URL_ES,
    TITLE: "Ciclos de Bitcoin: comparativa desde cada halving | Is BTC Cheap?",
    DESCRIPTION:
      "Compara el ciclo actual de Bitcoin con los de 2012, 2016 y 2020: precio desde cada halving, cuándo llegó el techo y cuánto cayó después.",
  },
  en: {
    ...INDEX_META.en,
    ...CYCLES,
    URL: CYCLES.URL_EN,
    TITLE: "Bitcoin cycles: comparison since each halving | Is BTC Cheap?",
    DESCRIPTION:
      "Compare Bitcoin's current cycle with those of 2012, 2016 and 2020: price since each halving, when the top came and how far it fell afterwards.",
  },
};

const VALUATION_META: Record<"es" | "en", PageMeta> = {
  es: {
    ...INDEX_META.es,
    ...VALUATION,
    URL: VALUATION.URL_ES,
    TITLE: "Precio realizado, media de 200 semanas y power law de Bitcoin | Is BTC Cheap?",
    DESCRIPTION:
      "El precio de Bitcoin frente a sus niveles de valoración de largo plazo: precio realizado, media de 200 semanas y la tendencia de la power law con su corredor.",
  },
  en: {
    ...INDEX_META.en,
    ...VALUATION,
    URL: VALUATION.URL_EN,
    TITLE: "Bitcoin realized price, 200-week moving average and power law | Is BTC Cheap?",
    DESCRIPTION:
      "Bitcoin's price against its long-term valuation levels: realized price, 200-week moving average and the power law trend with its corridor.",
  },
};

const DRAWDOWN_META: Record<"es" | "en", PageMeta> = {
  es: {
    ...INDEX_META.es,
    ...DRAWDOWN,
    URL: DRAWDOWN.URL_ES,
    TITLE: "Caída de Bitcoin desde máximos: drawdown histórico | Is BTC Cheap?",
    DESCRIPTION:
      "Cuánto está Bitcoin por debajo de su máximo histórico hoy, comparado con las grandes caídas de 2011, 2014, 2018 y 2022: profundidad, duración y tiempo de recuperación.",
  },
  en: {
    ...INDEX_META.en,
    ...DRAWDOWN,
    URL: DRAWDOWN.URL_EN,
    TITLE: "Bitcoin drawdown from all-time high: historical chart | Is BTC Cheap?",
    DESCRIPTION:
      "How far Bitcoin is below its all-time high today, compared with the major drops of 2011, 2014, 2018 and 2022: depth, duration and recovery time.",
  },
};

/** Por página: la principal (index.html) y las de gráficas, cada una en su carpeta (volatilidad/, ciclos/,
 * valoracion/, caidas/) */
export const META = {
  index: INDEX_META,
  volatility: VOLATILITY_META,
  cycles: CYCLES_META,
  valuation: VALUATION_META,
  drawdown: DRAWDOWN_META,
};
