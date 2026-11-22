import type { History } from "../types";

// Tamaños de 5 en 5 hasta la mayor caída del periodo (las subidas usan los mismos: desde el mínimo de un periodo largo
// llegan a cientos de %)
const STEP = 0.05;
// Casos en el periodo para calcular lo habitual y el percentil (y resaltar)
const MIN_COUNT = 3;

/** La mayor caída desde máximo del periodo, en cierres: la mayor que ha llegado a contarse */
function maxDrop(price: number[], fromIndex: number) {
  let hi = price[fromIndex];
  let worst = 0;
  for (let i = fromIndex + 1; i < price.length; i++) {
    hi = Math.max(hi, price[i]);
    worst = Math.max(worst, 1 - price[i] / hi);
  }
  return worst;
}

/** 5 %, 10 %… hasta la mayor caída del periodo redondeada hacia abajo (como poco, 5 %) */
export function moveSizes(price: number[], fromIndex: number) {
  // El épsilon evita que un 50 % exacto se quede en 45 % por redondeo
  const n = Math.max(1, Math.floor(maxDrop(price, fromIndex) / STEP + 1e-9));
  return Array.from({ length: n }, (_, k) => Math.round((k + 1) * STEP * 100) / 100);
}

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
  /** Desde dónde mide ahora: el máximo (caídas) o mínimo (subidas) desde su último caso, o desde el inicio del periodo */
  ref: number;
  refDate: string;
}

/**
 * Una caída del 10 % se cuenta cuando el cierre queda un 10 % por debajo del máximo desde la anterior caída de ese
 * tamaño, y se vuelve a medir desde ese cierre. Las subidas, igual desde el mínimo.
 */
function moves(price: number[], dates: string[], fromIndex: number, down: boolean, sizes: number[]): MoveStats[] {
  const N = price.length;
  return sizes.map((size) => {
    let count = 0;
    let last: number | null = null;
    const ages: number[] = [];
    let ref = price[fromIndex];
    let iRef = fromIndex;
    for (let i = fromIndex + 1; i < N; i++) {
      if (down ? price[i] > ref : price[i] < ref) {
        ref = price[i];
        iRef = i;
      }
      const hit = down ? price[i] <= ref * (1 - size) : price[i] >= ref * (1 + size);
      if (hit) {
        count++;
        last = i;
        ref = price[i];
        iRef = i;
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
      // Con menos de MIN_COUNT casos no hay «habitual»: solo se compara con los días posteriores al primero, y hoy sería
      // siempre el que más tiempo lleva (percentil 100 en la mayor caída del periodo)
      typical: past.length && count >= MIN_COUNT ? past[Math.floor(past.length / 2)] : null,
      percentile: past.length && daysSince !== null && count >= MIN_COUNT ? (past.filter((a) => a < daysSince).length / past.length) * 100 : null,
      ref,
      refDate: dates[iRef],
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

/**
 * Dónde está hoy el precio frente a la referencia de la fila más grande de la tabla: el máximo desde la última caída de
 * ese tamaño (o desde el inicio del periodo si no la hubo) y el mínimo desde la última subida de ese tamaño
 */
export interface MovesNow {
  size: number;
  drop: number;
  high: number;
  highDate: string;
  /** Fecha de la última caída de ese tamaño (null: ninguna en el periodo, se mide desde su inicio) */
  dropSince: string | null;
  rise: number;
  low: number;
  lowDate: string;
  riseSince: string | null;
}

function movesNow(price: number[], drops: MoveStats[], rallies: MoveStats[]): MovesNow {
  const d = drops[drops.length - 1];
  const r = rallies[rallies.length - 1];
  const now = price[price.length - 1];
  return { size: d.size, drop: 1 - now / d.ref, high: d.ref, highDate: d.refDate, dropSince: d.last,
           rise: now / r.ref - 1, low: r.ref, lowDate: r.refDate, riseSince: r.last };
}

export function computeMoves(history: History, fromIndex = 0) {
  const { price, dates } = history;
  if (price.length < 2) return null;
  const sizes = moveSizes(price, fromIndex);
  const drops = moves(price, dates, fromIndex, true, sizes);
  const rallies = moves(price, dates, fromIndex, false, sizes);
  return { drops, rallies, now: movesNow(price, drops, rallies) };
}
