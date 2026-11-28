import { fetchCandleHistory, fetchCandles, futuresData } from "./binance";

/**
 * Riesgo de cascada de liquidaciones de largos: el 70 % o más de las cuentas de Binance en largo y, además, el precio
 * cerca de su mínimo de 7 días o ese 70 % durante 3 días seguidos. Backtest en velas diarias desde febrero de 2021
 * (news/backtest_cascades_daily.py; cascada: un día que cae un 5 % o más con liquidaciones de largos de 3 veces su
 * media): con el aviso, las cascadas fueron unas 3 veces más frecuentes que cualquier día, más en mercado bajista
 * (precio bajo su media de 200 días: ×3,4) que en alcista (×2,2); tras el primer día de cada racha de avisos, hubo una
 * en los 7 días siguientes en el 39 % y el 37 % de los casos, frente a un 22 % y un 21 % desde cualquier día. Por eso
 * se dice en qué tipo de mercado estamos. Informativo: el índice no lo usa.
 */
export const LONGS_MIN = 70;
// Una vez encendido, se apaga por debajo de este (no por debajo del 70): con el dato de 5 minutos, rondando el 70 se
// encendería y apagaría a cada rato
export const LONGS_OFF = 68;
const ACTIVE_KEY = "isbtccheap:cascade-active";
const ACTIVE_MAX_AGE = 60 * 60_000; // el estado anterior solo vale si es reciente
const PERSIST_BARS = 18; // 3 días de velas de 4 h
const LOW_BARS = 42; // mínimo de 7 días
const PCT_BARS = 180; // «cerca»: frente a los 30 días anteriores
const NEAR_PCT = 0.4;

export interface CascadeRisk {
  active: boolean;
  /** Cuentas en largo (%) ahora: el dato de 5 minutos más reciente de Binance */
  longs: number;
  /** Hora (ms) de ese dato */
  longsAt: number;
  /** Velas de 4 h seguidas con el 70 % o más, hasta la última (la racha, como en el backtest) */
  streakBars: number;
  near: boolean;
  persistent: boolean;
  /** Distancia del último cierre al mínimo de 7 días */
  aboveLow: number;
  /** Mercado bajista: el precio bajo su media de 200 días (null si no se pudo calcular) */
  bearish: boolean | null;
}

/** Si el aviso estaba encendido hace poco (en este navegador): entonces se apaga por debajo de LONGS_OFF */
function wasActive(): boolean {
  try {
    const v = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? "null") as { at: number; on: boolean } | null;
    return !!v && v.on && Date.now() - v.at < ACTIVE_MAX_AGE;
  } catch {
    return false;
  }
}

function remember(on: boolean) {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ at: Date.now(), on }));
  } catch {
    /* sin almacenamiento: sin margen al apagar */
  }
}

/**
 * El nivel de cuentas en largo se mira con el dato de 5 minutos (el de 4 h llega con hasta 4 h de retraso: tras una caída
 * el aviso seguía encendido aunque ya no hubiera un 70 % en largo); la racha de 3 días, con las velas de 4 h, como en el
 * backtest.
 */
export async function cascadeRisk(): Promise<CascadeRisk | null> {
  const [ls4h, ls5m, candles, daily] = await Promise.all([
    futuresData("globalLongShortAccountRatio", "longAccount", "4h"),
    futuresData("globalLongShortAccountRatio", "longAccount", "5m"),
    fetchCandleHistory("4h", LOW_BARS + PCT_BARS + 2),
    // La media de 200 días, con las velas diarias cerradas (la última va en curso)
    fetchCandles("1d", 202).catch(() => null),
  ]);
  const longs4h = ls4h.value.map((v) => v * 100);
  // La última vela de 4 h va en curso: solo las cerradas
  const bars = candles.slice(0, -1);
  if (!longs4h.length || !ls5m.value.length || bars.length < LOW_BARS + PCT_BARS) return null;
  const now = ls5m.value[ls5m.value.length - 1] * 100;
  const longsAt = ls5m.time[ls5m.time.length - 1];
  let streakBars = 0;
  for (let i = longs4h.length - 1; i >= 0 && longs4h[i] >= LONGS_MIN; i--) streakBars++;
  // Distancia de cada cierre al mínimo de sus 7 días anteriores (incluida su vela), y su percentil en 30 días
  const dist = (i: number) => bars[i].close / Math.min(...bars.slice(i - LOW_BARS + 1, i + 1).map((b) => b.low)) - 1;
  const n = bars.length - 1;
  const aboveLow = dist(n);
  const past = Array.from({ length: PCT_BARS }, (_, k) => dist(n - 1 - k));
  const near = past.filter((x) => x < aboveLow).length / past.length <= NEAR_PCT;
  const persistent = streakBars >= PERSIST_BARS;
  const active = now >= (wasActive() ? LONGS_OFF : LONGS_MIN) && (near || persistent);
  remember(active);
  const closed = daily ? daily.slice(0, -1) : [];
  const sma = closed.length >= 200 ? closed.slice(-200).reduce((a, c) => a + c.close, 0) / 200 : null;
  const bearish = sma === null ? null : bars[n].close < sma;
  return { active, longs: now, longsAt, streakBars, near, persistent, aboveLow, bearish };
}
