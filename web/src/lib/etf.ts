import type { PriceSeries } from "./series";

/** etf.json del pipeline: una fila por sesión desde 2024-01-11 */
export interface EtfJson {
  /** Cita que exige la licencia CC BY 4.0 */
  credit: string;
  dates: string[];
  flow: number[];
  price: number[];
  /** Fear & Greed Index de Alternative.me del día de cada sesión; ausente en ficheros anteriores */
  fear_greed?: (number | null)[] | null;
  funds: { ticker: string; last: number; d20: number; total: number }[];
}

// Misma ventana que la métrica del índice (etf_flows en pipeline/metrics.py)
export const ETF_WINDOW = 20;

export interface EtfSeries extends PriceSeries {
  flow: number[];
  cumulative: number[];
  fearGreed: (number | null)[];
}

export function etfSeries(e: EtfJson): EtfSeries {
  let acc = 0;
  return {
    time: e.dates.map((d) => Date.parse(`${d}T00:00:00Z`)),
    price: e.price,
    flow: e.flow,
    cumulative: e.flow.map((f) => (acc += f)),
    fearGreed: e.fear_greed ?? e.dates.map(() => null),
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
