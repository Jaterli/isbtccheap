import type { Candle, Timeframe } from "../types";

// data-api.binance.vision es el dominio público de solo datos de mercado (sin clave, con CORS).
const SPOT = "https://data-api.binance.vision/api/v3";
const FUTURES = "https://fapi.binance.com/fapi/v1";

export async function fetchCandles(tf: Timeframe, limit = 1000): Promise<Candle[]> {
  const res = await fetch(`${SPOT}/klines?symbol=BTCUSDT&interval=${tf}&limit=${limit}`);
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  const rows: unknown[][] = await res.json();
  return rows.map((r) => ({
    time: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
  }));
}

/** Último funding rate del perpetuo BTCUSDT (p. ej. 0.0001 = 0,01 % cada 8 h). */
export async function fetchFundingRate(): Promise<number> {
  const res = await fetch(`${FUTURES}/premiumIndex?symbol=BTCUSDT`);
  if (!res.ok) throw new Error(`Binance funding ${res.status}`);
  const data = await res.json();
  return Number(data.lastFundingRate);
}
