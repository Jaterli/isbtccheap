/** liquidity.json del pipeline: semanal (miércoles); la liquidez llega hasta `through` y el precio, hasta hoy */
export interface LiquidityJson {
  through: string;
  dates: string[];
  /** Miles de millones de USD */
  net: (number | null)[];
  /** Variación en 13 semanas (0,02 = +2 %) */
  roc: (number | null)[];
  /** Fed + BCE + Banco de Japón en dólares; ausente en ficheros anteriores */
  global_net?: (number | null)[];
  global_roc?: (number | null)[];
  price: (number | null)[];
}

// Semanas que se adelanta la liquidez: las mismas de su variación
export const LEAD_WEEKS = 13;
const WEEK = 7 * 86_400_000;

export interface LiquiditySeries {
  /** Fechas reales del precio; las 13 últimas semanas, futuras */
  time: number[];
  btc: (number | null)[];
  /** Liquidez global y de la Fed de 13 semanas antes de cada fecha, y esa fecha */
  roc: (number | null)[];
  fedRoc: (number | null)[];
  liqTime: number[];
}

/** El precio en sus fechas y la liquidez adelantada 13 semanas, hasta 13 semanas después de su último dato. */
export function liquiditySeries(l: LiquidityJson): LiquiditySeries {
  const dates = l.dates.map((d) => Date.parse(`${d}T00:00:00Z`));
  const through = Date.parse(`${l.through}T00:00:00Z`);
  const last = dates.findIndex((t) => t > through);
  const liqEnd = last < 0 ? dates.length : last;
  const n = liqEnd + LEAD_WEEKS;
  const time = Array.from({ length: n }, (_, i) => (i < dates.length ? dates[i] : dates.at(-1)! + (i - dates.length + 1) * WEEK));
  const shift = (v: (number | null)[]) => time.map((_, i) => (i >= LEAD_WEEKS && i - LEAD_WEEKS < liqEnd ? (v[i - LEAD_WEEKS] ?? null) : null));
  return {
    time,
    btc: time.map((_, i) => l.price[i] ?? null),
    roc: shift(l.global_roc ?? l.roc),
    fedRoc: shift(l.roc),
    liqTime: time.map((t) => t - LEAD_WEEKS * WEEK),
  };
}

/** Correlación entre la variación de la liquidez global y la rentabilidad de BTC en las 13 semanas siguientes. */
export function leadCorrelation(s: LiquiditySeries): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  s.roc.forEach((r, i) => {
    const p = s.btc[i - LEAD_WEEKS];
    const q = s.btc[i];
    if (r !== null && p != null && q !== null && p > 0) (xs.push(r), ys.push(q / p - 1));
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
