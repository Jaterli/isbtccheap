import type { PriceSeries } from "./series";

const DAY = 86_400_000;

/** bands.json del pipeline: series diarias desde `start` */
export interface BandsJson {
  start: string;
  price: (number | null)[];
  realized: (number | null)[];
  /** Vacío si la fuente falló */
  sth_realized?: (number | null)[];
  wma200: (number | null)[];
  power_law: { genesis: string; slope: number; intercept: number; low: number; high: number; since: string };
}

export interface ValuationSeries extends PriceSeries {
  realized: (number | null)[];
  /** Precio realizado de las monedas de menos de 150 días */
  sth: (number | null)[];
  wma200: (number | null)[];
  /** Tendencia de la power law y bordes de su corredor */
  trend: number[];
  low: number[];
  high: number[];
}

/** Cierres diarios desde 2010 con el precio actual como último día, si aún no lo tiene. */
export function bandsPrice(b: BandsJson, live: number | null): PriceSeries {
  const start = Date.parse(`${b.start}T00:00:00Z`);
  const s: PriceSeries = { time: [], price: [] };
  b.price.forEach((p, i) => p !== null && (s.time.push(start + i * DAY), s.price.push(p)));
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (live !== null && s.time.length && s.time.at(-1)! < today) (s.time.push(today), s.price.push(live));
  return s;
}

/** Con el precio actual como último día, si aún no lo tiene (los niveles se repiten). */
export function valuationSeries(b: BandsJson, live: number | null): ValuationSeries {
  const start = Date.parse(`${b.start}T00:00:00Z`);
  const s: ValuationSeries = { time: [], price: [], realized: [], sth: [], wma200: [], trend: [], low: [], high: [] };
  const push = (time: number, price: number, realized: number | null, sth: number | null, wma: number | null) => {
    const { genesis, slope, intercept, low, high } = b.power_law;
    const trend = 10 ** (intercept + slope * Math.log10((time - Date.parse(`${genesis}T00:00:00Z`)) / DAY));
    s.time.push(time);
    s.price.push(price);
    s.realized.push(realized);
    s.sth.push(sth);
    s.wma200.push(wma);
    s.trend.push(trend);
    s.low.push(trend * low);
    s.high.push(trend * high);
  };
  b.price.forEach((p, i) => p !== null && push(start + i * DAY, p, b.realized[i], b.sth_realized?.[i] ?? null, b.wma200[i]));
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (live !== null && s.time.length && s.time.at(-1)! < today) push(today, live, s.realized.at(-1)!, s.sth.at(-1)!, s.wma200.at(-1)!);
  return s;
}
