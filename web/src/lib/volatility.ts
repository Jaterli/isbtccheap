import type { CandleTf, PriceSeries } from "./series";

/** Velas de la ventana de cálculo: un día en 1 h, una semana en 4 h, un mes en 1 día y medio año en 1 semana */
export const VOL_WINDOW: Record<CandleTf, number> = { "1h": 24, "4h": 42, "1d": 30, "1w": 26 };
// Velas por año, para anualizar (BTC cotiza 24 h, los 365 días)
const PER_YEAR: Record<CandleTf, number> = { "1h": 24 * 365, "4h": 6 * 365, "1d": 365, "1w": 365 / 7 };

export interface VolSeries extends PriceSeries {
  /** Anualizada (0,5 = 50 %); null mientras no hay velas suficientes */
  vol: (number | null)[];
}

function realizedVol(price: number[], window: number, perYear: number): (number | null)[] {
  const ret = price.map((p, i) => (i === 0 ? 0 : Math.log(p / price[i - 1])));
  return price.map((_, i) => {
    if (i < window) return null;
    const w = ret.slice(i - window + 1, i + 1);
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    return Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / (w.length - 1)) * Math.sqrt(perYear);
  });
}

export const volSeries = (tf: CandleTf, base: PriceSeries): VolSeries => ({
  ...base,
  vol: realizedVol(base.price, VOL_WINDOW[tf], PER_YEAR[tf]),
});
