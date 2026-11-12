import type { Candle, History } from "../types";
import { fetchCandleHistory, fetchCandles } from "./binance";
import { clamp } from "./indicators";
import { withHistory } from "./score";
import type { CandleTf } from "./series";

/**
 * Serie de la categoría técnica y de sus tres métricas en cada vela, calculadas como el técnico en vivo del índice
 * (lib/score.ts): RSI 14 (30 → 0, 70 → 100), Bollinger %B (20, 2) y el percentil del precio frente a su media de 200
 * velas, que en vivo se compara con las 1000 velas descargadas.
 */
export const TECH_TFS = ["1h", "4h", "1d", "1w"] as const satisfies readonly CandleTf[];
export type TechTf = (typeof TECH_TFS)[number];
export const TECH_METRICS = ["rsi_14", "bollinger", "ma200_ratio"] as const;
export type TechMetric = (typeof TECH_METRICS)[number];
export type TechKey = "tecnico" | TechMetric;

export interface TechSeries {
  time: number[];
  price: number[];
  scores: Record<TechKey, (number | null)[]>;
  values: Record<TechMetric, (number | null)[]>;
}

const MA = 200;
// Velas que ve el técnico en vivo: el percentil de cada vela se calcula sobre esas mismas, hasta ella
const LIVE_WINDOW = 1000;
// Velas que se dibujan; se descargan además las 1000 anteriores para que la primera ya tenga su ventana completa
const SHOWN: Record<"1h" | "4h" | "1d", number> = { "1h": 500, "4h": 500, "1d": 1000 };

function rsiSeries(c: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = c.map(() => null);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    if (i <= n) {
      gain += Math.max(d, 0) / n;
      loss += Math.max(-d, 0) / n;
    } else {
      gain = (gain * (n - 1) + Math.max(d, 0)) / n;
      loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    }
    if (i >= n) out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

function pctBSeries(c: number[], n = 20, k = 2): (number | null)[] {
  return c.map((last, i) => {
    if (i < n - 1) return null;
    const w = c.slice(i - n + 1, i + 1);
    const mean = w.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    return sd === 0 ? 50 : ((last - (mean - k * sd)) / (2 * k * sd)) * 100;
  });
}

/** Cociente precio / media de `MA` velas y su percentil frente a las de las últimas `window` velas (Infinity: todas). */
function maSeries(c: number[], window: number) {
  let sum = 0;
  const ratio = c.map((v, i) => {
    sum += v;
    if (i >= MA) sum -= c[i - MA];
    return i >= MA - 1 ? v / (sum / MA) : null;
  });
  const pct = ratio.map((r, i) => {
    if (r === null) return null;
    const from = Number.isFinite(window) ? Math.max(0, i - window + 1) : 0;
    let n = 0;
    let below = 0;
    for (let j = from; j <= i; j++) {
      const x = ratio[j];
      if (x === null) continue;
      n++;
      if (x <= r) below++;
    }
    return n < 50 ? null : (below / n) * 100;
  });
  return { ratio, pct };
}

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function build(candles: Candle[], window: number, from: number): TechSeries {
  const c = candles.map((x) => x.close);
  const rsi = rsiSeries(c);
  const b = pctBSeries(c);
  const ma = maSeries(c, window);
  const rsiScore = rsi.map((r) => (r === null ? null : clamp(((r - 30) / 40) * 100)));
  const bScore = b.map((v) => (v === null ? null : clamp(v)));
  const cut = <T,>(v: T[]) => v.slice(from);
  return {
    time: cut(candles.map((x) => x.time)),
    price: cut(c),
    scores: {
      tecnico: cut(c.map((_, i) => mean([rsiScore[i], bScore[i], ma.pct[i]]))),
      rsi_14: cut(rsiScore),
      bollinger: cut(bScore),
      ma200_ratio: cut(ma.pct),
    },
    values: { rsi_14: cut(rsi), bollinger: cut(b), ma200_ratio: cut(ma.ratio) },
  };
}

/** 1 h, 4 h y 1 día: velas de Binance. Semanal: las de Binance completadas con el histórico diario, como el índice. */
export async function loadTechnical(tf: TechTf, history: History | null): Promise<TechSeries> {
  if (tf === "1w") {
    const candles = withHistory(await fetchCandles("1w"), history, "1w");
    const s = build(candles, Infinity, 0);
    const first = s.scores.tecnico.findIndex((v) => v !== null);
    return sliceTech(s, Math.max(0, first));
  }
  const candles = await fetchCandleHistory(tf, SHOWN[tf] + LIVE_WINDOW);
  // En vivo, de 1000 velas salen 801 cocientes (las 199 primeras no tienen media): la misma ventana
  return build(candles, LIVE_WINDOW - MA + 1, Math.max(0, candles.length - SHOWN[tf]));
}

export function sliceTech(s: TechSeries, i: number): TechSeries {
  const cut = <K extends string>(r: Record<K, (number | null)[]>) =>
    Object.fromEntries(Object.entries<(number | null)[]>(r).map(([k, v]) => [k, v.slice(i)])) as Record<K, (number | null)[]>;
  return { time: s.time.slice(i), price: s.price.slice(i), scores: cut(s.scores), values: cut(s.values) };
}
