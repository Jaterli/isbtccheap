import type { Candle, History } from "../types";

export type VolTf = "1h" | "4h" | "1d" | "1w";
export const VOL_TFS: VolTf[] = ["1h", "4h", "1d", "1w"];

/** Velas de la ventana de cálculo: un día en 1 h, una semana en 4 h, un mes en 1 día y medio año en 1 semana */
export const VOL_WINDOW: Record<VolTf, number> = { "1h": 24, "4h": 42, "1d": 30, "1w": 26 };
// Velas por año, para anualizar (BTC cotiza 24 h, los 365 días)
const PER_YEAR: Record<VolTf, number> = { "1h": 24 * 365, "4h": 6 * 365, "1d": 365, "1w": 365 / 7 };

export interface VolSeries {
  /** Inicio de cada vela, en ms */
  time: number[];
  /** Cierre de cada vela */
  price: number[];
  /** Volatilidad realizada anualizada (fracción: 0,5 = 50 %); null mientras no hay velas suficientes */
  vol: (number | null)[];
}

/** Desviación típica de los rendimientos logarítmicos de las últimas `window` velas, anualizada. */
function realizedVol(price: number[], window: number, perYear: number): (number | null)[] {
  const ret = price.map((p, i) => (i === 0 ? 0 : Math.log(p / price[i - 1])));
  return price.map((_, i) => {
    if (i < window) return null;
    const w = ret.slice(i - window + 1, i + 1);
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    return Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / (w.length - 1)) * Math.sqrt(perYear);
  });
}

/** Cierres diarios del histórico (desde 2011) más el precio actual como última vela, si el histórico aún no la tiene. */
function dailyFromHistory(history: History, live: number | null) {
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
function weekly(daily: { time: number[]; price: number[] }) {
  const time: number[] = [];
  const price: number[] = [];
  daily.time.forEach((t, i) => {
    const d = new Date(t);
    const monday = t - ((d.getUTCDay() + 6) % 7) * 86_400_000;
    if (time.at(-1) === monday) price[price.length - 1] = daily.price[i];
    else {
      time.push(monday);
      price.push(daily.price[i]);
    }
  });
  return { time, price };
}

export function volSeries(tf: VolTf, source: { candles?: Candle[]; history?: History; live?: number | null }): VolSeries {
  let base: { time: number[]; price: number[] };
  if (tf === "1h" || tf === "4h") {
    const c = source.candles ?? [];
    base = { time: c.map((x) => x.time), price: c.map((x) => x.close) };
  } else {
    const daily = dailyFromHistory(source.history!, source.live ?? null);
    base = tf === "1d" ? daily : weekly(daily);
  }
  return { ...base, vol: realizedVol(base.price, VOL_WINDOW[tf], PER_YEAR[tf]) };
}
