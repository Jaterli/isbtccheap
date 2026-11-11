import type { Candle, Timeframe } from "../types";

// Dominio público de solo datos de mercado: sin clave y con CORS
const SPOT = "https://data-api.binance.vision/api/v3";
// Sin límite, una petición colgada dejaría el score en "Cargando…"
const TIMEOUT_MS = 10_000;

/** Últimas `limit` velas, o las anteriores a `endTime` (ms) si se indica. */
export async function fetchCandles(tf: Timeframe | "15m" | "1m", limit = 1000, endTime?: number): Promise<Candle[]> {
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

/** Volumen al contado de cada vela (BTC) y la parte que fueron compras a mercado (las agresivas) */
export interface SpotFlow {
  time: number[];
  volume: number[];
  takerBuy: number[];
}

/**
 * Las últimas `count` velas al contado de `tf` con su volumen comprador, paginando de 1000 en 1000 hacia atrás (Binance
 * guarda todo el histórico de BTCUSDT, desde agosto de 2017).
 */
export async function fetchSpotFlow(tf: Timeframe, count: number): Promise<SpotFlow> {
  const out: unknown[][] = [];
  let end: number | undefined;
  while (out.length < count) {
    const q = end === undefined ? "" : `&endTime=${end}`;
    const res = await fetch(`${SPOT}/klines?symbol=BTCUSDT&interval=${tf}&limit=${Math.min(1000, count - out.length)}${q}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Binance klines ${res.status}`);
    const rows: unknown[][] = await res.json();
    if (!rows.length) break;
    out.unshift(...rows);
    end = Number(rows[0][0]) - 1;
    if (rows.length < 1000) break;
  }
  return { time: out.map((r) => Number(r[0])), volume: out.map((r) => Number(r[5])), takerBuy: out.map((r) => Number(r[9])) };
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
