import { useMemo, useState, type PointerEvent } from "react";
import { t } from "../i18n";
import { dateTickIndexes, fmtTime, linePath, logPriceScale, shortUsd, usd, useWidth } from "../lib/chart";
import type { PhaseSeries } from "../lib/phase";

const PAD_L = 8;
const PAD_R = 56;
const PAD_T = 10;
const STRIP_GAP = 8;
const STRIP_H = 12;
const AXIS_H = 22;

/** Tramos seguidos de la misma fase: [inicio, fin, fase] */
function runs(phase: (1 | -1 | null)[]) {
  const out: [number, number, 1 | -1][] = [];
  phase.forEach((f, i) => {
    if (f === null) return;
    const last = out.at(-1);
    if (last && last[2] === f && last[1] === i - 1) last[1] = i;
    else out.push([i, i, f]);
  });
  return out;
}

/**
 * Precio de BTC y precio realizado de corto plazo (escala logarítmica) con el fondo de la fase de tendencia, y debajo
 * una franja con la fase de la liquidez global.
 */
export function PhaseChart({ data }: { data: PhaseSeries }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const plotH = width < 600 ? 260 : 340;
  const plotW = width - PAD_L - PAD_R;
  const stripTop = PAD_T + plotH + STRIP_GAP;
  const H = stripTop + STRIP_H + AXIS_H;
  const N = data.time.length;
  const x = (i: number) => PAD_L + (N > 1 ? (i / (N - 1)) * plotW : 0);

  const chart = useMemo(() => {
    const values = [...data.price, ...data.sth.filter((v): v is number => v !== null && v > 0)];
    const { y, ticks } = logPriceScale(values, PAD_T, plotH);
    return {
      y,
      ticks,
      trendRuns: runs(data.trend),
      liqRuns: runs(data.liquidity),
      price: linePath(data.price, x, y),
      sth: linePath(data.sth.map((v) => (v !== null && v > 0 ? v : null)), x, y),
    };
  }, [data, plotW, plotH]);

  const dateTicks = useMemo(() => dateTickIndexes(N, plotW), [N, plotW]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.round(((e.clientX - r.left - PAD_L) / plotW) * (N - 1)))));
  };

  const h = hover ?? N - 1;
  const tx = t.phase;
  const name = (f: 1 | -1 | null, kind: "trend" | "liquidity") => (f === null ? "—" : tx.names[kind][f === 1 ? "up" : "down"]);
  const w = (a: number, b: number) => Math.max(1, x(b) - x(a) + plotW / Math.max(1, N - 1));

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(data.time[h], "1d", true)}</span>
        <span className="legend legend-price num">
          {tx.legend.price} <strong>{usd(data.price[h])}</strong>
        </span>
        {data.sth[h] !== null && (
          <span className="legend phase-sth num">
            {tx.legend.sth} <strong>{usd(data.sth[h]!)}</strong>
          </span>
        )}
        <span className={`phase-tag ${data.trend[h] === 1 ? "up" : data.trend[h] === -1 ? "down" : ""}`}>
          {tx.legend.trend} <strong>{name(data.trend[h], "trend")}</strong>
        </span>
        <span className={`phase-tag ${data.liquidity[h] === 1 ? "up" : data.liquidity[h] === -1 ? "down" : ""}`}>
          {tx.legend.liquidity} <strong>{name(data.liquidity[h], "liquidity")}</strong>
        </span>
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {chart.trendRuns.map(([a, b, f]) => (
          <rect key={a} x={x(a)} y={PAD_T} width={w(a, b)} height={plotH} className={f === 1 ? "phase-bg up" : "phase-bg down"} />
        ))}
        {chart.ticks.map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.y(p)} y2={chart.y(p)} className="grid" />
            <text x={PAD_L + plotW + 6} y={chart.y(p) + 4} className="axis">{shortUsd(p)}</text>
          </g>
        ))}
        <path d={chart.sth} className="phase-sth-line" />
        <path d={chart.price} className="line-price" />

        {chart.liqRuns.map(([a, b, f]) => (
          <rect key={a} x={x(a)} y={stripTop} width={w(a, b)} height={STRIP_H} className={f === 1 ? "phase-strip up" : "phase-strip down"} />
        ))}
        <text x={PAD_L + plotW + 6} y={stripTop + STRIP_H - 2} className="axis">{tx.stripLabel}</text>

        {dateTicks.map((i, k) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={k === 0 ? "start" : k === dateTicks.length - 1 ? "end" : "middle"}>
            {fmtTime(data.time[i], "1d", false)}
          </text>
        ))}
        {hover !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={stripTop + STRIP_H} className="crosshair" />
            <circle cx={x(h)} cy={chart.y(data.price[h])} r="3.5" className="dot-price" />
          </>
        )}
      </svg>
    </div>
  );
}
