import type { PriceSeries } from "./series";

/** etf.json del pipeline (build.etf_json): una fila por sesión desde el lanzamiento (2024-01-11) */
export interface EtfJson {
  /** Cita que exige la licencia CC BY 4.0, con la fecha de los datos */
  credit: string;
  dates: string[];
  /** Flujo neto de todos los fondos, USD */
  flow: number[];
  /** Precio de referencia de BTC del día */
  price: number[];
  funds: { ticker: string; last: number; d20: number; total: number }[];
}

// Ventana de la métrica del índice (pipeline/config.py → etf_flows)
export const ETF_WINDOW = 20;

export interface EtfSeries extends PriceSeries {
  flow: number[];
  /** Flujo acumulado desde el lanzamiento, USD */
  cumulative: number[];
}

export function etfSeries(e: EtfJson): EtfSeries {
  let acc = 0;
  return {
    time: e.dates.map((d) => Date.parse(`${d}T00:00:00Z`)),
    price: e.price,
    flow: e.flow,
    cumulative: e.flow.map((f) => (acc += f)),
  };
}

/**
 * Suma de las últimas 20 sesiones en BTC (como la métrica del índice) y su percentil frente a todas las sumas de 20
 * sesiones desde el lanzamiento.
 */
export function windowStats(e: EtfJson) {
  const btc = e.flow.map((f, i) => f / e.price[i]);
  const sums = btc.slice(ETF_WINDOW - 1).map((_, i) => btc.slice(i, i + ETF_WINDOW).reduce((a, b) => a + b, 0));
  if (!sums.length) return null;
  const last = sums.at(-1)!;
  const usd = e.flow.slice(-ETF_WINDOW).reduce((a, b) => a + b, 0);
  return { btc: last, usd, pct: (sums.filter((s) => s < last).length / sums.length) * 100 };
}
