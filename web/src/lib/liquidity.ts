import type { PriceSeries } from "./series";

/** liquidity.json del pipeline: semanal (miércoles); la liquidez llega hasta `through` y el precio, hasta hoy */
export interface LiquidityJson {
  through: string;
  dates: string[];
  /** Miles de millones de USD */
  net: (number | null)[];
  /** Variación en 13 semanas (0,02 = +2 %) */
  roc: (number | null)[];
  price: (number | null)[];
}

// Semanas que se adelanta el precio: las mismas de la variación de la liquidez
export const LEAD_WEEKS = 13;

export interface LiquiditySeries extends PriceSeries {
  net: (number | null)[];
  roc: (number | null)[];
  /** Precio de BTC 13 semanas después de cada fecha, y esa fecha */
  lead: (number | null)[];
  leadTime: number[];
}

/** Hasta el último dato de liquidez; el precio, desplazado 13 semanas hacia atrás. */
export function liquiditySeries(l: LiquidityJson): LiquiditySeries {
  const n = l.dates.findIndex((d) => d > l.through);
  const end = n < 0 ? l.dates.length : n;
  const time = l.dates.map((d) => Date.parse(`${d}T00:00:00Z`));
  return {
    time: time.slice(0, end),
    price: l.price.slice(0, end).map((p) => p ?? NaN),
    net: l.net.slice(0, end),
    roc: l.roc.slice(0, end),
    lead: time.slice(0, end).map((_, i) => l.price[i + LEAD_WEEKS] ?? null),
    leadTime: time.slice(0, end).map((t) => t + LEAD_WEEKS * 7 * 86_400_000),
  };
}

/** Correlación entre la variación de la liquidez y la rentabilidad de BTC en las 13 semanas siguientes. */
export function leadCorrelation(s: LiquiditySeries): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  s.roc.forEach((r, i) => {
    const p = s.price[i];
    const q = s.lead[i];
    if (r !== null && q !== null && p > 0) (xs.push(r), ys.push(q / p - 1));
  });
  if (xs.length < 20) return null;
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  });
  return sxy / Math.sqrt(sxx * syy);
}
