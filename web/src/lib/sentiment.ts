import type { History, Timeframe } from "../types";
import { fetchCandles, fetchDerivativesSeries } from "./binance";
import { percentileOfLast } from "./indicators";

/** Métricas diarias del índice (sentiment.json, del pipeline) */
export const DAILY_METRICS = ["fear_greed", "sth_sopr", "etf_flows"] as const;
/** Derivados de Binance (solo guarda 30 días), en directo desde el navegador */
export const DERIV_METRICS = ["open_interest", "long_pct", "taker_pct"] as const;
export const SENTIMENT_METRICS = [...DAILY_METRICS, ...DERIV_METRICS] as const;
export type DailyMetric = (typeof DAILY_METRICS)[number];
export type SentimentMetric = (typeof SENTIMENT_METRICS)[number];
/** Lo que se puede dibujar: la categoría (media de las métricas de la temporalidad) o una métrica */
export type SentimentKey = "sentimiento" | SentimentMetric;

export const SENTIMENT_TFS = ["1h", "4h", "1d"] as const;
export type SentimentTf = (typeof SENTIMENT_TFS)[number];

/**
 * Las métricas que usa el índice en cada temporalidad (lib/score.ts): en 1 h y 4 h, los derivados; en 1D, las diarias
 * del pipeline.
 */
export const TF_METRICS: Record<SentimentTf, readonly SentimentMetric[]> = {
  "1h": DERIV_METRICS,
  "4h": DERIV_METRICS,
  "1d": DAILY_METRICS,
};

/** sentiment.json del pipeline: mismas fechas que history.json */
export interface SentimentJson {
  start: string;
  /** Puntuación de la categoría de sentimiento (0-100) */
  category: (number | null)[];
  /** Por métrica, su valor y su puntuación (0-100) cada día */
  metrics: Partial<Record<DailyMetric, { value: (number | null)[]; score: (number | null)[] }>>;
}

type Col = (number | null)[];

/** Precio y, en cada vela, el valor y la puntuación (0-100) de cada métrica y la de la categoría */
export interface SentimentSeries {
  time: number[];
  price: number[];
  values: Record<SentimentMetric, Col>;
  scores: Record<SentimentKey, Col>;
}

const HOUR = 3_600_000;
const PERIOD: Record<SentimentTf, number> = { "1h": HOUR, "4h": 4 * HOUR, "1d": 24 * HOUR };
// Velas en 1 h y 4 h: lo que cubren los derivados de Binance (500 puntos en 1 h, 30 días en 4 h)
const INTRADAY_CANDLES: Record<"1h" | "4h", number> = { "1h": 500, "4h": 180 };

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
// Ratios como parte del total: 50 % = equilibrio entre largos y cortos, o entre compras y ventas a mercado
const share = (r: number) => (r / (1 + r)) * 100;
const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** Para cada vela, el último punto de la serie hasta su cierre, si es de esa vela o de la anterior */
function alignTo(time: number[], period: number, pts: { time: number[]; value: Col }): Col {
  const out: Col = [];
  let j = -1;
  for (const t of time) {
    while (j + 1 < pts.time.length && pts.time[j + 1] < t + period) j++;
    out.push(j >= 0 && pts.time[j] >= t - period ? pts.value[j] : null);
  }
  return out;
}

/**
 * Puntuación de cada punto como la del índice en su último punto: percentil frente a los anteriores de la serie descargada
 * (hasta 30 días, como hace el índice con la serie entera), con un mínimo de 50 puntos.
 */
function rollingPercentile(xs: number[]): Col {
  return xs.map((_, i) => percentileOfLast(xs.slice(0, i + 1)));
}

async function derivativeColumns(tf: SentimentTf, time: number[]) {
  const d = await fetchDerivativesSeries(tf as Timeframe);
  const longs = d.longShort.value.map(share);
  // Como el índice: compras a mercado, media de las 3 últimas velas (desde la tercera)
  const buys = d.takerRatio.value.map((_, i, xs) => (i < 2 ? null : share((xs[i] + xs[i - 1] + xs[i - 2]) / 3)));
  const col = (pts: { time: number[] }, v: Col) => alignTo(time, PERIOD[tf], { time: pts.time, value: v });
  return {
    values: { open_interest: col(d.openInterest, d.openInterest.value), long_pct: col(d.longShort, longs), taker_pct: col(d.takerRatio, buys) },
    scores: {
      open_interest: col(d.openInterest, rollingPercentile(d.openInterest.value)),
      long_pct: col(d.longShort, rollingPercentile(longs)),
      taker_pct: col(d.takerRatio, [null, null, ...rollingPercentile(buys.slice(2) as number[])]),
    },
  };
}

