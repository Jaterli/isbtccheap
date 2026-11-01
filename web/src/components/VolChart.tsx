import { useMemo, useState, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import { axisPad, dateTickIndexes, fmtTime, linePath, logPriceScale, niceTicks, shortUsd, useWidth } from "../lib/chart";
import type { CandleTf } from "../lib/series";
import type { VolSeries } from "../lib/volatility";

const PAD_T = 10;
const AXIS_H = 22;

const pct = (v: number, digits = 0) => t.percent((v * 100).toLocaleString(locale, { maximumFractionDigits: digits }));

export function VolChart({ data, tf }: { data: VolSeries; tf: CandleTf }) {
  const { ref: wrapRef, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const H = width < 600 ? 260 : 360;
  const plotH = H - PAD_T - AXIS_H;
  // Escalas verticales: la volatilidad (eje izquierdo) y el precio (derecho)
  const scale = useMemo(() => {
    const vMax = Math.max(...data.vol.filter((v): v is number => v !== null), 0.01) * 1.08;
    const { y: yPrice, ticks: priceTicks } = logPriceScale(data.price, PAD_T, plotH);
    return { vMax, yVol: (v: number) => PAD_T + plotH - (v / vMax) * plotH, volTicks: niceTicks(0, vMax, 4), yPrice, priceTicks };
  }, [data, plotH]);
  const PAD_L = axisPad(scale.volTicks.map((v) => pct(v)));
  const plotW = width - PAD_L - axisPad(scale.priceTicks.map(shortUsd));
  const N = data.time.length;
  const x = (i: number) => PAD_L + (N > 1 ? (i / (N - 1)) * plotW : 0);

  const chart = useMemo(() => {
    const { yVol, yPrice } = scale;
    const volLine = linePath(data.vol, x, yVol);
    const first = data.vol.findIndex((v) => v !== null);
    const volArea = first < 0 ? "" : `${volLine}L${x(N - 1).toFixed(1)},${PAD_T + plotH}L${x(first).toFixed(1)},${PAD_T + plotH}Z`;
    const priceLine = data.price.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yPrice(p).toFixed(1)}`).join("");

    return { ...scale, volLine, volArea, priceLine };
  }, [data, scale, plotW, PAD_L]);

  const dateTicks = useMemo(() => dateTickIndexes(N, plotW), [N, plotW]);

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
