import { useMemo, useState, type PointerEvent } from "react";
import { t } from "../i18n";
import type { Analysis, Direction } from "../lib/analysis";
import { fmtTime, niceTicks, shortUsd, usd, useWidth } from "../lib/chart";
import type { Candle } from "../types";

const PAD_L = 4;
const PAD_R = 58;
const PAD_T = 10;
const AXIS_H = 20;
// Parte derecha del gráfico, sin velas, para las flechas
const AHEAD = 0.24;

/**
 * Velas de 4 h con las zonas del análisis (soportes en verde, resistencias en rojo, más intensas las fuertes) y, desde
 * el último precio, una flecha continua hacia el objetivo más probable de las próximas horas y otra discontinua hacia
 * el alternativo. La línea corta discontinua marca el precio que invalidaría el escenario principal.
 */
export function AnalysisChart({ analysis: a, candles }: { analysis: Analysis; candles: Candle[] }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const tx = t.analysis;

  const n = Math.min(candles.length, width < 520 ? 54 : 96);
  const shown = candles.slice(-n);
  const H = width < 520 ? 300 : 400;
  const plotW = width - PAD_L - PAD_R;
  const plotH = H - PAD_T - AXIS_H;
  const candlesW = plotW * (1 - AHEAD);
  const step = candlesW / n;
  const x = (i: number) => PAD_L + (i + 0.5) * step;
  const xNow = x(n - 1);
  const xEnd = PAD_L + plotW - 8;
  const last = shown.at(-1)!;

  const chart = useMemo(() => {
    // Escala: las velas, las dos zonas más cercanas de cada lado y los precios de los escenarios
    const near = a.levels.filter((l) => /[12]$/.test(l.id));
    const vals = [
      ...shown.flatMap((c) => [c.high, c.low]),
      ...near.flatMap((l) => [l.low, l.high]),
      a.outlook.target,
      a.alternative.target,
      ...(a.outlook.invalidation ? [a.outlook.invalidation] : []),
    ];
    const pad = (Math.max(...vals) - Math.min(...vals)) * 0.06;
    const lo = Math.min(...vals) - pad;
    const hi = Math.max(...vals) + pad;
    const y = (v: number) => PAD_T + plotH - ((v - lo) / (hi - lo)) * plotH;
    return { y, lo, hi, ticks: niceTicks(lo, hi, 5) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, shown[0]?.time, last.close, plotH]);

  const { y } = chart;
  const bodyW = Math.max(1, step * 0.62);
  const h = hover ?? n - 1;
  const cls = (d: Direction) => (d === "alcista" ? "up" : d === "bajista" ? "down" : "flat");

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - PAD_L) / step);
    setHover(i >= 0 && i < n ? i : null);
  };

  // Curva suave desde el precio actual hasta el objetivo
  const arrow = (target: number, d: Direction, primary: boolean) => {
    const y0 = y(last.close);
    const y1 = y(target);
    const path = `M${xNow},${y0} C${xNow + (xEnd - xNow) * 0.45},${y0} ${xEnd - (xEnd - xNow) * 0.4},${y1} ${xEnd},${y1}`;
    return <path d={path} className={`an-arrow ${cls(d)}${primary ? " primary" : ""}`} markerEnd={`url(#an-head-${cls(d)})`} />;
  };

  return (
    <div className="an-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(shown[h].time, "4h", true)}</span>
        <span className="legend legend-price num">
          {tx.close} <strong>{usd(shown[h].close)}</strong>
        </span>
        <span className="muted small">{tx.legendStyle}</span>
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          {(["up", "down", "flat"] as const).map((c) => (
            <marker key={c} id={`an-head-${c}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" className={`an-head ${c}`} />
            </marker>
          ))}
        </defs>

        {chart.ticks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD_L + plotW + 6} y={y(v) + 4} className="axis">{shortUsd(v)}</text>
          </g>
        ))}

        {a.levels
          .filter((l) => l.high >= chart.lo && l.low <= chart.hi)
          .map((l) => {
            const top = y(Math.min(l.high, chart.hi));
            const bottom = y(Math.max(l.low, chart.lo));
            return (
              <g key={l.id} className={`an-zone ${l.kind} s${l.strength}`}>
                <rect x={PAD_L} width={plotW} y={top} height={Math.max(2, bottom - top)} />
                <text x={PAD_L + 6} y={top + 12}>{l.id}</text>
              </g>
            );
          })}

        <rect x={PAD_L + candlesW} width={plotW - candlesW} y={PAD_T} height={plotH} className="an-ahead" />
        <text x={(PAD_L + candlesW + xEnd) / 2} y={PAD_T + 14} className="axis" textAnchor="middle">
          {tx.ahead(a.outlook.horizon_hours)}
        </text>

        {shown.map((c, i) => {
          const up = c.close >= c.open;
          return (
            <g key={c.time} className={up ? "an-candle up" : "an-candle down"}>
              <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} />
              <rect x={x(i) - bodyW / 2} width={bodyW} y={y(Math.max(c.open, c.close))} height={Math.max(1, Math.abs(y(c.open) - y(c.close)))} />
            </g>
          );
        })}

        {a.outlook.invalidation !== null && (
          <g className="an-invalid">
            <line x1={xNow + 6} x2={xEnd} y1={y(a.outlook.invalidation)} y2={y(a.outlook.invalidation)} />
            <text x={xEnd} y={y(a.outlook.invalidation) + (a.outlook.invalidation > last.close ? -5 : 13)} textAnchor="end">
              {tx.invalidation}
            </text>
          </g>
        )}
        {arrow(a.alternative.target, a.alternative.direction, false)}
        {arrow(a.outlook.target, a.outlook.direction, true)}
        <circle cx={xNow} cy={y(last.close)} r="4" className="dot-price" />

        {[0, Math.floor(n / 2), n - 1].map((i, k) => (
          <text key={i} x={x(i)} y={H - 4} className="axis" textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}>
            {fmtTime(shown[i].time, "4h", false)}
          </text>
        ))}

        {hover !== null && <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />}
      </svg>
    </div>
  );
}
