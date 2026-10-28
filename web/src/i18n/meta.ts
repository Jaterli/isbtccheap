/** Metadatos de cada index.html, que vite.config.ts rellena al compilar (__CLAVE__). Sin dependencias del navegador. */
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
const CATEGORIES = { URL_ES: `${SITE}/categorias/`, URL_EN: `${SITE}/en/categories/` };
const ETF = { URL_ES: `${SITE}/etf/`, URL_EN: `${SITE}/en/etf/` };
const LIQUIDITY = { URL_ES: `${SITE}/liquidez/`, URL_EN: `${SITE}/en/liquidity/` };

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
    TITLE: "Caídas y subidas de Bitcoin: caída desde máximos y drawdown | Is BTC Cheap?",
    DESCRIPTION:
      "Cuánto está Bitcoin por debajo de su máximo histórico, comparado con las grandes caídas de 2011, 2014, 2018 y 2022, y cuántos días lleva sin caer o subir un 5 %, 10 %, 20 % o 30 %.",
  },
  en: {
    ...INDEX_META.en,
    ...DRAWDOWN,
    URL: DRAWDOWN.URL_EN,
    TITLE: "Bitcoin drops and rallies: drawdown from all-time high | Is BTC Cheap?",
    DESCRIPTION:
      "How far Bitcoin is below its all-time high, compared with the major drops of 2011, 2014, 2018 and 2022, and how many days it has gone without a 5%, 10%, 20% or 30% drop or rally.",
  },
};

const CATEGORIES_META: Record<"es" | "en", PageMeta> = {
  es: {
    ...INDEX_META.es,
    ...CATEGORIES,
    URL: CATEGORIES.URL_ES,
    TITLE: "Histórico del índice de Bitcoin por categorías | Is BTC Cheap?",
    DESCRIPTION:
      "Mapa de calor con la evolución desde 2011 de la valoración on-chain, el ciclo, la liquidez, el sentimiento y el técnico de Bitcoin, y lo que marcaban en cada techo y suelo de ciclo.",
  },
  en: {
    ...INDEX_META.en,
    ...CATEGORIES,
    URL: CATEGORIES.URL_EN,
    TITLE: "Bitcoin index history by category | Is BTC Cheap?",
    DESCRIPTION:
      "Heatmap of Bitcoin's on-chain valuation, cycle, liquidity, sentiment and technical scores since 2011, and what they showed at each cycle top and bottom.",
  },
};

const ETF_META: Record<"es" | "en", PageMeta> = {
  es: {
    ...INDEX_META.es,
    ...ETF,
    URL: ETF.URL_ES,
    TITLE: "Flujos de los ETF de Bitcoin hoy: entradas y salidas diarias | Is BTC Cheap?",
    DESCRIPTION:
      "Entradas y salidas diarias de los ETF de bitcoin al contado de EE. UU. frente al precio de BTC, con el acumulado desde 2024 y el desglose por fondo: IBIT, FBTC, GBTC y el resto.",
  },
  en: {
    ...INDEX_META.en,
    ...ETF,
    URL: ETF.URL_EN,
    TITLE: "Bitcoin ETF flows today: daily inflows and outflows | Is BTC Cheap?",
    DESCRIPTION:
      "Daily inflows and outflows of US spot bitcoin ETFs against the BTC price, with cumulative flows since 2024 and a per-fund breakdown: IBIT, FBTC, GBTC and the rest.",
  },
};

const LIQUIDITY_META: Record<"es" | "en", PageMeta> = {
  es: {
    ...INDEX_META.es,
    ...LIQUIDITY,
    URL: LIQUIDITY.URL_ES,
    TITLE: "Liquidez neta de la Fed y Bitcoin: ¿anticipa el precio? | Is BTC Cheap?",
    DESCRIPTION:
      "Variación en 13 semanas de la liquidez neta de la Reserva Federal (balance menos cuenta del Tesoro y repos inversos) frente al precio de Bitcoin 13 semanas después, desde 2011.",
  },
  en: {
    ...INDEX_META.en,
    ...LIQUIDITY,
    URL: LIQUIDITY.URL_EN,
    TITLE: "Fed net liquidity and Bitcoin: does it lead the price? | Is BTC Cheap?",
    DESCRIPTION:
      "13-week change in Federal Reserve net liquidity (balance sheet minus Treasury account and reverse repos) against the Bitcoin price 13 weeks later, since 2011.",
  },
};

export const META = {
  index: INDEX_META,
  volatility: VOLATILITY_META,
  cycles: CYCLES_META,
  valuation: VALUATION_META,
  drawdown: DRAWDOWN_META,
  categories: CATEGORIES_META,
  etf: ETF_META,
  liquidity: LIQUIDITY_META,
};
