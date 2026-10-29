import type { PriceSeries } from "./series";

const DAY = 86_400_000;

/** Fase: 1 alcista, -1 bajista. Cada cambio, con la fecha en que se confirmó (7 días seguidos en el nuevo valor) */
export type PhaseChange = [string, 1 | -1];

/** phase.json del pipeline (metrics.market_phase): series diarias desde `start` */
export interface PhaseJson {
  start: string;
  price: (number | null)[];
  /** Precio realizado de corto plazo */
  sth: (number | null)[];
  trend: PhaseChange[];
  liquidity: PhaseChange[] | null;
  /** Variación en 13 semanas de la liquidez global, último dato */
  liquidity_roc: number | null;
}

export interface PhaseSeries extends PriceSeries {
  sth: (number | null)[];
  trend: (1 | -1 | null)[];
  liquidity: (1 | -1 | null)[];
}

const parse = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Fase de cada día a partir de la lista de cambios. */
function perDay(time: number[], changes: PhaseChange[] | null): (1 | -1 | null)[] {
  if (!changes) return time.map(() => null);
  let k = -1;
  return time.map((t) => {
    while (k + 1 < changes.length && parse(changes[k + 1][0]) <= t) k++;
    return k < 0 ? null : changes[k][1];
  });
}

export function phaseSeries(p: PhaseJson): PhaseSeries {
  const start = parse(p.start);
  const idx = p.price.flatMap((v, i) => (v !== null && v > 0 ? [i] : []));
  const time = idx.map((i) => start + i * DAY);
  return {
    time,
    price: idx.map((i) => p.price[i]!),
    sth: idx.map((i) => p.sth[i]),
    trend: perDay(time, p.trend),
    liquidity: perDay(time, p.liquidity),
  };
}

export interface PhaseStats {
  /** Rentabilidad mediana de BTC a 90 días desde los días de cada fase */
  bull90: number | null;
  bear90: number | null;
  /** Parte de los días en fase alcista */
  bullShare: number;
  changesPerYear: number;
  /** Cambios que se deshicieron en menos de 30 días */
  falseShare: number;
}

const median = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Estadísticas de una fase sobre todo el histórico. */
export function phaseStats(s: PhaseSeries, phase: (1 | -1 | null)[], changes: PhaseChange[]): PhaseStats {
  const bull: number[] = [];
  const bear: number[] = [];
  phase.forEach((f, i) => {
    if (f === null || i + 90 >= s.price.length) return;
    (f === 1 ? bull : bear).push(s.price[i + 90] / s.price[i] - 1);
  });
  const known = phase.filter((f) => f !== null);
  const dates = changes.slice(1).map((c) => parse(c[0]));
  const years = (s.time.at(-1)! - s.time[0]) / (365.25 * DAY);
  const quick = dates.slice(1).filter((t, i) => t - dates[i] < 30 * DAY).length;
  return {
    bull90: median(bull),
    bear90: median(bear),
    bullShare: known.filter((f) => f === 1).length / Math.max(1, known.length),
    changesPerYear: dates.length / years,
    falseShare: quick / Math.max(1, dates.length - 1),
  };
}
