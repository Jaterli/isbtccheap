import type { Candle, Category, CategoryId, Latest } from "../types";
import { fetchCandles } from "./binance";
import type { CategoriesJson } from "./categories";
import { getJson } from "./data";
import { computeScore, technicalFromCandles } from "./score";

const DAY = 86_400_000;
const POINTS = 182 * 6;
// Las mismas velas que usa el score en vivo
const WINDOW = 1000;
const TTL = 15 * 60_000;

export interface History4h {
  /** Apertura de cada vela de 4 h (ms) */
  time: number[];
  price: number[];
  score: number[];
}

/**
 * Score de 4 h de los últimos 6 meses, vela a vela y con lo que se sabía en cada momento: el técnico con las 1000 velas
 * anteriores y el resto (sentimiento incluido) con los datos diarios del día anterior (el pipeline los publica de
 * madrugada).
 */
export function build4h(candles: Candle[], cats: CategoriesJson, latest: Latest): History4h {
  const start = Date.parse(`${cats.start}T00:00:00Z`);
  const last = cats.categories.valoracion.length - 1;
  const out: History4h = { time: [], price: [], score: [] };

  for (let k = Math.max(WINDOW - 1, candles.length - POINTS); k < candles.length; k++) {
    const c = candles[k];
    const row = Math.floor((c.time - start) / DAY) - 1;
    const categories =
      row >= last
        ? latest.categories
        : (Object.fromEntries(
            Object.entries(latest.categories).map(([id, cat]) => [id, { ...cat, metrics: [] as Category["metrics"], score: cats.categories[id as CategoryId][row] ?? cat.score }]),
          ) as Record<CategoryId, Category>);


    const technical = technicalFromCandles(candles.slice(k - WINDOW + 1, k + 1), "4h");
    const { score } = computeScore({ ...latest, categories }, "4h", technical);
    if (score === null) continue;
    out.time.push(c.time);
    out.price.push(c.close);
    out.score.push(score);
  }
  return out;
}

let cache: { at: number; data: Promise<History4h> } | null = null;

export function load4h(latest: Latest): Promise<History4h> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  const data = (async () => {
    const [recent, cats] = await Promise.all([
      fetchCandles("4h", WINDOW),
      getJson("categories.json") as Promise<CategoriesJson>,
    ]);
    // Binance da como mucho 1000 velas por petición
    let candles = recent;
    while (candles.length < WINDOW + POINTS - 1) {
      const older = await fetchCandles("4h", Math.min(1000, WINDOW + POINTS - 1 - candles.length), candles[0].time - 1);
      if (!older.length) break;
      candles = [...older, ...candles];
    }
    return build4h(candles, cats, latest);
  })();
  cache = { at: Date.now(), data };
  data.catch(() => (cache = null));
  return data;
}
