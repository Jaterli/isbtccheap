import { useMemo, useState, type PointerEvent } from "react";
import { t } from "../i18n";
import type { Analysis, ChartTf, Direction } from "../lib/analysis";
import { axisPad, fmtTime, niceTicks, shortUsd, usd, useWidth } from "../lib/chart";
import type { Candle } from "../types";

const PAD_L = 4;
const PAD_T = 10;
const AXIS_H = 20;
// Parte derecha del gráfico, sin velas, para las flechas: el primer tramo son las próximas horas; el resto, 1-2 días
const AHEAD = 0.3;
const HOURS_PART = 0.45;

/**
 * Velas de 4 h con las zonas del análisis (soportes en verde, resistencias en rojo, más intensas las fuertes) y, desde
 * el último precio, una flecha continua hacia el objetivo más probable de las próximas horas que sigue hasta el de 1-2
 * días, y otra discontinua hacia el alternativo. La línea corta discontinua marca el precio que invalidaría el escenario
 * de las próximas horas.
 */
export function AnalysisChart({ analysis: a, candles, tf }: { analysis: Analysis; candles: Candle[]; tf: ChartTf }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const tx = t.analysis;

  // En diario, unos 6 meses (3 en móvil) y sin flechas: es para ver qué niveles se han superado o perdido
  const daily = tf === "1d";
  const n = Math.min(candles.length, daily ? (width < 520 ? 90 : 180) : width < 520 ? 54 : 96);
  const shown = candles.slice(-n);
  const H = width < 520 ? 300 : 400;
  const plotH = H - PAD_T - AXIS_H;
  const days = a.outlook_days;
  const last = shown.at(-1)!;

  const chart = useMemo(() => {
    // Escala: las velas, las dos zonas más cercanas de cada lado y los precios de los escenarios
    const near = a.levels.filter((l) => /[12]$/.test(l.id));
    const vals = [
      ...shown.flatMap((c) => [c.high, c.low]),
      ...near.flatMap((l) => [l.low, l.high]),
      ...(daily
        ? []
        : [a.outlook.target, a.alternative.target, ...(days ? [days.target] : []), ...(a.outlook.invalidation ? [a.outlook.invalidation] : [])]),
    ];
    const pad = (Math.max(...vals) - Math.min(...vals)) * 0.06;
    const lo = Math.min(...vals) - pad;
    const hi = Math.max(...vals) + pad;
    const y = (v: number) => PAD_T + plotH - ((v - lo) / (hi - lo)) * plotH;
    return { y, lo, hi, ticks: niceTicks(lo, hi, 5) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, shown[0]?.time, last.close, plotH, daily]);

  const { y } = chart;
  const plotW = width - PAD_L - axisPad(chart.ticks.map(shortUsd));
  const candlesW = plotW * (daily ? 1 : 1 - AHEAD);
  const step = candlesW / n;
  const x = (i: number) => PAD_L + (i + 0.5) * step;
  const xNow = x(n - 1);
  const xEnd = PAD_L + plotW - 8;
  // Sin valoración a 1-2 días (análisis anteriores), las flechas de las próximas horas llegan al final
  const xMid = days ? xNow + (xEnd - xNow) * HOURS_PART : xEnd;
  const bodyW = Math.max(1, step * 0.62);
  // Liquidez pendiente e imbalances de la temporalidad del gráfico, solo los que caen dentro de la escala
  const pools = (a.liquidity?.pools[tf] ?? []).filter((p) => p.price >= chart.lo && p.price <= chart.hi);
  const gaps = (a.liquidity?.imbalances[tf] ?? []).filter((g) => g.high >= chart.lo && g.low <= chart.hi);
  // Niveles de Fibonacci de los que sale algún objetivo o invalidación: líneas, no zonas
  const fibs = (a.fibonacci ?? []).filter((f) => f.price >= chart.lo && f.price <= chart.hi);
  // x de la vela de un día (AAAA-MM-DD); si es anterior a las mostradas, el borde izquierdo
  const xAt = (d: string) => {
    const k = shown.findIndex((c) => c.time >= Date.parse(`${d}T00:00:00Z`));
    return k <= 0 ? PAD_L : x(k);
  };
  const h = hover ?? n - 1;
  const cls = (d: Direction) => (d === "alcista" ? "up" : d === "bajista" ? "down" : "flat");

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - PAD_L) / step);
    setHover(i >= 0 && i < n ? i : null);
  };

  // Curva suave de un precio a otro
  const arrow = (x0: number, from: number, x1: number, to: number, d: Direction, primary: boolean) => {
    const y0 = y(from);
    const y1 = y(to);
    const path = `M${x0},${y0} C${x0 + (x1 - x0) * 0.45},${y0} ${x1 - (x1 - x0) * 0.4},${y1} ${x1},${y1}`;
    return <path d={path} className={`an-arrow ${cls(d)}${primary ? " primary" : ""}`} markerEnd={`url(#an-head-${cls(d)})`} />;
  };

  return (
    <div className="an-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(shown[h].time, tf, true)}</span>
        <span className="legend legend-price num">
          {tx.close} <strong>{usd(shown[h].close)}</strong>
        </span>
        {!daily && <span className="muted small">{tx.legendStyle}</span>}
        {(pools.length > 0 || gaps.length > 0) && <span className="muted small">{tx.legendLiquidity}</span>}
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

        {/* Imbalances sin rellenar (bandas) y liquidez pendiente (líneas discontinuas) de esta temporalidad, desde su vela */}
        {gaps.map((g) => {
          const top = y(Math.min(g.high, chart.hi));
          const x0 = xAt(g.date);
          return <rect key={`${g.date}-${g.low}`} x={x0} width={PAD_L + candlesW - x0} y={top} height={Math.max(2, y(Math.max(g.low, chart.lo)) - top)} className="an-gap" />;
        })}
        {pools.map((p) => {
          const x0 = xAt(p.dates[0]);
          const right = PAD_L + candlesW - 4;
          return (
            <g key={`${p.side}-${p.price}`} className="an-liq">
              <line x1={x0} x2={right} y1={y(p.price)} y2={y(p.price)} />
              <text x={right} y={y(p.price) + (p.side === "above" ? -4 : 11)} textAnchor="end">
                {p.equal_levels ? (p.side === "above" ? tx.equalHighs : tx.equalLows) : tx.liquidityLabel}
              </text>
            </g>
          );
        })}

        {fibs.map((f) => (
          <g key={`${f.timeframe}-${f.leg}-${f.ratio}`} className="an-fib">
            {/* Desde el día en que empieza el tramo (o el borde izquierdo, si es anterior a las velas mostradas) */}
            <line x1={f.from ? xAt(f.from) : PAD_L} x2={PAD_L + plotW} y1={y(f.price)} y2={y(f.price)} />
            {/* Centrada en la zona de velas: a la derecha la tapaban los rótulos de los plazos ("Próximas … h", "1-2 días") */}
            <text x={PAD_L + candlesW / 2} y={y(f.price) - 4} textAnchor="middle">
              {tx.fibLabel(f.ratio, f.timeframe, f.leg === "correction", usd(f.price))}
            </text>
          </g>
        ))}

        {!daily && (
          <>
            <rect x={PAD_L + candlesW} width={plotW - candlesW} y={PAD_T} height={plotH} className="an-ahead" />
            {/* En pantallas estrechas los tramos no dan para la etiqueta larga */}
            <text x={(xNow + xMid) / 2} y={PAD_T + 14} className="axis" textAnchor="middle">
              {xMid - xNow < 90 ? tx.aheadShort(a.outlook.horizon_hours) : tx.ahead(a.outlook.horizon_hours)}
            </text>
            {days && (
              <>
                <line x1={xMid} x2={xMid} y1={PAD_T} y2={PAD_T + plotH} className="grid grid-ref" />
                <text x={(xMid + xEnd) / 2} y={PAD_T + 14} className="axis" textAnchor="middle">
                  {xEnd - xMid < 70 ? tx.daysShort : tx.days}
                </text>
              </>
            )}
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

        {!daily && a.outlook.invalidation !== null && (
          <g className="an-invalid">
            <line x1={xNow + 6} x2={xMid} y1={y(a.outlook.invalidation)} y2={y(a.outlook.invalidation)} />
            <text x={xMid} y={y(a.outlook.invalidation) + (a.outlook.invalidation > last.close ? -5 : 13)} textAnchor="end">
              {tx.invalidation}
            </text>
          </g>
        )}
        {!daily && (
          <>
            {arrow(xNow, last.close, xMid, a.alternative.target, a.alternative.direction, false)}
            {days && arrow(xMid, a.outlook.target, xEnd, days.target, days.direction, true)}
            {arrow(xNow, last.close, xMid, a.outlook.target, a.outlook.direction, true)}
            {days && <circle cx={xMid} cy={y(a.outlook.target)} r="3" className={`an-node ${cls(a.outlook.direction)}`} />}
          </>
        )}
        <circle cx={xNow} cy={y(last.close)} r="4" className="dot-price" />

        {[0, Math.floor(n / 2), n - 1].map((i, k) => (
          <text key={i} x={x(i)} y={H - 4} className="axis" textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}>
            {fmtTime(shown[i].time, tf, false)}
          </text>
        ))}

        {hover !== null && <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />}
      </svg>
    </div>
  );
}
