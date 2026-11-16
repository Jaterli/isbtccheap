/** analysis.json de news/build_analysis.py (IA, una vez al día): zonas, sesgo y movimientos más probables */
export interface Level {
  id: string;
  kind: "support" | "resistance";
  low: number;
  high: number;
  mid: number;
  /** 1 (débil) a 3 (fuerte), según el modelo */
  strength: 1 | 2 | 3;
}

export type Direction = "alcista" | "bajista" | "lateral";

export interface AnalysisText {
  headline: string;
  summary: string;
  /** Tendencia de fondo (semanas y meses) y en qué punto está el precio (ausente en análisis anteriores) */
  trend?: string;
  /** Lo más probable en las próximas horas y qué lo invalidaría */
  outlook: string;
  /** Lo mismo a 1-2 días (ausente en análisis anteriores) */
  outlook_days?: string;
  /** Lo que está moviendo el precio, según el modelo */
  points: string[];
}

/** Máximo o mínimo de la estructura que el precio no ha vuelto a superar (liquidez pendiente) */
export interface LiquidityPool {
  side: "above" | "below";
  price: number;
  dates: string[];
  /** Varios máximos o mínimos casi al mismo precio: concentran más órdenes */
  equal_levels: boolean;
}

/** Hueco sin rellenar (fair value gap) */
export interface Imbalance {
  type: "bullish" | "bearish";
  date: string;
  low: number;
  high: number;
}

export type ChartTf = "4h" | "1d";

/** Nivel de Fibonacci del que sale un objetivo o una invalidación (se dibuja como línea, no como zona) */
export interface FibLevel {
  timeframe: "1w" | "1d";
  /** main: el movimiento principal; correction: su corrección (ausente en análisis anteriores: main) */
  leg?: "main" | "correction";
  /** Retroceso o extensión del tramo: "0.5", "0.618", "1.272"… */
  ratio: string;
  price: number;
  /** Día (AAAA-MM-DD) del precio en que empieza el tramo: la línea se dibuja desde ahí (ausente en análisis anteriores) */
  from?: string;
}

export interface Analysis {
  generated_at: string;
  model: string;
  price: number;
  bias: "alcista" | "bajista" | "neutral";
  confidence: 1 | 2 | 3;
  /** Soportes y resistencias, de cada lado del más cercano al más lejano */
  levels: Level[];
  outlook: { direction: Direction; target: number; invalidation: number | null; horizon_hours: number };
  /** Ausente en análisis anteriores */
  outlook_days?: { direction: Direction; target: number; invalidation: number | null };
  alternative: { direction: Direction; target: number };
  es: AnalysisText;
  en: AnalysisText;
  /** Calculado por el script (no por el modelo) en el momento del análisis; ausente en análisis anteriores */
  /** Ausente en análisis anteriores y cuando ningún objetivo sale de Fibonacci */
  fibonacci?: FibLevel[];
  liquidity?: { pools: Partial<Record<ChartTf, LiquidityPool[]>>; imbalances: Partial<Record<ChartTf, Imbalance[]>> };
}

export const ANALYSIS_URL = `${import.meta.env.BASE_URL}news/analysis.json`;

/** trend.json de news/build_analysis.py --weekly: la tendencia de fondo, revisada cada lunes (o antes, si un cierre diario
 * supera uno de sus niveles de revisión) */
export interface Trend {
  generated_at: string;
  price: number;
  direction: Direction;
  confidence: 1 | 2 | 3;
  /** weekly: la revisión de los lunes; close_above / close_below: adelantada por un cierre diario; missing: no había */
  review: { reason: "weekly" | "missing" | "close_above" | "close_below"; date?: string; close?: number; level?: number };
  /** Cierres diarios que la harían revisar */
  review_above: { price: number };
  review_below: { price: number };
  /** Lo más probable en 2-4 semanas y la alternativa (ausentes en las primeras revisiones) */
  outlook?: { direction: Direction; target: number };
  alternative?: { direction: Direction; target: number };
  es: TrendText;
  en: TrendText;
  /** Para el gráfico: máximo histórico (cierre diario) y máximo y mínimo de 12 meses (ausente en la primera revisión) */
  references?: Partial<Record<"all_time_high" | "high_12m" | "low_12m", { price: number; date: string }>>;
}

/** Textos de la tendencia: situación, lo más probable en 2-4 semanas y claves (desde el 17 nov 2026); en las revisiones
 * anteriores, un solo texto (trend) */
export interface TrendText {
  summary?: string;
  outlook?: string;
  points?: string[];
  trend?: string;
}

export const TREND_URL = `${import.meta.env.BASE_URL}news/trend.json`;
