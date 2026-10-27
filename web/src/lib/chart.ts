import { useEffect, useRef, useState } from "react";
import { locale } from "../i18n";
import { isIntraday, type CandleTf } from "./series";

/** Utilidades comunes de las gráficas de las páginas de volatilidad y Bollinger */

export const shortUsd = (p: number) =>
  p >= 1000 ? `$${(p / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : `$${p.toFixed(p < 10 ? 2 : 0)}`;

/** Marcas "bonitas" para un eje lineal entre lo y hi. */
export function niceTicks(lo: number, hi: number, count: number) {
  const step0 = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0)!;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

/** Fecha del eje (corta) o de la lectura (larga): con hora en 1 h y 4 h, sin ella en 1 día y 1 semana. */
export function fmtTime(ms: number, tf: CandleTf, long: boolean) {
  const intraday = isIntraday(tf);
  const opts: Intl.DateTimeFormatOptions = long
    ? { day: "numeric", month: "short", year: "numeric", ...(intraday && { hour: "2-digit", minute: "2-digit" }) }
    : intraday
      ? { day: "numeric", month: "short" }
      : { month: "short", year: "2-digit" };
  return new Date(ms).toLocaleString(locale, opts);
}

/**
 * Escala logarítmica de precio para un panel que empieza en `top` y mide `height`, con un margen del 6 %.
 * Marcas: si el rango abarca más de ×2, potencias de 10 y sus ×2 y ×5; si es estrecho (1 h, 4 h) ahí no cae ninguna
 * y se usan marcas lineales.
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
  } else ticks = niceTicks(10 ** lo, 10 ** hi, 4);
  return { y, ticks: ticks.slice(-6) };
}

/** Línea SVG que salta los huecos (valores null, p. ej. antes de tener velas suficientes para el indicador). */
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

/** Ancho disponible del contenedor, para que la gráfica ocupe la tarjeta. */
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

/** Marcas de fecha repartidas a lo ancho: una cada ~110 px. */
export const dateTickIndexes = (n: number, plotW: number) => {
  const count = Math.max(2, Math.floor(plotW / 110));
  return Array.from({ length: count }, (_, k) => Math.round((k / (count - 1)) * (n - 1)));
};
