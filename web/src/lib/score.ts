import type { Candle, Category, CategoryId, History, Latest, MetricScore, Timeframe } from "../types";
import type { Derivatives } from "./binance";
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

/**
 * Temporalidades en las que el sentimiento sale de los derivados: el Fear & Greed es diario y en 1 h o 4 h
 * apenas cambia, mientras que el apalancamiento y el flujo de órdenes sí se mueven a ese ritmo
 */
export const DERIVATIVES_TFS: Timeframe[] = ["1h", "4h"];

/**
 * Sentimiento de los derivados: cada serie se puntúa por el percentil de su último valor frente a los últimos
 * 30 días. Alto = más apalancamiento, más cuentas en largo o más compras agresivas que de costumbre (mercado
 * recalentado, suma al score); bajo = desapalancamiento y pesimismo (resta).
 */
export function derivativesMetrics(d: Derivatives): MetricScore[] {
  // Los ratios (largos / cortos, compras / ventas) se muestran como parte del total, con el 50 % como equilibrio:
  // r / (1 + r). Es la misma ordenación, así que el percentil no cambia
  const share = (r: number) => r / (1 + r);
  const longs = d.longShort.map(share);
  // El ratio de compras/ventas de una sola vela es muy ruidoso: se usa la media de las 3 últimas
  const buys = d.takerRatio
    .map((_, i, xs) => (i < 2 ? null : share((xs[i] + xs[i - 1] + xs[i - 2]) / 3)))
    .filter((x): x is number => x !== null);
  return [
    { id: "open_interest", name: "Open interest", value: d.openInterest.at(-1) ?? null, score: percentileOfLast(d.openInterest) },
    { id: "long_short", name: "Cuentas en largo", value: longs.at(-1) ?? null, score: percentileOfLast(longs) },
    { id: "taker_ratio", name: "Compras a mercado", value: buys.at(-1) ?? null, score: percentileOfLast(buys) },
  ];
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
  /** Métricas de derivados en 1 h y 4 h; null en el resto o si Binance no respondió (se usa el Fear & Greed) */
  derivatives: MetricScore[] | null = null,
): ScoreResult {
  const categories = { ...latest.categories };
  if (technical) categories.tecnico = technical;

  if (derivatives || funding !== null) {
    const sent = latest.categories.sentimiento;
    const metrics = [
      ...(derivatives ?? sent.metrics),
      ...(funding !== null ? [{ id: "funding", name: "Funding rate perpetuos (Binance)", value: funding, score: fundingScore(funding) }] : []),
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