/**
 * Serie de la temporalidad, con lo que usa el índice en ella: en 1D, el histórico diario desde 2011 con las métricas del
 * pipeline; en 1 h y 4 h, las velas de Binance que cubren los derivados. Si Binance no responde, los derivados quedan
 * sin datos (null).
 */
export async function loadSentiment(tf: SentimentTf, h: History, s: SentimentJson): Promise<SentimentSeries> {
  let time: number[];
  let price: number[];
  if (tf === "1d") {
    const n = h.dates[0] === s.start ? Math.min(h.dates.length, s.category.length) : h.dates.length;
    time = h.dates.slice(0, n).map((d) => Date.parse(`${d}T00:00:00Z`));
    price = h.price.slice(0, n);
  } else {
    const candles = await fetchCandles(tf, INTRADAY_CANDLES[tf]);
    time = candles.map((c) => c.time);
    price = candles.map((c) => c.close);
  }
  const none = (): Col => time.map(() => null);

  // Diarias: el dato del día de cada vela
  const idx = new Map(h.dates[0] === s.start ? h.dates.map((d, i) => [d, i] as const) : []);
  const at = time.map((t) => idx.get(dayKey(t)));
  const daily = (m: DailyMetric, k: "value" | "score") => at.map((i) => (i === undefined ? null : (s.metrics[m]?.[k][i] ?? null)));

  const derivs = tf === "1d" ? null : await derivativeColumns(tf, time).catch(() => null);

  const values = {
    ...(Object.fromEntries(DAILY_METRICS.map((m) => [m, daily(m, "value")])) as Record<DailyMetric, Col>),
    open_interest: derivs?.values.open_interest ?? none(),
    long_pct: derivs?.values.long_pct ?? none(),
    taker_pct: derivs?.values.taker_pct ?? none(),
  };
  const metricScores = {
    ...(Object.fromEntries(DAILY_METRICS.map((m) => [m, daily(m, "score")])) as Record<DailyMetric, Col>),
    open_interest: derivs?.scores.open_interest ?? none(),
    long_pct: derivs?.scores.long_pct ?? none(),
    taker_pct: derivs?.scores.taker_pct ?? none(),
  };
  // La categoría: la media de las métricas de la temporalidad que tengan dato, como en el índice
  const used = TF_METRICS[tf];
  const sentimiento = time.map((_, i) => mean(used.map((m) => metricScores[m][i])));
  return { time, price, values, scores: { sentimiento, ...metricScores } };
}

function sliceFrom(s: SentimentSeries, i: number): SentimentSeries {
  const cut = <K extends string>(r: Record<K, Col>) => Object.fromEntries(Object.entries<Col>(r).map(([k, v]) => [k, v.slice(i)])) as Record<K, Col>;
  return { time: s.time.slice(i), price: s.price.slice(i), values: cut(s.values), scores: cut(s.scores) };
}

/** Desde la primera puntuación de lo elegido: el Fear & Greed empieza en 2018, los ETF en 2024… */
export function fromFirstScore(s: SentimentSeries, k: SentimentKey): SentimentSeries {
  return sliceFrom(s, Math.max(0, s.scores[k].findIndex((v) => v !== null)));
}

/** Las últimas velas que caben en `days` días */
export function lastDaysOf(s: SentimentSeries, days: number): SentimentSeries {
  if (!Number.isFinite(days) || !s.time.length) return s;
  const from = s.time.at(-1)! - days * 86_400_000;
  return sliceFrom(s, Math.max(0, s.time.findIndex((x) => x >= from)));
}

/** Índice de la última vela con hora igual o anterior a `ms` antes de la última (-1 si no la hay) */
export function indexAgo(s: SentimentSeries, ms: number): number {
  const target = s.time.at(-1)! - ms;
  for (let i = s.time.length - 1; i >= 0; i--) if (s.time[i] <= target) return i;
  return -1;
}
