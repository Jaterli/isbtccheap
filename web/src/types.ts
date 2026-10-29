export type Timeframe = "1h" | "4h" | "1d" | "1w" | "1M";

export const TIMEFRAMES: Timeframe[] = ["1h", "4h", "1d", "1w", "1M"];

export type CategoryId = "valoracion" | "ciclo" | "liquidez" | "sentimiento" | "tecnico";

export interface MetricScore {
  id: string;
  name: string;
  value: number | null;
  score: number | null;
}

export interface Category {
  name: string;
  score: number | null;
  metrics: MetricScore[];
}

/** Salida del pipeline diario (web/public/data/latest.json) */
export interface Latest {
  updated_at: string;
  as_of: string;
  price: number;
  score_1d: number | null;
  categories: Record<CategoryId, Category>;
  weights: Record<Timeframe, Record<CategoryId, number>>;
  /** SCORE_STRETCH de pipeline/config.py */
  stretch?: number;
  labels: { max: number; label: string }[];
  missing_sources: string[];
  attribution: { name: string; url: string; license?: string }[];
  /** Fase actual: [fecha del cambio, 1 alcista o -1 bajista]; ausente en ficheros anteriores */
  phase?: { trend: [string, 1 | -1]; liquidity: [string, 1 | -1] | null } | null;
}

export interface History {
  dates: string[];
  price: number[];
  score: number[];
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
