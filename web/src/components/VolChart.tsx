import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import type { VolSeries, VolTf } from "../lib/volatility";

const PAD_L = 44; // eje de la volatilidad (%)
const PAD_R = 56; // eje del precio ($)
const PAD_T = 10;
const AXIS_H = 22; // fechas

const shortUsd = (p: number) =>
  p >= 1000 ? `$${(p / 1000).toLocaleString("en-US", { maximumFractionDigits: p < 10_000 ? 1 : 1 })}k` : `$${p.toFixed(p < 10 ? 2 : 0)}`;
const pct = (v: number, digits = 0) => t.percent((v * 100).toLocaleString(locale, { maximumFractionDigits: digits }));

/** Marcas "bonitas" para un eje lineal entre lo y hi. */
function niceTicks(lo: number, hi: number, count: number) {
  const step0 = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0)!;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

/** Fecha del eje y de la lectura según el tamaño de vela: con hora en 1 h y 4 h, sin ella en 1 día y 1 semana. */
function fmtTime(ms: number, tf: VolTf, long: boolean) {
  const intraday = tf === "1h" || tf === "4h";
  const opts: Intl.DateTimeFormatOptions = long
    ? { day: "numeric", month: "short", year: "numeric", ...(intraday && { hour: "2-digit", minute: "2-digit" }) }
    : intraday
      ? { day: "numeric", month: "short" }
      : { month: "short", year: "2-digit" };
  return new Date(ms).toLocaleString(locale, opts);
}

/** Volatilidad realizada (área naranja, eje izquierdo en %) y precio (línea azul, eje derecho logarítmico en $). */
export function VolChart({ data, tf }: { data: VolSeries; tf: VolTf }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = width < 600 ? 260 : 360;
  const plotW = width - PAD_L - PAD_R;
  const plotH = H - PAD_T - AXIS_H;
  const N = data.time.length;
  const x = (i: number) => PAD_L + (N > 1 ? (i / (N - 1)) * plotW : 0);

  const chart = useMemo(() => {
    const vols = data.vol.filter((v): v is number => v !== null);
    const vMax = Math.max(...vols, 0.01) * 1.08;
    const yVol = (v: number) => PAD_T + plotH - (v / vMax) * plotH;
    const logs = data.price.map((p) => Math.log10(p));
    const lo = Math.min(...logs);
    const hi = Math.max(...logs);
    const pad = (hi - lo || 0.1) * 0.06;
    const yPrice = (p: number) => PAD_T + plotH - ((Math.log10(p) - (lo - pad)) / (hi - lo + 2 * pad)) * plotH;

    let volLine = "";
    let first = -1;
    data.vol.forEach((v, i) => {
      if (v === null) return;
      volLine += `${first < 0 ? "M" : "L"}${x(i).toFixed(1)},${yVol(v).toFixed(1)}`;
      if (first < 0) first = i;
    });
    const volArea = first < 0 ? "" : `${volLine}L${x(N - 1).toFixed(1)},${PAD_T + plotH}L${x(first).toFixed(1)},${PAD_T + plotH}Z`;
    const priceLine = data.price.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yPrice(p).toFixed(1)}`).join("");

    // Precio: si el rango abarca más de ×2, potencias de 10 y sus ×2 y ×5; si es estrecho (1 h, 4 h), ahí no cae
    // ninguna y se usan marcas lineales. Volatilidad: marcas lineales
    let priceTicks: number[] = [];
    if (hi - lo > Math.log10(2)) {
      for (let e = Math.floor(lo - pad); e <= Math.ceil(hi + pad); e++)
        for (const m of [1, 2, 5]) {
          const v = m * 10 ** e;
          if (Math.log10(v) >= lo - pad && Math.log10(v) <= hi + pad) priceTicks.push(v);
        }
    } else priceTicks = niceTicks(10 ** lo, 10 ** hi, 4);
    return { yVol, yPrice, volLine, volArea, priceLine, volTicks: niceTicks(0, vMax, 4), priceTicks: priceTicks.slice(-6) };
  }, [data, plotW, plotH]);

  const dateTicks = useMemo(() => {
    const count = Math.max(2, Math.floor(plotW / 110));
    return Array.from({ length: count }, (_, k) => Math.round((k / (count - 1)) * (N - 1)));
  }, [N, plotW]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - PAD_L) / plotW) * (N - 1));
    setHover(Math.min(N - 1, Math.max(0, i)));
  };

  const h = hover ?? N - 1;
  const v = data.vol[h];

  return (
    <div className="vol-chart" ref={wrapRef}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(data.time[h], tf, true)}</span>
        <span className="legend legend-price num">
          {t.vol.priceLegend}{" "}
          <strong>{data.price[h].toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</strong>
        </span>
        <span className="legend legend-score num">
          {t.vol.volLegend} <strong>{v === null ? "—" : pct(v, 1)}</strong>
        </span>
      </p>
      <svg width={width} height={H} role="img" aria-label={t.vol.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {chart.volTicks.map((tv) => (
          <g key={tv}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.yVol(tv)} y2={chart.yVol(tv)} className="grid" />
            <text x={PAD_L - 6} y={chart.yVol(tv) + 4} className="axis" textAnchor="end">{pct(tv)}</text>
          </g>
        ))}
        {chart.priceTicks.map((p) => (
          <text key={p} x={PAD_L + plotW + 6} y={chart.yPrice(p) + 4} className="axis">{shortUsd(p)}</text>
        ))}
        <path d={chart.volArea} className="vol-area" />
        <path d={chart.volLine} className="line-score" />
        <path d={chart.priceLine} className="line-price" />
        {dateTicks.map((i, k) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={k === 0 ? "start" : k === dateTicks.length - 1 ? "end" : "middle"}>
            {fmtTime(data.time[i], tf, false)}
          </text>
        ))}
        {hover !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />
            <circle cx={x(h)} cy={chart.yPrice(data.price[h])} r="3.5" className="dot-price" />
            {v !== null && <circle cx={x(h)} cy={chart.yVol(v)} r="3.5" className="dot-score" />}
          </>
        )}
      </svg>
    </div>
  );
}
