import type { PriceSeries } from "./series";

const DAY = 86_400_000;
// Caída mínima para entrar en la tabla de grandes caídas (el episodio actual se muestra siempre)
export const BIG_DRAWDOWN = -0.5;
// Antes de 2011 el mercado era minúsculo (precios de céntimos): sus caídas no son comparables
const EPISODES_SINCE = Date.UTC(2011, 0, 1);

export interface DrawdownSeries extends PriceSeries {
  ath: number[];
  /** Caída desde el máximo: 0 en máximos, -0,5 = la mitad */
  dd: number[];
}

export interface Episode {
  athTime: number;
  ath: number;
  lowTime: number;
  low: number;
  dd: number;
  /** Día en que superó el máximo anterior; null si aún no */
  recovered: number | null;
}

export function drawdownSeries(p: PriceSeries): DrawdownSeries {
  const ath: number[] = [];
  p.price.forEach((x, i) => ath.push(Math.max(x, ath[i - 1] ?? 0)));
  return { ...p, ath, dd: p.price.map((x, i) => x / ath[i] - 1) };
}

/** Episodios entre un máximo y el siguiente: los de más de BIG_DRAWDOWN y el actual, el último. */
export function episodes(s: DrawdownSeries): Episode[] {
  const out: Episode[] = [];
  let cur: Episode | null = null;
  for (let i = 0; i < s.time.length; i++) {
    const t = s.time[i];
    if (s.dd[i] === 0) {
      if (cur && cur.dd <= BIG_DRAWDOWN && cur.athTime >= EPISODES_SINCE) out.push({ ...cur, recovered: t });
      cur = { athTime: t, ath: s.price[i], lowTime: t, low: s.price[i], dd: 0, recovered: null };
    } else if (cur && s.dd[i] < cur.dd) Object.assign(cur, { lowTime: t, low: s.price[i], dd: s.dd[i] });
  }
  if (cur) out.push(cur);
  return out;
}

/** Techos de ciclo: máximos seguidos de una caída de más del 50 % que tardó más de medio año en tocar fondo (las
 * correcciones bruscas, como la de mayo de 2021, tocan fondo antes) */
export const cycleTops = (eps: Episode[]) => eps.filter((e) => e.dd <= BIG_DRAWDOWN && daysBetween(e.athTime, e.lowTime) > 180);

export const daysBetween = (a: number, b: number) => Math.round((b - a) / DAY);
