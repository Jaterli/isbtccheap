import type { History, Timeframe } from "../types";
import { fetchCandles, fetchDerivativesSeries, fetchSpotFlow } from "./binance";
import { percentileOfLast } from "./indicators";

/** Métricas diarias del índice (sentiment.json, del pipeline) */
export const DAILY_METRICS = ["fear_greed", "sth_sopr", "etf_flows"] as const;
/** Derivados de Binance (solo guarda 30 días), en directo desde el navegador */
export const DERIV_METRICS = ["open_interest", "long_pct", "taker_pct"] as const;
/**
 * Informativas: se muestran pero el índice no las usa (todavía). Los derivados de Binance (formaban el sentimiento de 1 h
 * y 4 h hasta el 11 nov 2026: sin histórico para comprobarlos) y las compras al contado (la parte del volumen al contado
 * que fueron compras a mercado, con todo su histórico desde 2017; en el backtest no anticipaban el precio) y la oferta en
 * pérdidas de los holders de corto plazo (Bitview: marca mejor que el Fear & Greed los techos y suelos, pero en el
 * backtest del índice anticipaba algo peor y es redundante con él).
 */
export const INFO_METRICS = [...DERIV_METRICS, "spot_buy_pct", "sth_loss_pct", "realized_loss_ratio", "sth_mvrv_adj"] as const;
/** Informativas que calcula el pipeline (sentiment.json, con "info"): la pérdida realizada y el MVRV de corto plazo, cada
 * una frente a su media de 90 días */
const PIPELINE_INFO = ["realized_loss_ratio", "sth_mvrv_adj"] as const;
type PipelineInfo = (typeof PIPELINE_INFO)[number];
export const SENTIMENT_METRICS = [...DAILY_METRICS, ...DERIV_METRICS, ...INFO_METRICS] as const;
export type DailyMetric = (typeof DAILY_METRICS)[number];
export type SentimentMetric = (typeof SENTIMENT_METRICS)[number];
/** Lo que se puede dibujar: la categoría (media de las métricas de la temporalidad) o una métrica */
export type SentimentKey = "sentimiento" | SentimentMetric;

export const SENTIMENT_TFS = ["1h", "4h", "1d"] as const;
export type SentimentTf = (typeof SENTIMENT_TFS)[number];

/** Las métricas que usa el índice en cada temporalidad (lib/score.ts): las diarias del pipeline en todas */
export const TF_METRICS: Record<SentimentTf, readonly SentimentMetric[]> = {
  "1h": DAILY_METRICS,
  "4h": DAILY_METRICS,
  "1d": DAILY_METRICS,
};

/** sentiment.json del pipeline: mismas fechas que history.json */
export interface SentimentJson {
  start: string;
  /** Puntuación de la categoría de sentimiento (0-100) */
  category: (number | null)[];
  /** Por métrica, su valor y su puntuación (0-100) cada día */
  metrics: Partial<Record<DailyMetric | PipelineInfo, { value: (number | null)[]; score: (number | null)[] }>>;
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
  const daily = (m: DailyMetric | PipelineInfo, k: "value" | "score") => at.map((i) => (i === undefined ? null : (s.metrics[m]?.[k][i] ?? null)));

  const [derivs, spot, sthLoss] = await Promise.all([
    derivativeColumns(tf, time).catch(() => null),
    spotColumns(tf, time).catch(() => null),
    sthLossColumns(time).catch(() => null),
  ]);

