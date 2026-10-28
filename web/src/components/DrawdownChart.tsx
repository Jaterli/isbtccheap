import { useMemo, useState, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import { dateTickIndexes, fmtTime, linePath, logPriceScale, shortUsd, usd, useWidth } from "../lib/chart";
import type { DrawdownSeries } from "../lib/drawdown";

const PAD_L = 8;
const PAD_R = 56;
const PAD_T = 10;
const GAP = 18;
const AXIS_H = 22;
const DD_REFS = [0, -0.2, -0.5, -0.8, -1];

export const ddPct = (f: number) => t.percent(Math.round(f * 100).toLocaleString(locale));

export function DrawdownChart({ data }: { data: DrawdownSeries }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const small = width < 600;
  const priceH = small ? 190 : 250;
  const ddH = small ? 130 : 170;
  const plotW = width - PAD_L - PAD_R;
  const ddTop = PAD_T + priceH + GAP;
  const H = ddTop + ddH + AXIS_H;
  const N = data.time.length;
  const x = (i: number) => PAD_L + (N > 1 ? (i / (N - 1)) * plotW : 0);
  const yDd = (f: number) => ddTop - f * ddH;

  const chart = useMemo(() => {
    const { y, ticks } = logPriceScale([...data.price, ...data.ath], PAD_T, priceH);
    const ddLine = linePath(data.dd, x, yDd);
    return {
      y,
      ticks,
      price: linePath(data.price, x, y),
      ath: linePath(data.ath, x, y),
      ddLine,
      ddArea: N ? `${ddLine}L${x(N - 1).toFixed(1)},${ddTop}L${x(0).toFixed(1)},${ddTop}Z` : "",
    };
  }, [data, plotW, priceH, ddH, ddTop]);

  const dateTicks = useMemo(() => dateTickIndexes(N, plotW), [N, plotW]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.round(((e.clientX - r.left - PAD_L) / plotW) * (N - 1)))));
  };

  const h = hover ?? N - 1;
  const tx = t.drawdown;

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(data.time[h], "1d", true)}</span>
        <span className="legend legend-price num">
          {tx.legend.price} <strong>{usd(data.price[h])}</strong>
        </span>
        <span className="legend dd-ath num">
          {tx.legend.ath} <strong>{usd(data.ath[h])}</strong>
        </span>
        <span className="legend dd-fall num">
          {tx.legend.dd} <strong>{ddPct(data.dd[h])}</strong>
        </span>
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {chart.ticks.map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.y(p)} y2={chart.y(p)} className="grid" />
            <text x={PAD_L + plotW + 6} y={chart.y(p) + 4} className="axis">{shortUsd(p)}</text>
          </g>
        ))}
        <path d={chart.ath} className="dd-ath-line" />
        <path d={chart.price} className="line-price" />

        {DD_REFS.map((f) => (
          <g key={f}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={yDd(f)} y2={yDd(f)} className={f === 0 || f === -1 ? "grid" : "grid grid-ref"} />
            <text x={PAD_L + plotW + 6} y={yDd(f) + 4} className="axis">{ddPct(f)}</text>
          </g>
        ))}
        <path d={chart.ddArea} className="dd-area" />
        <path d={chart.ddLine} className="dd-line" />

        {dateTicks.map((i, k) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={k === 0 ? "start" : k === dateTicks.length - 1 ? "end" : "middle"}>
            {fmtTime(data.time[i], "1d", false)}
          </text>
        ))}
        {hover !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={ddTop + ddH} className="crosshair" />
            <circle cx={x(h)} cy={chart.y(data.price[h])} r="3.5" className="dot-price" />
            <circle cx={x(h)} cy={yDd(data.dd[h])} r="3.5" className="dd-dot" />
          </>
        )}
      </svg>
    </div>
  );
}
