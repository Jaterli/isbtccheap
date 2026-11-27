import { fetchCandleHistory, futuresData } from "./binance";

/**
 * Riesgo de cascada de liquidaciones de largos (news/backtest_cascades.py, velas de 4 h de enero a noviembre de 2026):
 * con el 70 % o más de las cuentas de Binance en largo y, además, el precio cerca de su mínimo de 7 días o ese 70 %
 * durante 3 días seguidos, las cascadas (velas de 4 h que caen un 3 % o más con liquidaciones de largos de 3 veces su
 * media) eran unas 6 veces más frecuentes que en cualquier vela. Tras el primer aviso de cada racha, hubo una en los 7
 * días siguientes en 3 de cada 4 casos (frente a 1 de cada 3 desde cualquier vela), normalmente tras 2 o 3 días de rango
 * o de caída lenta; solo 1 de cada 4 veces subió antes. Informativo: el índice no lo usa.
 */
export const LONGS_MIN = 70;
const PERSIST_BARS = 18; // 3 días de velas de 4 h
const LOW_BARS = 42; // mínimo de 7 días
const PCT_BARS = 180; // «cerca»: frente a los 30 días anteriores
const NEAR_PCT = 0.4;

export interface CascadeRisk {
  active: boolean;
  /** Cuentas en largo (%) en la última vela de 4 h cerrada */
  longs: number;
  /** Velas de 4 h seguidas con el 70 % o más, hasta la última */
  streakBars: number;
  near: boolean;
  persistent: boolean;
  /** Distancia del último cierre al mínimo de 7 días */
  aboveLow: number;
}

export async function cascadeRisk(): Promise<CascadeRisk | null> {
  const [ls, candles] = await Promise.all([
    futuresData("globalLongShortAccountRatio", "longAccount", "4h"),
    fetchCandleHistory("4h", LOW_BARS + PCT_BARS + 2),
  ]);
  const longs = ls.value.map((v) => v * 100);
  // La última vela de 4 h va en curso: solo las cerradas
  const bars = candles.slice(0, -1);
  if (!longs.length || bars.length < LOW_BARS + PCT_BARS) return null;
  const last = longs[longs.length - 1];
  let streakBars = 0;
  for (let i = longs.length - 1; i >= 0 && longs[i] >= LONGS_MIN; i--) streakBars++;
  // Distancia de cada cierre al mínimo de sus 7 días anteriores (incluida su vela), y su percentil en 30 días
  const dist = (i: number) => bars[i].close / Math.min(...bars.slice(i - LOW_BARS + 1, i + 1).map((b) => b.low)) - 1;
  const n = bars.length - 1;
  const now = dist(n);
  const past = Array.from({ length: PCT_BARS }, (_, k) => dist(n - 1 - k));
  const near = past.filter((x) => x < now).length / past.length <= NEAR_PCT;
  const persistent = streakBars >= PERSIST_BARS;
  return { active: last >= LONGS_MIN && (near || persistent), longs: last, streakBars, near, persistent, aboveLow: now };
}
