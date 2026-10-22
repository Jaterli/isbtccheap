import type { Candle, Category, CategoryId, Latest, MetricScore, Timeframe } from "../types";
import { bollingerPctB, clamp, percentileOfLast, rsi, sma } from "./indicators";

/** Categoría "técnico" recalculada con las velas de la temporalidad elegida. */
export function technicalFromCandles(candles: Candle[]): Category {
  const closes = candles.map((c) => c.close);
  const ma = sma(closes, 200);
  const ratios = closes.flatMap((c, i) => (ma[i] ? [c / ma[i]!] : []));

  const r = rsi(closes);
  const b = bollingerPctB(closes);
  const p = percentileOfLast(ratios);

  const metrics: MetricScore[] = [
    { id: "rsi_14", name: "RSI 14", value: r, score: r === null ? null : clamp(r) },
    { id: "bollinger", name: "Bollinger %B (20, 2)", value: b, score: b === null ? null : clamp(b) },
    { id: "ma200_ratio", name: "Precio / MA200 (percentil)", value: ratios.at(-1) ?? null, score: p },
  ];
  return { name: "Técnico", score: mean(metrics.map((m) => m.score)), metrics };
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

  const weights = latest.weights[tf];
  let total = 0;
  let acc = 0;
  for (const [id, w] of Object.entries(weights) as [CategoryId, number][]) {
    const s = categories[id]?.score;
    if (s === null || s === undefined) continue;
    acc += s * w;
    total += w;
  }
  return { score: total ? 1 + (acc / total) * 0.99 : null, categories, weights };
}

export function labelFor(score: number, labels: Latest["labels"]): string {
  return labels.find((l) => score <= l.max)?.label ?? labels[labels.length - 1].label;
}

function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
