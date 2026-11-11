import type { SentimentJson } from "./sentiment";
import type { PriceSeries } from "./series";

/** etf.json del pipeline: una fila por sesión desde 2024-01-11 */
export interface EtfJson {
  /** Cita que exige la licencia CC BY 4.0 */
  credit: string;
  dates: string[];
  flow: number[];
  price: number[];
  funds: { ticker: string; last: number; d20: number; total: number }[];
}

// Misma ventana que la métrica del índice (etf_flows en pipeline/metrics.py)
export const ETF_WINDOW = 20;

export interface EtfSeries extends PriceSeries {
  flow: number[];
  cumulative: number[];
  /** Puntuación de 0 a 100 de los flujos en el índice (etf_flows de sentiment.json) el día de cada sesión */
  score: (number | null)[];
}

const DAY = 86_400_000;

/** `sent`: sentiment.json, con un valor por día consecutivo desde `start`; sin él, sin puntuación */
export function etfSeries(e: EtfJson, sent: SentimentJson | null): EtfSeries {
  let acc = 0;
  const start = sent ? Date.parse(`${sent.start}T00:00:00Z`) : 0;
  const scores = sent?.metrics.etf_flows?.score;
  const time = e.dates.map((d) => Date.parse(`${d}T00:00:00Z`));
  return {
    time,
    price: e.price,
    flow: e.flow,
    cumulative: e.flow.map((f) => (acc += f)),
    score: time.map((t) => (scores ? (scores[Math.round((t - start) / DAY)] ?? null) : null)),
  };
}

/** Suma de las últimas 20 sesiones en BTC, como la métrica del índice, y su percentil desde el lanzamiento. */
export function windowStats(e: EtfJson) {
  const btc = e.flow.map((f, i) => f / e.price[i]);
  const sums = btc.slice(ETF_WINDOW - 1).map((_, i) => btc.slice(i, i + ETF_WINDOW).reduce((a, b) => a + b, 0));
  if (!sums.length) return null;
  const last = sums.at(-1)!;
  const usd = e.flow.slice(-ETF_WINDOW).reduce((a, b) => a + b, 0);
  return { btc: last, usd, pct: (sums.filter((s) => s < last).length / sums.length) * 100 };
}
