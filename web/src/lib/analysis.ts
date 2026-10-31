/** analysis.json de news/build_analysis.py (Gemini, dos veces al día): zonas, sesgo y movimiento más probable */
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
  /** Lo más probable en las próximas horas y qué lo invalidaría */
  outlook: string;
  technical: string[];
  sentiment: string[];
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
  alternative: { direction: Direction; target: number };
  es: AnalysisText;
  en: AnalysisText;
}

export const ANALYSIS_URL = `${import.meta.env.BASE_URL}news/analysis.json`;
