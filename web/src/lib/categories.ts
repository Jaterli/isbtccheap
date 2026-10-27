import type { CategoryId, History } from "../types";
import type { PriceSeries } from "./series";

/** categories.json del pipeline: la puntuación diaria de cada categoría, con las mismas fechas que history.json */
export interface CategoriesJson {
  start: string;
  categories: Record<CategoryId, (number | null)[]>;
}

/** Filas del mapa de calor: el score diario y las cinco categorías, en el orden de la tarjeta del índice */
export const ROWS = ["score", "valoracion", "ciclo", "liquidez", "sentimiento", "tecnico"] as const;
export type Row = (typeof ROWS)[number];

export type CategoriesSeries = PriceSeries & Record<Row, (number | null)[]>;

/**
 * Une history.json (precio y score) y categories.json. Si uno llega con un día más que el otro (la caché de GitHub puede
 * servir uno ya actualizado y el otro no), se recortan a los días comunes; si no empiezan igual, null.
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
