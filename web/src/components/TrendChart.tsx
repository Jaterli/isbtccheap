import { useMemo, useState, type PointerEvent } from "react";
import { t } from "../i18n";
import type { Direction, Trend } from "../lib/analysis";
import { axisPad, fmtTime, niceTicks, shortUsd, usd, useWidth } from "../lib/chart";
import type { Candle } from "../types";

const PAD_L = 4;
const PAD_T = 10;
const AXIS_H = 20;
// Dos referencias más cerca que esto (en proporción del precio) se solapan: se dibuja solo la más importante
const MIN_GAP = 0.015;
// Parte derecha, sin velas, para las flechas de las próximas 2-4 semanas
const AHEAD = 0.18;

/**
 * Velas semanales (unos 2 años; 1 en móvil) hasta la revisión de la tendencia de fondo, con sus dos niveles de revisión
 * (los cierres diarios que la harían revisar), como referencia el máximo histórico y el máximo y el mínimo de 12 meses y,
 * desde el último precio, una flecha continua hacia lo más probable en 2-4 semanas y otra discontinua hacia la alternativa.
 */
export function TrendChart({ trend, candles }: { trend: Trend; candles: Candle[] }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const tx = t.analysis;

  const n = Math.min(candles.length, width < 520 ? 52 : 104);
  const shown = candles.slice(-n);
  const H = width < 520 ? 260 : 340;
  const plotH = H - PAD_T - AXIS_H;
  const last = shown.at(-1)!;

  // Las líneas, de la más importante a la menos: los niveles de revisión y, si no se solapan con ellos, las referencias
  const lines = useMemo(() => {
    const out: { key: string; price: number; label: string; cls: string }[] = [
      { key: "above", price: trend.review_above.price, label: tx.trendReviewAbove(usd(trend.review_above.price)), cls: "an-review above" },
      { key: "below", price: trend.review_below.price, label: tx.trendReviewBelow(usd(trend.review_below.price)), cls: "an-review below" },
    ];
    const refs = trend.references ?? {};
    const extra = [
      refs.all_time_high && { key: "ath", price: refs.all_time_high.price, label: tx.trendAth(usd(refs.all_time_high.price)), cls: "an-ref" },
      refs.high_12m && { key: "h12", price: refs.high_12m.price, label: tx.trendHigh12m(usd(refs.high_12m.price)), cls: "an-ref" },
      refs.low_12m && { key: "l12", price: refs.low_12m.price, label: tx.trendLow12m(usd(refs.low_12m.price)), cls: "an-ref" },
    ];
    for (const r of extra) if (r && out.every((o) => Math.abs(o.price / r.price - 1) >= MIN_GAP)) out.push(r);
    return out;
  }, [trend, tx]);

  const chart = useMemo(() => {
    const vals = [
      ...shown.flatMap((c) => [c.high, c.low]),
      ...lines.map((l) => l.price),
      ...[trend.outlook, trend.alternative].flatMap((s) => (s ? [s.target] : [])),
    ];
    const pad = (Math.max(...vals) - Math.min(...vals)) * 0.06;
    const lo = Math.min(...vals) - pad;
    const hi = Math.max(...vals) + pad;
    const y = (v: number) => PAD_T + plotH - ((v - lo) / (hi - lo)) * plotH;
    return { y, ticks: niceTicks(lo, hi, 5) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown[0]?.time, last.close, lines, plotH, trend]);

  const { y } = chart;
  const plotW = width - PAD_L - axisPad(chart.ticks.map(shortUsd));
  // Sin escenarios (primeras revisiones), las velas ocupan todo el ancho
  const ahead = trend.outlook && trend.alternative;
  const candlesW = plotW * (ahead ? 1 - AHEAD : 1);
  const step = candlesW / n;
  const x = (i: number) => PAD_L + (i + 0.5) * step;
  const bodyW = Math.max(1, step * 0.62);
  const h = hover ?? n - 1;
  const xNow = x(n - 1);
  const xEnd = PAD_L + plotW - 8;
  const cls = (d: Direction) => (d === "alcista" ? "up" : d === "bajista" ? "down" : "flat");
  // Curva suave de un precio a otro, como en el gráfico del análisis
  const arrow = (to: number, d: Direction, primary: boolean) => {
    const y0 = y(last.close);
    const y1 = y(to);
    const path = `M${xNow},${y0} C${xNow + (xEnd - xNow) * 0.45},${y0} ${xEnd - (xEnd - xNow) * 0.4},${y1} ${xEnd},${y1}`;
    return <path d={path} className={`an-arrow ${cls(d)}${primary ? " primary" : ""}`} markerEnd={`url(#tr-head-${cls(d)})`} />;
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - PAD_L) / step);
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <div className="an-chart an-trend-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{tx.trendWeekOf(fmtTime(shown[h].time, "1d", true))}</span>
        <span className="legend legend-price num">
          {tx.close} <strong>{usd(shown[h].close)}</strong>
        </span>
        <span className="muted small">{tx.trendLegend}</span>
        {ahead && <span className="muted small">{tx.legendStyle}</span>}
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.trendChartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {/* Puntas propias: los id del gráfico del análisis están en la misma página */}
        <defs>
          {(["up", "down", "flat"] as const).map((c) => (
            <marker key={c} id={`tr-head-${c}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
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

        {lines.map((l) => (
          <g key={l.key} className={l.cls}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={y(l.price)} y2={y(l.price)} />
            {/* Encima de la línea, salvo el nivel de abajo, que va debajo para no chocar con las velas */}
            <text x={PAD_L + 6} y={y(l.price) + (l.key === "below" ? 12 : -4)}>{l.label}</text>
          </g>
        ))}

        {ahead && (
          <>
            <rect x={PAD_L + candlesW} width={plotW - candlesW} y={PAD_T} height={plotH} className="an-ahead" />
            <text x={(xNow + xEnd) / 2} y={PAD_T + 14} className="axis" textAnchor="middle">
              {tx.trendAhead}
            </text>
          </>
        )}

        {shown.map((c, i) => {
          const up = c.close >= c.open;
          return (
            <g key={c.time} className={up ? "an-candle up" : "an-candle down"}>
              <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} />
              <rect x={x(i) - bodyW / 2} width={bodyW} y={y(Math.max(c.open, c.close))} height={Math.max(1, Math.abs(y(c.open) - y(c.close)))} />
            </g>
          );
        })}
        {trend.outlook && trend.alternative && (
          <>
            {arrow(trend.alternative.target, trend.alternative.direction, false)}
            {arrow(trend.outlook.target, trend.outlook.direction, true)}
          </>
        )}
        <circle cx={xNow} cy={y(last.close)} r="4" className="dot-price" />

        {[0, Math.floor(n / 2), n - 1].map((i, k) => (
          <text key={i} x={x(i)} y={H - 4} className="axis" textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}>
            {fmtTime(shown[i].time, "1w", false)}
          </text>
        ))}

        {hover !== null && <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />}
      </svg>
    </div>
  );
}
