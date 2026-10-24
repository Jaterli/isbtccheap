import type { Candle, Category, CategoryId, History, Latest, MetricScore, Timeframe } from "../types";
import { bollingerPctB, clamp, percentileOfLast, rsi, sma } from "./indicators";

// Media del precio frente a la que se mide la distancia. En mensual, 200 velas serían 16 años: se usan 48
// (4 años, un ciclo de halving, como la media de 200 semanas)
const MA_PERIOD: Partial<Record<Timeframe, { period: number; id: string }>> = { "1M": { period: 48, id: "ma48_ratio" } };

/** Categoría "técnico" recalculada con las velas de la temporalidad elegida. */
export function technicalFromCandles(candles: Candle[], tf: Timeframe): Category {
  const closes = candles.map((c) => c.close);
  const { period, id } = MA_PERIOD[tf] ?? { period: 200, id: "ma200_ratio" };
  const ma = sma(closes, period);
  const ratios = closes.flatMap((c, i) => (ma[i] ? [c / ma[i]!] : []));

  const r = rsi(closes);
  const b = bollingerPctB(closes);
  const p = percentileOfLast(ratios);

  const metrics: MetricScore[] = [
    // RSI 30 → 0, 70 → 100: usado en bruto apenas salía de 30-70 y aplanaba el score
    { id: "rsi_14", name: "RSI 14", value: r, score: r === null ? null : clamp(((r - 30) / 40) * 100) },
    { id: "bollinger", name: "Bollinger %B (20, 2)", value: b, score: b === null ? null : clamp(b) },
    { id, name: `Precio / MA${period} (percentil)`, value: ratios.at(-1) ?? null, score: p },
  ];
  return { name: "Técnico", score: mean(metrics.map((m) => m.score)), metrics };
}

/**
 * Velas mensuales de Binance (desde 2017) completadas con las del histórico diario (desde 2011) para los meses
 * anteriores: con solo las de Binance habría pocas para la media de 48 y su percentil.
 */
export function withMonthlyHistory(binance: Candle[], history: History | null): Candle[] {
  if (!history || !binance.length) return binance;
  const first = binance[0].time;
  const months = new Map<string, Candle>();
  history.dates.forEach((d, i) => {
    const p = history.price[i];
    const key = d.slice(0, 7);
    const c = months.get(key);
    if (c) {
      c.high = Math.max(c.high, p);
      c.low = Math.min(c.low, p);
      c.close = p;
    } else {
      months.set(key, { time: Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, 1), open: p, high: p, low: p, close: p });
    }
  });
  return [...[...months.values()].filter((c) => c.time < first), ...binance];
}

/** Funding neutro ≈ 0,01 %/8 h. Cada +0,04 % sobre el neutro suma 50 puntos. */
export function fundingScore(rate: number): number {
  return clamp(50 + ((rate - 0.0001) / 0.0004) * 50);
}

export interface ScoreResult {
  score: number | null;
  categories: Record<CategoryId, Category>;
  weights: Record<CategoryId, number>;
}

export function computeScore(
  latest: Latest,
  tf: Timeframe,
  technical: Category | null,
  funding: number | null,
): ScoreResult {
  const categories = { ...latest.categories };
  if (technical) categories.tecnico = technical;

  if (funding !== null) {
    const sent = latest.categories.sentimiento;
    const metrics = [
      ...sent.metrics,
      { id: "funding", name: "Funding rate perpetuos (Binance)", value: funding, score: fundingScore(funding) },
    ];
    categories.sentimiento = { ...sent, metrics, score: mean(metrics.map((m) => m.score)) };
  }

  // Hasta que el pipeline publique los pesos de una temporalidad nueva, se usan los de 1 semana
  const weights = latest.weights[tf] ?? latest.weights["1w"];
  let total = 0;
  let acc = 0;
  for (const [id, w] of Object.entries(weights) as [CategoryId, number][]) {
    const s = categories[id]?.score;
    if (s === null || s === undefined) continue;
    acc += s * w;
    total += w;
  }
  return { score: total ? 1 + stretch(acc / total, latest.stretch ?? 0) * 0.99 : null, categories, weights };
}

/** Igual que scoring.stretch del pipeline: contrarresta la compresión hacia 50 de la media. */
function stretch(x: number, k: number): number {
  return k ? 50 + (50 * Math.tanh((k * (x - 50)) / 50)) / Math.tanh(k) : x;
}

/** Posición del tramo de la escala en que cae el score (la etiqueta se traduce por posición) */
export function labelIndex(score: number, labels: Latest["labels"]): number {
  const i = labels.findIndex((l) => score <= l.max);
  return i === -1 ? labels.length - 1 : i;
}

function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
