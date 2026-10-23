/** Metadatos del index.html de cada idioma. Los usa vite.config.ts al compilar (rellena los __CLAVE__ del HTML). */
export interface PageMeta {
  LANG: string;
  OG_LOCALE: string;
  URL: string;
  TITLE: string;
  DESCRIPTION: string;
}

export const META: Record<"es" | "en", PageMeta> = {
  es: {
    LANG: "es",
    OG_LOCALE: "es_ES",
    URL: "https://isbtccheap.com/",
    TITLE: "Is BTC Cheap? · ¿Está Bitcoin barato o caro?",
    DESCRIPTION:
      "Índice de 1 a 100 que estima si Bitcoin está barato o caro combinando valoración on-chain, ciclos, liquidez, sentimiento y análisis técnico.",
  },
  en: {
    LANG: "en",
    OG_LOCALE: "en_US",
    URL: "https://isbtccheap.com/en/",
    TITLE: "Is BTC Cheap? · Is Bitcoin cheap or expensive?",
    DESCRIPTION:
      "A 1 to 100 index that estimates whether Bitcoin is cheap or expensive by combining on-chain valuation, cycles, liquidity, sentiment and technical analysis.",
  },
};
