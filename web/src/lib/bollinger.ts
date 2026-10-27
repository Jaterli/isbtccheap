import type { PriceSeries } from "./series";

// Los mismos parámetros que el %B del técnico (indicators.ts y el pipeline): media de 20 velas ± 2 desviaciones típicas
export const BB_PERIOD = 20;
export const BB_K = 2;

export interface BollingerSeries extends PriceSeries {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
  /** Posición del cierre entre las bandas: 0 = banda inferior, 100 = superior (puede salirse de 0-100) */
  pctB: (number | null)[];
  /** Ancho de las bandas respecto a la media (fracción): cuanto más bajo, más estrechas ("squeeze") */
  width: (number | null)[];
}

export function bollingerSeries(base: PriceSeries): BollingerSeries {
  const { price } = base;
  const n = price.length;
  const mid: (number | null)[] = new Array(n).fill(null);
  const upper = [...mid];
  const lower = [...mid];
  const pctB = [...mid];
  const width = [...mid];
  for (let i = BB_PERIOD - 1; i < n; i++) {
    const w = price.slice(i - BB_PERIOD + 1, i + 1);
    const m = w.reduce((a, b) => a + b, 0) / BB_PERIOD;
    // Desviación típica poblacional, como en indicators.ts y en el pipeline (ddof=0)
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / BB_PERIOD);
    mid[i] = m;
    upper[i] = m + BB_K * sd;
    lower[i] = m - BB_K * sd;
    pctB[i] = sd === 0 ? 50 : ((price[i] - lower[i]!) / (upper[i]! - lower[i]!)) * 100;
    width[i] = (upper[i]! - lower[i]!) / m;
  }
  return { ...base, mid, upper, lower, pctB, width };
}
