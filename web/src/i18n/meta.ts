/** Metadatos del index.html de cada idioma. Los usa vite.config.ts al compilar (rellena los __CLAVE__ del HTML). */
export interface PageMeta {
  LANG: string;
  OG_LOCALE: string;
  URL: string;
  TITLE: string;
  DESCRIPTION: string;
  /** Imagen para redes sociales, 1200×630 (se genera con web/og/og-image.html) */
  OG_IMAGE: string;
  OG_IMAGE_ALT: string;
}

export const META: Record<"es" | "en", PageMeta> = {
  es: {
    LANG: "es",
    OG_LOCALE: "es_ES",
    URL: "https://isbtccheap.com/",
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
    URL: "https://isbtccheap.com/en/",
    OG_IMAGE: "https://isbtccheap.com/og-en.png",
    OG_IMAGE_ALT: "Is BTC Cheap?: Is Bitcoin cheap or expensive? 1 to 100 index",
    TITLE: "Is Bitcoin cheap or expensive today? 1–100 index | Is BTC Cheap?",
    DESCRIPTION:
      "A 1 to 100 index that estimates whether Bitcoin is cheap or expensive by combining on-chain valuation, cycles, liquidity, sentiment and technical analysis.",
  },
};
