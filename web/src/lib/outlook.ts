import type { History, Latest } from "../types";

export const HORIZONS = [
  { days: 30, label: "1 mes" },
  { days: 90, label: "3 meses" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 año" },
];

// Muestra de las rentabilidades: días con un score diario a menos de esto del de hoy. Un rango centrado
// compara situaciones parecidas; una zona fija mezclaría, con un score de 39, días de 22 y dejaría fuera los de 42
const SIMILAR = 7.5;
// Para contar episodios independientes, los días de la muestra separados por menos de esto son el mismo episodio:
// se parecen mucho entre sí y no aportan información nueva
const EPISODE_GAP = 30;
// La duración en una zona se mide con la media de 30 días: el score diario es demasiado ruidoso (en semanas
// puede ir de 17 a 58) y sus rachas en una zona de 20 puntos serían de pocos días
const SMOOTH = 30;
const RECENT = 90;
const VOL_WINDOW = 30;
const VOL_LOOKBACK = 1461; // percentil de la volatilidad frente a los últimos 4 años

export interface ForwardStats {
  days: number;
  label: string;
  /** Días de la muestra con precio conocido al cabo del horizonte */
  n: number;
  /** Episodios distintos a los que pertenecen esos días: es el tamaño real de la muestra */
  episodes: number;
  median: number | null;
  /** Fracción de días en que el precio era mayor al cabo del horizonte */
  positive: number | null;
  min: number | null;
  max: number | null;
}

export interface Band {
  index: number;
  lo: number;
  hi: number;
  label: string;
}

export interface Outlook {
  score: number;
  band: Band;
  /** Fracción de los últimos RECENT días con el score diario en la zona de hoy */
  recentShare: number;
  recentDays: number;
  /** Rango de score diario de los días que forman la muestra de rentabilidades */
  similar: { lo: number; hi: number };
  /** Media móvil del score y su racha (días seguidos) en su zona actual */
  smooth: {
    days: number;
    value: number;
    band: Band;
    since: string;
    streakDays: number;
    /** Duración de las rachas anteriores de la media en esa zona, dentro del periodo */
    pastDurations: number[];
  };
  forward: ForwardStats[];
  vol: { current: number; percentile: number } | null;
}

/** Tramos de la escala con los mismos cortes que las etiquetas (score ≤ max). */
function bandOf(score: number, labels: Latest["labels"]): Band {
  const found = labels.findIndex((l) => score <= l.max);
  const i = found === -1 ? labels.length - 1 : found;
  return { index: i, lo: i === 0 ? 0 : labels[i - 1].max, hi: labels[i].max, label: labels[i].label };
}

const inside = (s: number, b: Band) => s > b.lo && s <= b.hi;

/** Rachas de días marcados, uniendo las separadas por `gap` días o menos (0: solo días seguidos). */
function runs(flags: boolean[], gap: number): [number, number][] {
  const out: [number, number][] = [];
  flags.forEach((v, i) => {
    if (!v) return;
    const last = out.at(-1);
    if (last && i - last[1] <= gap + 1) last[1] = i;
    else out.push([i, i]);
  });
  return out;
}

function movingAverage(xs: number[], w: number) {
  let acc = 0;
  return xs.map((x, i) => {
    acc += x - (i >= w ? xs[i - w] : 0);
    return acc / Math.min(i + 1, w);
  });
}

function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  return sorted[lo] + (sorted[Math.ceil(pos)] - sorted[lo]) * (pos - lo);
}

/** Volatilidad realizada anualizada de los últimos VOL_WINDOW días y su percentil reciente. */
function volatility(price: number[]): Outlook["vol"] {
  const logRet = price.slice(1).map((p, i) => Math.log(p / price[i]));
  const vols: number[] = [];
  for (let i = VOL_WINDOW; i <= logRet.length; i++) {
    const w = logRet.slice(i - VOL_WINDOW, i);
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    vols.push(Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / (w.length - 1)) * Math.sqrt(365));
  }
  if (!vols.length) return null;
  const current = vols[vols.length - 1];
  const recent = vols.slice(-VOL_LOOKBACK);
  return { current, percentile: (recent.filter((v) => v <= current).length / recent.length) * 100 };
}

/**
 * Qué hizo el precio después de los días con un score diario parecido al de hoy, y cuánto lleva en su zona.
 * fromIndex limita la muestra a los días desde ese índice (el precio posterior sí puede salir de él).
 */
export function computeOutlook(history: History, labels: Latest["labels"], fromIndex = 0): Outlook | null {
  const { dates, price, score } = history;
  const N = score.length;
  if (!N) return null;
  const today = score[N - 1];
  const band = bandOf(today, labels);
  const recent = score.slice(-RECENT);

  const similar = { lo: today - SIMILAR, hi: today + SIMILAR };
  const inSample = score.map((s, i) => i >= fromIndex && s >= similar.lo && s <= similar.hi);
  const eps = runs(inSample, EPISODE_GAP);

  const avg = movingAverage(score, SMOOTH);
  const avgBand = bandOf(avg[N - 1], labels);
  const avgRuns = runs(avg.map((s, i) => i >= fromIndex && inside(s, avgBand)), 0);
  const current = avgRuns.at(-1)!; // la media de hoy está en su zona por definición

  const forward = HORIZONS.map(({ days, label }) => {
    const rets: number[] = [];
    const used = new Set<number>();
    eps.forEach(([a, b], k) => {
      for (let i = a; i <= Math.min(b, N - 1 - days); i++) {
        if (!inSample[i]) continue;
        rets.push(price[i + days] / price[i] - 1);
        used.add(k);
      }
    });
    rets.sort((x, y) => x - y);
    const has = rets.length > 0;
    return {
      days,
      label,
      n: rets.length,
      episodes: used.size,
      median: has ? quantile(rets, 0.5) : null,
      positive: has ? rets.filter((r) => r > 0).length / rets.length : null,
      min: has ? rets[0] : null,
      max: has ? rets[rets.length - 1] : null,
    };
  });

  return {
    score: today,
    band,
    recentShare: recent.filter((s) => inside(s, band)).length / recent.length,
    recentDays: recent.length,
    similar,
    smooth: {
      days: SMOOTH,
      value: avg[N - 1],
      band: avgBand,
      since: dates[current[0]],
      streakDays: N - current[0],
      pastDurations: avgRuns.slice(0, -1).map(([a, b]) => b - a + 1),
    },
    forward,
    vol: volatility(price),
  };
}
