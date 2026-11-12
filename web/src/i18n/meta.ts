import { LEGAL, type LegalPage } from "./legal";

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
const LIQUIDITY = { URL_ES: `${SITE}/liquidez/`, URL_EN: `${SITE}/en/liquidity/` };
const SENTIMENT = { URL_ES: `${SITE}/sentimiento/`, URL_EN: `${SITE}/en/sentiment/` };
const TECHNICAL = { URL_ES: `${SITE}/tecnico/`, URL_EN: `${SITE}/en/technical/` };
const ANALYSIS = { URL_ES: `${SITE}/analisis/`, URL_EN: `${SITE}/en/analysis/` };

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
      "Cuánto está Bitcoin por debajo de su máximo histórico, comparado con las grandes caídas de 2011, 2014, 2018 y 2022, y cuántos días lleva sin caer o subir un 5 %, 10 %, 20 % o 30 %.",
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


const LIQUIDITY_META: Record<"es" | "en", PageMeta> = {
  es: {
    ...INDEX_META.es,
    ...LIQUIDITY,
    URL: LIQUIDITY.URL_ES,
    TITLE: "Liquidez global y Bitcoin: ¿anticipa el precio? | Is BTC Cheap?",
    DESCRIPTION:
      "Variación en 13 semanas de la liquidez global (Fed, BCE y Banco de Japón), adelantada 13 semanas, frente al precio de Bitcoin, desde 2011.",
  },
  en: {
    ...INDEX_META.en,
    ...LIQUIDITY,
    URL: LIQUIDITY.URL_EN,
    TITLE: "Global liquidity and Bitcoin: does it lead the price? | Is BTC Cheap?",
    DESCRIPTION:
      "13-week change in global liquidity (Fed, ECB and Bank of Japan), shifted 13 weeks forward, against the Bitcoin price, since 2011.",
  },
};

const ANALYSIS_META: Record<"es" | "en", PageMeta> = {
  es: {
    ...INDEX_META.es,
    ...ANALYSIS,
    URL: ANALYSIS.URL_ES,
    TITLE: "Análisis de Bitcoin hoy: soportes, resistencias y sesgo | Is BTC Cheap?",
    DESCRIPTION:
      "Análisis diario del precio de Bitcoin con IA: soportes y resistencias inmediatos, sesgo del mercado y lo más probable en las próximas horas, sobre el gráfico de BTC.",
  },
  en: {
    ...INDEX_META.en,
    ...ANALYSIS,
    URL: ANALYSIS.URL_EN,
    TITLE: "Bitcoin analysis today: support, resistance and bias | Is BTC Cheap?",
    DESCRIPTION:
      "Daily AI analysis of the Bitcoin price: immediate support and resistance, market bias and what is most likely over the next hours, on the BTC chart.",
  },
};

const LEGAL_PATHS = {
  legal: { URL_ES: `${SITE}/aviso-legal/`, URL_EN: `${SITE}/en/legal-notice/` },
  privacy: { URL_ES: `${SITE}/privacidad/`, URL_EN: `${SITE}/en/privacy/` },
  cookies: { URL_ES: `${SITE}/cookies/`, URL_EN: `${SITE}/en/cookies/` },
};

/** Aviso legal, privacidad y cookies (noindex): el título sale de i18n/legal.ts */
const legalMeta = (p: LegalPage): Record<"es" | "en", PageMeta> => ({
  es: {
    ...INDEX_META.es,
    ...LEGAL_PATHS[p],
    URL: LEGAL_PATHS[p].URL_ES,
    TITLE: `${LEGAL[p].es.title} | Is BTC Cheap?`,
    DESCRIPTION: LEGAL[p].es.rest,
  },
  en: {
    ...INDEX_META.en,
    ...LEGAL_PATHS[p],
    URL: LEGAL_PATHS[p].URL_EN,
    TITLE: `${LEGAL[p].en.title} | Is BTC Cheap?`,
    DESCRIPTION: LEGAL[p].en.rest,
  },
});

const SENTIMENT_META: Record<"es" | "en", PageMeta> = {
  es: {
    ...INDEX_META.es,
    ...SENTIMENT,
    URL: SENTIMENT.URL_ES,
    TITLE: "Sentimiento de Bitcoin: Fear & Greed, SOPR y flujos de ETF | Is BTC Cheap?",
    DESCRIPTION:
      "El precio de Bitcoin frente al Fear & Greed Index, el SOPR de corto plazo, los flujos de los ETF, el open interest, las cuentas en largo y las compras a mercado, en 1 hora, 4 horas y 1 día.",
  },
  en: {
    ...INDEX_META.en,
    ...SENTIMENT,
    URL: SENTIMENT.URL_EN,
    TITLE: "Bitcoin sentiment: Fear & Greed, SOPR and ETF flows | Is BTC Cheap?",
    DESCRIPTION:
      "The Bitcoin price against the Fear & Greed Index, short-term SOPR, ETF flows, open interest, accounts long and market buys, in 1 hour, 4 hours and 1 day.",
  },
};

const TECHNICAL_META: Record<"es" | "en", PageMeta> = {
  es: {
    ...INDEX_META.es,
    ...TECHNICAL,
    URL: TECHNICAL.URL_ES,
    TITLE: "Análisis técnico de Bitcoin: RSI, Bollinger y media de 200 | Is BTC Cheap?",
    DESCRIPTION:
      "El precio de Bitcoin con la puntuación técnica del índice superpuesta: RSI 14, Bollinger %B y distancia a la media de 200 velas, en 1 hora, 4 horas, 1 día y 1 semana.",
  },
  en: {
    ...INDEX_META.en,
    ...TECHNICAL,
    URL: TECHNICAL.URL_EN,
    TITLE: "Bitcoin technical analysis: RSI, Bollinger and 200 moving average | Is BTC Cheap?",
    DESCRIPTION:
      "The Bitcoin price with the index's technical score overlaid: RSI 14, Bollinger %B and distance to the 200-candle moving average, in 1 hour, 4 hours, 1 day and 1 week.",
  },
};

export const META = {
  index: INDEX_META,
  volatility: VOLATILITY_META,
  cycles: CYCLES_META,
  valuation: VALUATION_META,
  drawdown: DRAWDOWN_META,
  categories: CATEGORIES_META,
  liquidity: LIQUIDITY_META,
  sentiment: SENTIMENT_META,
  technical: TECHNICAL_META,
  analysis: ANALYSIS_META,
  legal: legalMeta("legal"),
  privacy: legalMeta("privacy"),
  cookies: legalMeta("cookies"),
};
