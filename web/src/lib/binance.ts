import type { Candle, Timeframe } from "../types";

// data-api.binance.vision es el dominio público de solo datos de mercado (sin clave, con CORS).
const SPOT = "https://data-api.binance.vision/api/v3";
const FUTURES = "https://fapi.binance.com/fapi/v1";
// Sin límite, una petición colgada dejaría el score en "Cargando…" hasta que el navegador la abandone
const TIMEOUT_MS = 10_000;

export async function fetchCandles(tf: Timeframe, limit = 1000): Promise<Candle[]> {
  const res = await fetch(`${SPOT}/klines?symbol=BTCUSDT&interval=${tf}&limit=${limit}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
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
  const res = await fetch(`${FUTURES}/premiumIndex?symbol=BTCUSDT`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Binance funding ${res.status}`);
  const data = await res.json();
  return Number(data.lastFundingRate);
}

// Estadísticas de los futuros de Binance (sin clave, con CORS). Solo guardan los últimos 30 días
const FUTURES_DATA = "https://fapi.binance.com/futures/data";

/** Series de los derivados de BTCUSDT, de la más antigua a la más reciente. */
export interface Derivatives {
  /** Open interest en BTC: cuánto apalancamiento hay abierto */
  openInterest: number[];
  /** Cuentas con posición larga / cuentas con posición corta (la web lo muestra como % de cuentas en largo) */
  longShort: number[];
  /** Volumen comprador / vendedor de las órdenes a mercado (la web lo muestra como % de compras) */
  takerRatio: number[];
}

async function futuresData<T>(path: string, period: Timeframe): Promise<T[]> {
  const res = await fetch(`${FUTURES_DATA}/${path}?symbol=BTCUSDT&period=${period}&limit=500`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Binance ${path} ${res.status}`);
  return res.json();
}

export async function fetchDerivatives(period: Timeframe): Promise<Derivatives> {
  const [oi, ls, taker] = await Promise.all([
    futuresData<{ sumOpenInterest: string }>("openInterestHist", period),
    futuresData<{ longShortRatio: string }>("globalLongShortAccountRatio", period),
    futuresData<{ buySellRatio: string }>("takerlongshortRatio", period),
  ]);
  return {
    openInterest: oi.map((x) => Number(x.sumOpenInterest)),
    longShort: ls.map((x) => Number(x.longShortRatio)),
    takerRatio: taker.map((x) => Number(x.buySellRatio)),
  };
}
