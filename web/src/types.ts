export type Timeframe = "15m" | "1h" | "4h" | "1d" | "1w";

export const TIMEFRAMES: { id: Timeframe; label: string; short: string }[] = [
  { id: "15m", label: "15 minutos", short: "15 min" },
  { id: "1h", label: "1 hora", short: "1 h" },
  { id: "4h", label: "4 horas", short: "4 h" },
  { id: "1d", label: "1 día", short: "1 día" },
  { id: "1w", label: "1 semana", short: "1 sem" },
];

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
  /** Factor k del estirado final (ver pipeline/config.py → SCORE_STRETCH) */
  stretch?: number;
  labels: { max: number; label: string }[];
  missing_sources: string[];
  attribution: { name: string; url: string; license?: string }[];
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
