import { useMemo, useState, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import { fmtTime, linePath, logPriceScale, shortUsd, usd, useWidth } from "../lib/chart";
import type { Timeframe } from "../types";

const PAD_L = 4;
const PAD_R = 46;
const PAD_T = 6;
const AXIS_H = 18;

// Velas que se dibujan por temporalidad (en mensual, todo desde 2011)
const VISIBLE: Record<Timeframe, number> = { "1h": 168, "4h": 180, "1d": 365, "1w": 208, "1M": Infinity };

export interface Closes {
  time: number[];
  close: number[];
}

/** Precio de cierre de las últimas velas de la temporalidad elegida en el medidor. */
export function PriceCard({ tf, data }: { tf: Timeframe; data: Closes | null }) {
  const { ref, width } = useWidth(200);
  const [hover, setHover] = useState<number | null>(null);
  const tx = t.priceCard;
  const axisTf = tf === "1M" ? "1w" : tf;

  const view = useMemo(() => {
    if (!data || data.close.length < 2) return null;
    const from = Math.max(0, data.close.length - VISIBLE[tf]);
    return { time: data.time.slice(from), close: data.close.slice(from) };
  }, [data, tf]);

  const H = width < 520 ? 130 : 150;
  const plotH = H - PAD_T - AXIS_H;
  const plotW = width - PAD_L - PAD_R;
  const N = view?.close.length ?? 0;
  const x = (i: number) => PAD_L + (i / Math.max(1, N - 1)) * plotW;

  const chart = useMemo(() => {
    if (!view) return null;
    const { y, ticks } = logPriceScale(view.close, PAD_T, plotH);
    const line = linePath(view.close, x, y);
    const area = `${line}L${x(N - 1).toFixed(1)},${PAD_T + plotH}L${x(0).toFixed(1)},${PAD_T + plotH}Z`;
    return { y, ticks: ticks.length > 4 ? ticks.filter((_, k) => k % 2 === 0) : ticks, line, area };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, plotW, plotH]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.round(((e.clientX - r.left - PAD_L) / plotW) * (N - 1)))));
  };

  const h = hover ?? N - 1;
  const change = view ? view.close[N - 1] / view.close[0] - 1 : null;

  return (
    <article className="card price-card">
      <header>
        <h3>{tx.title}</h3>
        <span className="muted small">{tx.period[tf]}</span>
      </header>
      <div ref={ref}>
        {view && chart ? (
          <>
            <p className="chart-readout">
              <span className="muted num">{fmtTime(view.time[h], axisTf, true)}</span>
              <span className="legend legend-price num">
                <strong>{usd(view.close[h])}</strong>
              </span>
              {hover === null && change !== null && (
                <span className={`num ${change > 0 ? "up" : change < 0 ? "down" : ""}`}>
                  {change > 0 ? "+" : change < 0 ? "−" : ""}
                  {t.percent(Math.abs(change * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }))}
                </span>
              )}
            </p>
            <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
              {chart.ticks.map((p) => (
                <g key={p}>
                  <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.y(p)} y2={chart.y(p)} className="grid" />
                  <text x={PAD_L + plotW + 6} y={chart.y(p) + 4} className="axis">{shortUsd(p)}</text>
                </g>
              ))}
              <path d={chart.area} className="price-area" />
              <path d={chart.line} className="line-price" />
              {[0, N - 1].map((i, k) => (
                <text key={i} x={x(i)} y={H - 4} className="axis" textAnchor={k === 0 ? "start" : "end"}>
                  {fmtTime(view.time[i], axisTf, false)}
                </text>
              ))}
              {hover !== null && (
                <>
                  <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />
                  <circle cx={x(h)} cy={chart.y(view.close[h])} r="3.5" className="dot-price" />
                </>
              )}
            </svg>
          </>
        ) : (
          <p className="muted price-card-empty">{t.loading}</p>
        )}
      </div>
    </article>
  );
}