  const values = {
    ...(Object.fromEntries(DAILY_METRICS.map((m) => [m, daily(m, "value")])) as Record<DailyMetric, Col>),
    open_interest: derivs?.values.open_interest ?? none(),
    long_pct: derivs?.values.long_pct ?? none(),
    taker_pct: derivs?.values.taker_pct ?? none(),
    spot_buy_pct: spot?.value ?? none(),
    sth_loss_pct: sthLoss?.value ?? none(),
    realized_loss_ratio: daily("realized_loss_ratio", "value"),
    sth_mvrv_adj: daily("sth_mvrv_adj", "value"),
  };
  const metricScores = {
    ...(Object.fromEntries(DAILY_METRICS.map((m) => [m, daily(m, "score")])) as Record<DailyMetric, Col>),
    open_interest: derivs?.scores.open_interest ?? none(),
    long_pct: derivs?.scores.long_pct ?? none(),
    taker_pct: derivs?.scores.taker_pct ?? none(),
    spot_buy_pct: spot?.score ?? none(),
    sth_loss_pct: sthLoss?.score ?? none(),
    realized_loss_ratio: daily("realized_loss_ratio", "score"),
    sth_mvrv_adj: daily("sth_mvrv_adj", "score"),
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

// Compras al contado: media de 3 velas, como las compras a mercado de los futuros; en 1D, percentil frente a los 4 años
// anteriores (como las diarias del pipeline) y en 1 h y 4 h frente a lo descargado (como los derivados)
const SPOT_SMOOTH = 3;
const SPOT_DAILY_WINDOW = 1461;
const SPOT_DAILY_CANDLES = 4000; // todo el histórico (agosto de 2017)

/** Percentil de cada punto frente a los `window` anteriores (él incluido), con un mínimo de 50, como percentileOfLast */
function rollingPercentileWindow(xs: Col, window: number): Col {
  return xs.map((x, i) => {
    if (x === null) return null;
    const w = xs.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null);
    return w.length < 50 ? null : (w.filter((v) => v <= x).length / w.length) * 100;
  });
}

// Oferta en pérdidas de los holders de corto plazo (Bitview, sin clave y con CORS): % de su oferta en pérdidas,
// puntuado como lo haría el pipeline (percentil frente a los 4 años anteriores, invertido: muchas pérdidas = miedo =
// barato)
const BITVIEW = "https://bitview.space/api/series/{s}/day1?start=0";
const BITVIEW_START = Date.UTC(2009, 0, 1);

async function bitview(series: string): Promise<Map<string, number>> {
  const res = await fetch(BITVIEW.replace("{s}", series), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Bitview ${series} ${res.status}`);
  const d: { start: number; data: (number | null)[] } = await res.json();
  const out = new Map<string, number>();
  // El último día de Bitview está aún en curso: no se usa
  d.data.slice(0, -1).forEach((v, i) => {
    if (v && v > 0) out.set(dayKey(BITVIEW_START + (d.start + i) * 86_400_000), v);
  });
  return out;
}

async function sthLossColumns(time: number[]) {
  const [loss, profit] = await Promise.all([bitview("sth_supply_in_loss"), bitview("sth_supply_in_profit")]);
  const days = [...loss.keys()].filter((d) => profit.has(d)).sort();
  const share: Col = days.map((d) => (loss.get(d)! / (loss.get(d)! + profit.get(d)!)) * 100);
  const pct = rollingPercentileWindow(share, SPOT_DAILY_WINDOW);
  const at = new Map(days.map((d, i) => [d, i]));
  const pick = (c: Col) => time.map((t) => c[at.get(dayKey(t)) ?? -1] ?? null);
  return { value: pick(share), score: pick(pct.map((p) => (p === null ? null : 100 - p))) };
}

async function spotColumns(tf: SentimentTf, time: number[]) {
  const f = await fetchSpotFlow(tf as Timeframe, tf === "1d" ? SPOT_DAILY_CANDLES : INTRADAY_CANDLES[tf]);
  const share: Col = f.time.map((_, i) => {
    if (i < SPOT_SMOOTH - 1) return null;
    let buy = 0;
    let vol = 0;
    for (let j = i - SPOT_SMOOTH + 1; j <= i; j++) {
      buy += f.takerBuy[j];
      vol += f.volume[j];
    }
    return vol ? (buy / vol) * 100 : null;
  });
  const score = tf === "1d" ? rollingPercentileWindow(share, SPOT_DAILY_WINDOW) : rollingPercentileWindow(share, share.length);
  const at = new Map(f.time.map((t, i) => [t, i]));
  return { value: time.map((t) => share[at.get(t) ?? -1] ?? null), score: time.map((t) => score[at.get(t) ?? -1] ?? null) };
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

/** Las últimas `n` velas */
export function lastCandles(s: SentimentSeries, n: number): SentimentSeries {
  return s.time.length > n ? sliceFrom(s, s.time.length - n) : s;
}

/** Índice de la última vela con hora igual o anterior a `ms` antes de la última (-1 si no la hay) */
export function indexAgo(s: SentimentSeries, ms: number): number {
  const target = s.time.at(-1)! - ms;
  for (let i = s.time.length - 1; i >= 0; i--) if (s.time[i] <= target) return i;
  return -1;
}
