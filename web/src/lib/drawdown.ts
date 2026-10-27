import type { PriceSeries } from "./series";

const DAY = 86_400_000;
// Caída a partir de la que un episodio entra en la tabla de grandes caídas (el actual se muestra siempre)
export const BIG_DRAWDOWN = -0.5;
// Antes de 2011 el mercado era minúsculo (precios de céntimos): sus caídas no son comparables
const EPISODES_SINCE = Date.UTC(2011, 0, 1);

export interface DrawdownSeries extends PriceSeries {
  /** Máximo histórico hasta cada día */
  ath: number[];
  /** Caída desde el máximo histórico, en fracción (0 en máximos, -0,5 = la mitad) */
  dd: number[];
}

export interface Episode {
  athTime: number;
  ath: number;
  lowTime: number;
  low: number;
  /** Mayor caída del episodio (fracción negativa) */
  dd: number;
  /** Día en que el precio superó el máximo anterior, o null si aún no lo ha hecho */
  recovered: number | null;
}

/** Máximo histórico y caída desde él de una serie de precios diaria (el máximo se cuenta desde su primer día). */
export function drawdownSeries(p: PriceSeries): DrawdownSeries {
  const ath: number[] = [];
  p.price.forEach((x, i) => ath.push(Math.max(x, ath[i - 1] ?? 0)));
  return { ...p, ath, dd: p.price.map((x, i) => x / ath[i] - 1) };
}

/** Episodios entre un máximo histórico y el siguiente: los de más de BIG_DRAWDOWN y el actual (el último). */
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

/** Techos de ciclo: los máximos seguidos de una caída de más del 50 % que tardó más de medio año en tocar fondo (las
 * correcciones bruscas dentro de una tendencia alcista, como la de mayo de 2021, tocan fondo antes) */
export const cycleTops = (eps: Episode[]) => eps.filter((e) => e.dd <= BIG_DRAWDOWN && daysBetween(e.athTime, e.lowTime) > 180);

export const daysBetween = (a: number, b: number) => Math.round((b - a) / DAY);
