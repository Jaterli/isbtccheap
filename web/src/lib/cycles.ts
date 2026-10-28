import type { PriceSeries } from "./series";

const DAY = 86_400_000;

// Mismas fechas que HALVINGS en pipeline/config.py
export const HALVINGS = ["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20", "2028-04-15"].map((d) => Date.parse(`${d}T00:00:00Z`));
export const LAST_HALVING = HALVINGS[HALVINGS.length - 2];
export const NEXT_HALVING = HALVINGS[HALVINGS.length - 1];
export const CYCLE_DAYS = 1461;
// El techo se busca en los dos primeros años: en el ciclo de 2020 el máximo absoluto fue en marzo de 2024, no el techo
// de noviembre de 2021
const PEAK_WINDOW = 730;

export interface Cycle {
  year: number;
  start: number;
  startPrice: number;
  /** Días desde el halving y múltiplo del precio de ese día */
  day: number[];
  mult: number[];
  peak: { day: number; mult: number; time: number; price: number };
  /** Mayor caída desde el techo hasta el final del ciclo (o hasta hoy) */
  drawdown: number;
  current: boolean;
}

/** Múltiplo del ciclo en un día dado (el dato anterior más cercano), o null. */
export function multAt(c: Cycle, day: number): number | null {
  if (day < 0 || day > c.day.at(-1)!) return null;
  let i = c.day.findIndex((d) => d > day);
  i = i < 0 ? c.day.length - 1 : i - 1;
  return i < 0 ? null : c.mult[i];
}

export function cycles(daily: PriceSeries): Cycle[] {
  const out: Cycle[] = [];
  for (let k = 0; k < HALVINGS.length - 1; k++) {
    const start = HALVINGS[k];
    const end = HALVINGS[k + 1];
    const idx = daily.time.flatMap((t, i) => (t >= start && t < end ? [i] : []));
    if (!idx.length || daily.time[idx[0]] - start > 7 * DAY) continue; // el histórico no llega a este halving
    const startPrice = daily.price[idx[0]];
    const day = idx.map((i) => Math.round((daily.time[i] - start) / DAY));
    const mult = idx.map((i) => daily.price[i] / startPrice);
    let p = 0;
    day.forEach((d, j) => d <= PEAK_WINDOW && mult[j] > mult[p] && (p = j));
    const after = mult.slice(p);
    out.push({
      year: new Date(start).getUTCFullYear(),
      start,
      startPrice,
      day,
      mult,
      peak: { day: day[p], mult: mult[p], time: daily.time[idx[p]], price: daily.price[idx[p]] },
      drawdown: Math.min(...after) / mult[p] - 1,
      current: Date.now() < end,
    });
  }
  return out;
}
