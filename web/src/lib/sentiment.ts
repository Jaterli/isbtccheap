import type { History } from "../types";
import type { HeatmapSeries } from "../components/CategoriesChart";

/** Métricas de sentimiento del índice, en el orden de sus filas */
export const SENTIMENT_METRICS = ["fear_greed", "sth_sopr", "etf_flows"] as const;
export type SentimentMetric = (typeof SENTIMENT_METRICS)[number];
export const SENTIMENT_ROWS = ["sentimiento", ...SENTIMENT_METRICS] as const;

/** sentiment.json del pipeline: mismas fechas que history.json */
export interface SentimentJson {
  start: string;
  /** Puntuación de la categoría de sentimiento (0-100) */
  category: (number | null)[];
  /** Por métrica, su valor y su puntuación (0-100) cada día */
  metrics: Partial<Record<SentimentMetric, { value: (number | null)[]; score: (number | null)[] }>>;
}

/** Puntuaciones (filas del mapa de calor) y, aparte, los valores de cada métrica */
export type SentimentSeries = HeatmapSeries &
  Record<(typeof SENTIMENT_ROWS)[number], (number | null)[]> & { values: Record<SentimentMetric, (number | null)[]> };

/**
 * Une history.json (precio) y sentiment.json, recortados a los días comunes (la caché de GitHub puede servir uno con un
 * día más que el otro) y desde el primer día con alguna métrica de sentimiento.
 */
export function sentimentSeries(h: History, s: SentimentJson): SentimentSeries | null {
  if (h.dates[0] !== s.start) return null;
  const n = Math.min(h.dates.length, s.category.length);
  const first = Math.max(0, s.category.findIndex((v) => v !== null));
  const cut = <T,>(a: T[] | undefined) => (a ?? Array<T | null>(n).fill(null)).slice(first, n) as (T | null)[];
  const values = Object.fromEntries(SENTIMENT_METRICS.map((m) => [m, cut(s.metrics[m]?.value)])) as SentimentSeries["values"];
  return {
    time: h.dates.slice(first, n).map((d) => Date.parse(`${d}T00:00:00Z`)),
    price: h.price.slice(first, n),
    sentimiento: cut(s.category),
    ...Object.fromEntries(SENTIMENT_METRICS.map((m) => [m, cut(s.metrics[m]?.score)])),
    values,
  } as SentimentSeries;
}
