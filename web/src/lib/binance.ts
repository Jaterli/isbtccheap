import type { Candle, Timeframe } from "../types";

// Dominio público de solo datos de mercado: sin clave y con CORS
const SPOT = "https://data-api.binance.vision/api/v3";
const FUTURES = "https://fapi.binance.com/fapi/v1";
// Sin límite, una petición colgada dejaría el score en "Cargando…"
const TIMEOUT_MS = 10_000;

/** Últimas `limit` velas, o las anteriores a `endTime` (ms) si se indica. */
export async function fetchCandles(tf: Timeframe, limit = 1000, endTime?: number): Promise<Candle[]> {
  const end = endTime === undefined ? "" : `&endTime=${endTime}`;
  const res = await fetch(`${SPOT}/klines?symbol=BTCUSDT&interval=${tf}&limit=${limit}${end}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
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

/** Funding rates liquidados (cada 8 h), del más antiguo al más reciente. */
export async function fetchFundingHistory(limit = 120): Promise<{ time: number; rate: number }[]> {
  const res = await fetch(`${FUTURES}/fundingRate?symbol=BTCUSDT&limit=${limit}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Binance funding history ${res.status}`);
  const rows: { fundingTime: number; fundingRate: string }[] = await res.json();
  return rows.map((r) => ({ time: Number(r.fundingTime), rate: Number(r.fundingRate) }));
}

// Estadísticas de los futuros: solo guardan los últimos 30 días
const FUTURES_DATA = "https://fapi.binance.com/futures/data";

export interface Derivatives {
  /** En BTC */
  openInterest: number[];
  /** Cuentas en largo / en corto */
  longShort: number[];
  /** Volumen comprador / vendedor de las órdenes a mercado */
  takerRatio: number[];
}

/** Cada serie con la hora (ms) de sus puntos, que no siempre coinciden entre series. */
export type DerivativesSeries = Record<keyof Derivatives, { time: number[]; value: number[] }>;

async function futuresData(path: string, field: string, period: Timeframe) {
  const res = await fetch(`${FUTURES_DATA}/${path}?symbol=BTCUSDT&period=${period}&limit=500`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Binance ${path} ${res.status}`);
  const rows: Record<string, string | number>[] = await res.json();
  return { time: rows.map((r) => Number(r.timestamp)), value: rows.map((r) => Number(r[field])) };
}

export async function fetchDerivativesSeries(period: Timeframe): Promise<DerivativesSeries> {
  const [openInterest, longShort, takerRatio] = await Promise.all([
    futuresData("openInterestHist", "sumOpenInterest", period),
    futuresData("globalLongShortAccountRatio", "longShortRatio", period),
    futuresData("takerlongshortRatio", "buySellRatio", period),
  ]);
  return { openInterest, longShort, takerRatio };
}

export async function fetchDerivatives(period: Timeframe): Promise<Derivatives> {
  const s = await fetchDerivativesSeries(period);
  return { openInterest: s.openInterest.value, longShort: s.longShort.value, takerRatio: s.takerRatio.value };
}
