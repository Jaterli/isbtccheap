import { useMemo, useState, type PointerEvent } from "react";
import { t } from "../i18n";
import { scenarioPrices, type Analysis } from "../lib/analysis";
import { fmtTime, niceTicks, shortUsd, usd, useWidth } from "../lib/chart";
import type { Candle } from "../types";

const PAD_L = 4;
const PAD_R = 58;
const PAD_T = 10;
const AXIS_H = 20;
// Parte derecha del gráfico, sin velas, para las flechas de los escenarios
const AHEAD = 0.26;

/**
 * Velas de 4 h con las zonas de soporte (verde) y resistencia (rojo) del análisis, más intensas las clave, y desde el
 * último precio una flecha por escenario: hasta la zona que lo activaría y de ahí a su objetivo. La del escenario más
 * probable va continua; la otra, discontinua.
 */
export function AnalysisChart({ analysis: a, candles }: { analysis: Analysis; candles: Candle[] }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const tx = t.analysis;

  const n = Math.min(candles.length, width < 520 ? 60 : 108);
  const shown = candles.slice(-n);
  const H = width < 520 ? 300 : 400;
  const plotW = width - PAD_L - PAD_R;
  const plotH = H - PAD_T - AXIS_H;
  const candlesW = plotW * (1 - AHEAD);
  const step = candlesW / n;
  const x = (i: number) => PAD_L + (i + 0.5) * step;
  const xNow = x(n - 1);
  const xEnd = PAD_L + plotW - 8;

  const chart = useMemo(() => {
    const paths = (["bull", "bear"] as const).map((side) => ({ side, p: scenarioPrices(a, side) }));
    const keyIds = new Set([...a.key_supports, ...a.key_resistances]);
    // Escala: las velas, las zonas clave y los objetivos de los escenarios
    const vals = [
      ...shown.flatMap((c) => [c.high, c.low]),
      ...a.levels.filter((l) => keyIds.has(l.id)).flatMap((l) => [l.low, l.high]),
      ...paths.flatMap(({ p }) => (p ? [p.trigger, p.target] : [])),
    ];
    const lo0 = Math.min(...vals);
    const hi0 = Math.max(...vals);
    const pad = (hi0 - lo0) * 0.06;
    const lo = lo0 - pad;
    const hi = hi0 + pad;
    const y = (v: number) => PAD_T + plotH - ((v - lo) / (hi - lo)) * plotH;
    return { y, lo, hi, keyIds, paths, ticks: niceTicks(lo, hi, 5) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, shown[0]?.time, shown.at(-1)?.close, plotH]);

  const { y } = chart;
  const last = shown.at(-1)!;
  const bodyW = Math.max(1, step * 0.62);
  const h = hover ?? n - 1;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - PAD_L) / step);
    setHover(i >= 0 && i < n ? i : null);
  };

  const arrow = (side: "bull" | "bear", p: { trigger: number; target: number }) => {
    const primary = a.primary === side;
    // Tramo hasta la zona que activa el escenario y, desde ella, hasta el objetivo
    const x1 = xNow + (xEnd - xNow) * 0.4;
    const d = `M${xNow},${y(last.close)} L${x1},${y(p.trigger)} L${xEnd},${y(p.target)}`;
    return (
      <path
        key={side}
        d={d}
        className={`an-arrow ${side}${primary ? " primary" : ""}`}
        markerEnd={`url(#an-head-${side})`}
      />
    );
  };

  return (
    <div className="an-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(shown[h].time, "4h", true)}</span>
        <span className="legend legend-price num">
          {tx.close} <strong>{usd(shown[h].close)}</strong>
        </span>
        <span className="legend an-legend-bull">{tx.legendBull}</span>
        <span className="legend an-legend-bear">{tx.legendBear}</span>
        <span className="muted small">{tx.legendStyle}</span>
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          {(["bull", "bear"] as const).map((s) => (
            <marker key={s} id={`an-head-${s}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" className={`an-head ${s}`} />
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
            const key = chart.keyIds.has(l.id);
            const top = y(Math.min(l.high, chart.hi));
            const bottom = y(Math.max(l.low, chart.lo));
            return (
              <g key={l.id} className={`an-zone ${l.kind}${key ? " key" : ""}`}>
                <rect x={PAD_L} width={plotW} y={top} height={Math.max(2, bottom - top)} />
                <text x={PAD_L + 6} y={top + 12}>{l.id}</text>
              </g>
            );
          })}

        <rect x={PAD_L + candlesW} width={plotW - candlesW} y={PAD_T} height={plotH} className="an-ahead" />

        {shown.map((c, i) => {
          const up = c.close >= c.open;
          return (
            <g key={c.time} className={up ? "an-candle up" : "an-candle down"}>
              <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} />
              <rect x={x(i) - bodyW / 2} width={bodyW} y={y(Math.max(c.open, c.close))} height={Math.max(1, Math.abs(y(c.open) - y(c.close)))} />
            </g>
          );
        })}

        {chart.paths.map(({ side, p }) => p && a.primary !== side && arrow(side, p))}
        {chart.paths.map(({ side, p }) => p && a.primary === side && arrow(side, p))}
        <circle cx={xNow} cy={y(last.close)} r="4" className="dot-price" />

        {[0, Math.floor(n / 2), n - 1].map((i, k) => (
          <text key={i} x={x(i)} y={H - 4} className="axis" textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}>
            {fmtTime(shown[i].time, "4h", false)}
          </text>
        ))}
        <text x={(PAD_L + candlesW + xEnd) / 2} y={PAD_T + 14} className="axis" textAnchor="middle">{tx.ahead}</text>

        {hover !== null && <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />}
      </svg>
    </div>
  );
}
