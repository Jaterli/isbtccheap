import type { PriceSeries } from "./series";

const DAY = 86_400_000;

// Mismas fechas que HALVINGS en pipeline/config.py; la última es la estimación del próximo
export const HALVINGS = ["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20", "2028-04-15"].map((d) => Date.parse(`${d}T00:00:00Z`));
export const LAST_HALVING = HALVINGS[HALVINGS.length - 2];
export const NEXT_HALVING = HALVINGS[HALVINGS.length - 1];
/** Duración de un ciclo completo en días (eje x de la gráfica) */
export const CYCLE_DAYS = 1461;
// El techo de cada ciclo se busca en los dos primeros años tras el halving: en el de 2020, el máximo de todo el ciclo
// fue en marzo de 2024 (justo antes del siguiente halving), no el techo de noviembre de 2021 que marcó el ciclo
const PEAK_WINDOW = 730;

export interface Cycle {
  /** Año del halving: identifica el ciclo */
  year: number;
  start: number;
  /** Precio de cierre del día del halving */
  startPrice: number;
  /** Días desde el halving y múltiplo del precio del halving, uno por día con dato */
  day: number[];
  mult: number[];
  peak: { day: number; mult: number; time: number; price: number };
  /** Mayor caída desde el techo hasta el final del ciclo (o hasta hoy en el actual), en fracción negativa */
  drawdown: number;
  /** El ciclo en curso: aún no ha llegado el siguiente halving */
  current: boolean;
}

/** Múltiplo del precio del halving que llevaba el ciclo en un día dado (el dato más cercano anterior), o null. */
export function multAt(c: Cycle, day: number): number | null {
  if (day < 0 || day > c.day.at(-1)!) return null;
  let i = c.day.findIndex((d) => d > day);
  i = i < 0 ? c.day.length - 1 : i - 1;
  return i < 0 ? null : c.mult[i];
}

/** Divide los cierres diarios en ciclos, de un halving al siguiente. */
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
