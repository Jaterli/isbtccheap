import type { PriceSeries } from "./series";
import type { BandsJson } from "./valuation";

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

/** Precio diario (de bands.json, desde 2010) con el precio actual como último día, máximo histórico y caída. */
export function drawdownSeries(b: BandsJson, live: number | null): DrawdownSeries {
  const start = Date.parse(`${b.start}T00:00:00Z`);
  const s: DrawdownSeries = { time: [], price: [], ath: [], dd: [] };
  const push = (time: number, price: number) => {
    const ath = Math.max(price, s.ath.at(-1) ?? 0);
    s.time.push(time);
    s.price.push(price);
    s.ath.push(ath);
    s.dd.push(price / ath - 1);
  };
  b.price.forEach((p, i) => p !== null && push(start + i * DAY, p));
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (live !== null && s.time.length && s.time.at(-1)! < today) push(today, live);
  return s;
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

export const daysBetween = (a: number, b: number) => Math.round((b - a) / DAY);
