import { getJson } from "./data";

export type CapLevel = "capitulation_levels" | "intense_capitulation";

const DAY = 86_400_000;
/** Día UTC (AAAA-MM-DD) de un instante: las velas de 1 h y 4 h caen en el día de capitulación de su fecha */
export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * El nivel de capitulación de cada día (capitulation.json del pipeline): el que daba la tarjeta de capitulación ese día,
 * no el más alto del episodio. Para sombrear esos días en las gráficas del SOPR y de la pérdida realizada.
 */
export async function capitulationDays(): Promise<Map<string, CapLevel>> {
  const c: { episodes?: { from: string; to: string; level: CapLevel; intense_days?: string[] }[] } = await getJson("capitulation.json");
  const days = new Map<string, CapLevel>();
  for (const e of c.episodes ?? []) {
    const intense = e.intense_days && new Set(e.intense_days);
    for (let d = Date.parse(`${e.from}T00:00:00Z`); d <= Date.parse(`${e.to}T00:00:00Z`); d += DAY) {
      const k = dayKey(d);
      // Sin intense_days (un capitulation.json anterior), el nivel del episodio
      days.set(k, !intense ? e.level : intense.has(k) ? "intense_capitulation" : "capitulation_levels");
    }
  }
  return days;
}
