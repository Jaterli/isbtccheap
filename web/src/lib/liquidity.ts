/**
 * liquidity.json del pipeline: liquidez global diaria desde `start` hasta `through` y precio de BTC diario hasta hoy.
 * Formato anterior (semanal): `dates` con un dato por miércoles y el precio semanal en `price`.
 */
export interface LiquidityJson {
  through: string;
  start?: string;
  dates?: string[];
  /** Miles de millones de USD */
  net: (number | null)[];
  /** Variación en 13 semanas (0,02 = +2 %) */
  roc: (number | null)[];
  /** Formato semanal más antiguo: ahí `net` y `roc` eran de la Fed y la liquidez global iba en estos campos */
  global_net?: (number | null)[];
  global_roc?: (number | null)[];
  price?: (number | null)[];
  daily_start?: string;
  daily_price?: (number | null)[];
}

// Semanas que se adelanta la liquidez: las mismas de su variación
export const LEAD_WEEKS = 13;
const DAY = 86_400_000;
const LEAD = LEAD_WEEKS * 7 * DAY;

export interface LiquiditySeries {
  /** Dónde se dibuja cada dato de liquidez (13 semanas después de su fecha, `srcTime`) */
  liqTime: number[];
  srcTime: number[];
  roc: (number | null)[];
  /** Precio de BTC el día de cada dato de liquidez y 13 semanas después, para la correlación */
  pNow: (number | null)[];
  pLead: (number | null)[];
  /** Diario */
  btcTime: number[];
  btc: (number | null)[];
  /** Último instante del eje: el último dato de liquidez, adelantado */
  end: number;
}

const parse = (d: string) => Date.parse(`${d}T00:00:00Z`);
const positive = (v: number | null | undefined) => (v != null && v > 0 ? v : null);

export function liquiditySeries(l: LiquidityJson): LiquiditySeries {
  const through = parse(l.through);
  const liqDates = l.start ? l.roc.map((_, i) => parse(l.start!) + i * DAY) : l.dates!.map(parse);
  const roc = l.global_roc ?? l.roc;
  const daily = l.daily_price
    ? { time: l.daily_price.map((_, i) => parse(l.daily_start!) + i * DAY), price: l.daily_price.map(positive) }
    : { time: liqDates, price: (l.price ?? []).map(positive) };
  // Precio de un día concreto, del histórico diario
  const first = daily.time[0];
  const priceAt = (t: number) => {
    const i = Math.round((t - first) / DAY);
    return l.daily_price ? (daily.price[i] ?? null) : (daily.price[daily.time.indexOf(t)] ?? null);
  };
  const idx = liqDates.flatMap((t, i) => (t <= through ? [i] : []));
  return {
    liqTime: idx.map((i) => liqDates[i] + LEAD),
    srcTime: idx.map((i) => liqDates[i]),
    roc: idx.map((i) => roc[i] ?? null),
    pNow: idx.map((i) => priceAt(liqDates[i])),
    pLead: idx.map((i) => priceAt(liqDates[i] + LEAD)),
    btcTime: daily.time,
    btc: daily.price,
    end: through + LEAD,
  };
}

/** Los últimos `days` días del eje (Infinity: todo). */
export function lastDaysOf(s: LiquiditySeries, days: number): LiquiditySeries {
  if (!Number.isFinite(days)) return s;
  const from = s.end - days * DAY;
  const a = s.liqTime.findIndex((t) => t >= from);
  const b = s.btcTime.findIndex((t) => t >= from);
  const cut = <T,>(v: T[], i: number) => (i < 0 ? [] : v.slice(i));
  return {
    liqTime: cut(s.liqTime, a),
    srcTime: cut(s.srcTime, a),
    roc: cut(s.roc, a),
    pNow: cut(s.pNow, a),
    pLead: cut(s.pLead, a),
    btcTime: cut(s.btcTime, b),
    btc: cut(s.btc, b),
    end: s.end,
  };
}

/** Correlación entre la variación de la liquidez y la rentabilidad de BTC en las 13 semanas siguientes. */
export function leadCorrelation(s: LiquiditySeries): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  s.roc.forEach((r, i) => {
    const p = s.pNow[i];
    const q = s.pLead[i];
    if (r !== null && p !== null && q !== null) (xs.push(r), ys.push(q / p - 1));
  });
  if (xs.length < 20) return null;
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  });
  return sxy / Math.sqrt(sxx * syy);
}
