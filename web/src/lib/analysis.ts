/** analysis.json de news/build_analysis.py (cron del droplet, dos veces al día) */
export interface Level {
  id: string;
  kind: "support" | "resistance";
  low: number;
  high: number;
  mid: number;
  /** Suma de los pesos de las referencias que coinciden en la zona */
  strength: number;
  sources: string[];
}

export interface Scenario {
  trigger: string;
  /** null si no hay una zona más allá del disparador */
  target: string | null;
}

export interface AnalysisText {
  headline: string;
  summary: string;
  technical: string[];
  sentiment: string[];
}

export interface Analysis {
  generated_at: string;
  model: string;
  price: number;
  atr_1d: number;
  levels: Level[];
  bias: "alcista" | "bajista" | "neutral";
  confidence: 1 | 2 | 3;
  key_supports: string[];
  key_resistances: string[];
  bull: Scenario;
  bear: Scenario;
  primary: "bull" | "bear";
  es: AnalysisText;
  en: AnalysisText;
}

export const ANALYSIS_URL = `${import.meta.env.BASE_URL}news/analysis.json`;

export const levelById = (a: Analysis, id: string | null) => (id ? (a.levels.find((l) => l.id === id) ?? null) : null);

/** Precio al que apunta un escenario: la zona objetivo o, si no la hay, un ATR diario más allá del disparador. */
export function scenarioPrices(a: Analysis, side: "bull" | "bear") {
  const s = a[side];
  const trigger = levelById(a, s.trigger);
  if (!trigger) return null;
  const target = levelById(a, s.target);
  const sign = side === "bull" ? 1 : -1;
  return { trigger: trigger.mid, target: target ? target.mid : trigger.mid + sign * a.atr_1d };
}
