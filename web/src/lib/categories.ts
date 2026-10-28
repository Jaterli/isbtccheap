import type { CategoryId, History } from "../types";
import type { PriceSeries } from "./series";

/** categories.json: mismas fechas que history.json */
export interface CategoriesJson {
  start: string;
  categories: Record<CategoryId, (number | null)[]>;
}

export const ROWS = ["score", "valoracion", "ciclo", "liquidez", "sentimiento", "tecnico"] as const;
export type Row = (typeof ROWS)[number];

export type CategoriesSeries = PriceSeries & Record<Row, (number | null)[]>;

/**
 * Une history.json y categories.json. La caché de GitHub puede servir uno con un día más que el otro: se recortan a los
 * días comunes.
 */
export function categoriesSeries(h: History, c: CategoriesJson): CategoriesSeries | null {
  if (h.dates[0] !== c.start) return null;
  const n = Math.min(h.dates.length, c.categories.valoracion.length);
  const cats = Object.fromEntries(Object.entries(c.categories).map(([k, v]) => [k, v.slice(0, n)])) as CategoriesJson["categories"];
  return {
    time: h.dates.slice(0, n).map((d) => Date.parse(`${d}T00:00:00Z`)),
    price: h.price.slice(0, n),
    score: h.score.slice(0, n),
    ...cats,
  };
}
