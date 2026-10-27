import type { Candle, History } from "../types";

/** Tamaños de vela de las páginas de gráficas (volatilidad) */
export type CandleTf = "1h" | "4h" | "1d" | "1w";
export const CANDLE_TFS: CandleTf[] = ["1h", "4h", "1d", "1w"];
export const isIntraday = (tf: CandleTf) => tf === "1h" || tf === "4h";

export interface PriceSeries {
  /** Inicio de cada vela, en ms */
  time: number[];
  /** Cierre de cada vela */
  price: number[];
}

/** Cierres diarios del histórico (desde 2011) más el precio actual como última vela, si el histórico aún no la tiene. */
function dailyFromHistory(history: History, live: number | null): PriceSeries {
  const time = history.dates.map((d) => Date.parse(`${d}T00:00:00Z`));
  const price = [...history.price];
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (live !== null && time.at(-1)! < today) {
    time.push(today);
    price.push(live);
  }
  return { time, price };
}

/** Velas semanales (de lunes a domingo, en UTC) a partir de las diarias: el cierre es el último día de la semana. */
function weekly(daily: PriceSeries): PriceSeries {
  const time: number[] = [];
  const price: number[] = [];
  daily.time.forEach((t, i) => {
    const monday = t - ((new Date(t).getUTCDay() + 6) % 7) * 86_400_000;
    if (time.at(-1) === monday) price[price.length - 1] = daily.price[i];
    else {
      time.push(monday);
      price.push(daily.price[i]);
    }
  });
  return { time, price };
}

/** Cierres de la temporalidad: velas de Binance en 1 h y 4 h; el histórico (diario o semanal) en 1 día y 1 semana. */
export function priceSeries(tf: CandleTf, source: { candles?: Candle[]; history?: History; live?: number | null }): PriceSeries {
  if (isIntraday(tf)) {
    const c = source.candles ?? [];
    return { time: c.map((x) => x.time), price: c.map((x) => x.close) };
  }
  const daily = dailyFromHistory(source.history!, source.live ?? null);
  return tf === "1d" ? daily : weekly(daily);
}

/** Recorta a los últimos `days` días todas las series de `s` (los indicadores ya se calcularon con las velas previas). */
export function lastDays<T extends PriceSeries>(s: T, days: number): T {
  if (!Number.isFinite(days) || !s.time.length) return s;
  const from = s.time.at(-1)! - days * 86_400_000;
  const i = Math.max(0, s.time.findIndex((x) => x >= from));
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Array.isArray(v) ? v.slice(i) : v])) as T;
}
