import { useEffect, useRef, useState } from "react";
import { locale } from "../i18n";
import { isIntraday, type CandleTf } from "./series";


export const shortUsd = (p: number) =>
  p >= 1000 ? `$${(p / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : `$${p.toFixed(p < 10 ? 2 : 0)}`;

let measureCtx: CanvasRenderingContext2D | null | undefined;
/** Ancho en px de un texto de los ejes (.axis: 11 px con la fuente de la página), normal o en negrita */
function axisTextWidth(s: string, bold = false) {
  if (measureCtx === undefined) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return s.length * (bold ? 7 : 6.5);
  measureCtx.font = `${bold ? "700 " : ""}11px ${getComputedStyle(document.body).fontFamily}`;
  return measureCtx.measureText(s).width;
}

/**
 * Margen lateral para las etiquetas de un eje, a la medida de la más ancha: los 6 px que las separan del gráfico más
 * un pequeño respiro hasta el borde. Así el hueco sobrante no depende de lo largas que sean las cifras.
 */
export const axisPad = (labels: string[], bold: string[] = []) =>
  Math.ceil(6 + Math.max(0, ...labels.map((s) => axisTextWidth(s)), ...bold.map((s) => axisTextWidth(s, true))) + 4);

export const usd = (p: number) => p.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: p < 100 ? 2 : 0 });

export function niceTicks(lo: number, hi: number, count: number) {
  const step0 = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0)!;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

/** Fecha del eje (corta) o de la lectura (larga). En el eje, año completo: "jul 10" se leería como un día. */
export function fmtTime(ms: number, tf: CandleTf, long: boolean) {
  const intraday = isIntraday(tf);
  const opts: Intl.DateTimeFormatOptions = long
    ? { day: "numeric", month: "short", year: "numeric", ...(intraday && { hour: "2-digit", minute: "2-digit" }) }
    : intraday
      ? { day: "numeric", month: "short" }
      : { month: "short", year: "numeric" };
  return new Date(ms).toLocaleString(locale, opts);
}

/**
 * Escala logarítmica con un margen del 6 %. Marcas en 1, 2 y 5 de cada potencia de 10 (solo potencias si hay muchas);
 * en rangos estrechos (1 h, 4 h) no cae ninguna y se usan lineales.
 */
export function logPriceScale(values: number[], top: number, height: number) {
  const logs = values.filter((v) => v > 0).map(Math.log10);
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  const pad = (hi - lo || 0.1) * 0.06;
  const y = (p: number) => top + height - ((Math.log10(p) - (lo - pad)) / (hi - lo + 2 * pad)) * height;
  let ticks: number[] = [];
  if (hi - lo > Math.log10(2)) {
    for (let e = Math.floor(lo - pad); e <= Math.ceil(hi + pad); e++)
      for (const m of [1, 2, 5]) {
        const v = m * 10 ** e;
        if (Math.log10(v) >= lo - pad && Math.log10(v) <= hi + pad) ticks.push(v);
      }
    if (ticks.length > 7) ticks = ticks.filter((v) => Math.round(v / 10 ** Math.floor(Math.log10(v) + 1e-9)) !== 2);
    if (ticks.length > 7) ticks = ticks.filter((v) => Math.round(v / 10 ** Math.floor(Math.log10(v) + 1e-9)) === 1);
  } else ticks = niceTicks(10 ** lo, 10 ** hi, 4);
  return { y, ticks };
}

/** Línea SVG que salta los huecos (valores null). */
export function linePath(values: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) return void (pen = false);
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

export function useWidth(min = 280) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(min, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return { ref, width };
}

export const dateTickIndexes = (n: number, plotW: number) => {
  const count = Math.max(2, Math.floor(plotW / 110));
  return Array.from({ length: count }, (_, k) => Math.round((k / (count - 1)) * (n - 1)));
};
