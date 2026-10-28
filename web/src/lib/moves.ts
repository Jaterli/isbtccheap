import type { History } from "../types";

export const MOVE_SIZES = [0.05, 0.1, 0.15, 0.2, 0.3];

export interface MoveStats {
  size: number;
  count: number;
  /** Días desde la última vez (hasta el último cierre del histórico); null si no ocurrió en el periodo */
  daysSince: number | null;
  last: string | null;
  /**
   * Lo habitual: mediana de los días que llevaba sin producirse en cada día anterior del periodo. No la media entre
   * casos: llegan en rachas y la hunden
   */
  typical: number | null;
  /** Porcentaje de días del periodo que llevaban menos tiempo sin producirse que hoy */
  percentile: number | null;
}

/**
 * Una caída del 10 % se cuenta cuando el cierre queda un 10 % por debajo del máximo desde la anterior caída de ese
 * tamaño, y se vuelve a medir desde ese cierre. Las subidas, igual desde el mínimo.
 */
function moves(price: number[], dates: string[], fromIndex: number, down: boolean): MoveStats[] {
  const N = price.length;
  return MOVE_SIZES.map((size) => {
    let count = 0;
    let last: number | null = null;
    const ages: number[] = [];
    let ref = price[fromIndex];
    for (let i = fromIndex + 1; i < N; i++) {
      ref = down ? Math.max(ref, price[i]) : Math.min(ref, price[i]);
      const hit = down ? price[i] <= ref * (1 - size) : price[i] >= ref * (1 + size);
      if (hit) {
        count++;
        last = i;
        ref = price[i];
      }
      if (last !== null) ages.push(i - last);
    }
    const past = ages.slice(0, -1).sort((a, b) => a - b);
    // Por fecha: el último punto puede ser el precio de hoy, con un día sin cierre en medio
    const daysSince = last === null ? null : Math.round((Date.parse(dates[N - 1]) - Date.parse(dates[last])) / 86_400_000);
    return {
      size,
      count,
      daysSince,
      last: last === null ? null : dates[last],
      typical: past.length ? past[Math.floor(past.length / 2)] : null,
      percentile: past.length && daysSince !== null ? (past.filter((a) => a < daysSince).length / past.length) * 100 : null,
    };
  });
}

/** Histórico con el precio actual como último punto: el histórico va un día por detrás. */
export function withLivePrice(history: History, live: number | null): History {
  const today = new Date().toISOString().slice(0, 10);
  const last = history.dates.length - 1;
  if (live === null || last < 0 || history.dates[last] >= today) return history;
  return {
    dates: [...history.dates, today],
    price: [...history.price, live],
    score: [...history.score, history.score[last]],
  };
}

export function computeMoves(history: History, fromIndex = 0) {
  const { price, dates } = history;
  if (price.length < 2) return null;
  return { drops: moves(price, dates, fromIndex, true), rallies: moves(price, dates, fromIndex, false) };
}
