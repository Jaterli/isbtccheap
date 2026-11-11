import type { Candle, Category, CategoryId, History, Latest, MetricScore, Timeframe } from "../types";
import type { Derivatives } from "./binance";
import { bollingerPctB, clamp, percentileOfLast, rsi, sma } from "./indicators";

// En mensual, 200 velas serían 16 años: se usan 48 (un ciclo de halving)
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
    // RSI 30 → 0, 70 → 100: en bruto apenas sale de 30-70
    { id: "rsi_14", name: "RSI 14", value: r, score: r === null ? null : clamp(((r - 30) / 40) * 100) },
    { id: "bollinger", name: "Bollinger %B (20, 2)", value: b, score: b === null ? null : clamp(b) },
    { id, name: `Precio frente a MA${period} (percentil)`, value: ratios.at(-1) ?? null, score: p },
  ];
  return { name: "Técnico", score: mean(metrics.map((m) => m.score)), metrics };
}

/** Inicio (UTC) de la vela semanal (lunes, como Binance) o mensual que contiene el día `d` (AAAA-MM-DD). */
function candleStart(d: string, tf: "1w" | "1M") {
  const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, tf === "1M" ? 1 : +d.slice(8, 10));
  return tf === "1M" ? t : t - ((new Date(t).getUTCDay() + 6) % 7) * 86_400_000;
}

/**
 * Velas semanales o mensuales de Binance (desde 2017) completadas con el histórico diario (desde 2011): así la media de
 * 200 semanas o de 48 meses y su percentil cubren varios ciclos, como en el diario.
 */
export function withHistory(binance: Candle[], history: History | null, tf: "1w" | "1M"): Candle[] {
  if (!history || !binance.length) return binance;
  const first = binance[0].time;
  const candles = new Map<number, Candle>();
  history.dates.forEach((d, i) => {
    const p = history.price[i];
    const key = candleStart(d, tf);
    const c = candles.get(key);
    if (c) {
      c.high = Math.max(c.high, p);
      c.low = Math.min(c.low, p);
      c.close = p;
    } else {
      candles.set(key, { time: key, open: p, high: p, low: p, close: p });
    }
  });
  return [...[...candles.values()].filter((c) => c.time < first), ...binance];
}

/** En 1 h y 4 h el sentimiento sale de los derivados: las métricas diarias apenas cambian a ese ritmo */
export const DERIVATIVES_TFS: Timeframe[] = ["1h", "4h"];

/**
 * Percentil del último valor de cada serie frente a los últimos 30 días. Alto = más apalancamiento, más largos o más
 * compras agresivas que de costumbre (mercado recalentado, suma al score).
 */
export function derivativesMetrics(d: Derivatives): MetricScore[] {
  // Ratios como parte del total (50 % = equilibrio): misma ordenación, el percentil no cambia
  const share = (r: number) => r / (1 + r);
  const longs = d.longShort.map(share);
  // Una sola vela es muy ruidosa: media de las 3 últimas
  const buys = d.takerRatio
    .map((_, i, xs) => (i < 2 ? null : share((xs[i] + xs[i - 1] + xs[i - 2]) / 3)))
    .filter((x): x is number => x !== null);
  return [
    { id: "open_interest", name: "Open interest", value: d.openInterest.at(-1) ?? null, score: percentileOfLast(d.openInterest) },
    { id: "long_short", name: "Cuentas en largo", value: longs.at(-1) ?? null, score: percentileOfLast(longs) },
    { id: "taker_ratio", name: "Compras a mercado", value: buys.at(-1) ?? null, score: percentileOfLast(buys) },
  ];
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
  /** Solo en 1 h y 4 h; null si Binance no respondió (se quedan las métricas diarias) */
  derivatives: MetricScore[] | null = null,
): ScoreResult {
  const categories = { ...latest.categories };
  if (technical) categories.tecnico = technical;

  // Sin funding desde el 11 nov 2026: casi siempre en el 0,01 % neutro (puntuación 29-50 de mayo a noviembre), sin
  // relación con el precio, arrastraba la categoría hacia 44; y el pipeline calibra el índice diario sin él
  if (derivatives) {
    const sent = latest.categories.sentimiento;
    categories.sentimiento = { ...sent, metrics: derivatives, score: mean(derivatives.map((m) => m.score)) };
  }

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

/** Igual que scoring.stretch del pipeline. */
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
