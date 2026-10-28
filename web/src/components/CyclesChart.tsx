import { useMemo, useState, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import { linePath, useWidth } from "../lib/chart";
import { CYCLE_DAYS, multAt, type Cycle } from "../lib/cycles";

const PAD_L = 8;
const PAD_R = 44;
const PAD_T = 10;
const AXIS_H = 22;

const TICKS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];

/** ×1,23 · ×13,4 · ×92 */
export const fmtMult = (m: number) => `×${m.toLocaleString(locale, { maximumSignificantDigits: 3 })}`;

/** Un ciclo por línea: múltiplo del precio del día de su halving frente a los días transcurridos desde él. */
export function CyclesChart({ cycles, today }: { cycles: Cycle[]; today: number }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const H = (width < 600 ? 260 : 360) + PAD_T + AXIS_H;
  const plotH = H - PAD_T - AXIS_H;
  const plotW = width - PAD_L - PAD_R;
  const x = (d: number) => PAD_L + (d / CYCLE_DAYS) * plotW;

  const chart = useMemo(() => {
    const logs = cycles.flatMap((c) => c.mult).map(Math.log10);
    const lo = Math.min(0, ...logs); // ×1 (el precio del halving) siempre a la vista
    const hi = Math.max(...logs);
    const pad = (hi - lo || 0.1) * 0.05;
    const y = (m: number) => PAD_T + plotH - ((Math.log10(m) - (lo - pad)) / (hi - lo + 2 * pad)) * plotH;
    let ticks = TICKS.filter((v) => Math.log10(v) >= lo - pad && Math.log10(v) <= hi + pad);
    // Con mucho rango (el ciclo de 2012 llegó a ×92), solo los ×1 y ×5 de cada potencia de 10
    if (ticks.length > 7) ticks = ticks.filter((v) => Math.round(v / 10 ** Math.floor(Math.log10(v))) !== 2);
    return { y, ticks, lines: cycles.map((c) => linePath(c.mult, (i) => x(c.day[i]), y)) };
  }, [cycles, plotW, plotH]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(CYCLE_DAYS, Math.max(0, Math.round(((e.clientX - r.left - PAD_L) / plotW) * CYCLE_DAYS))));
  };

  const h = hover ?? today;
  const tx = t.cycles;

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{tx.dayN(h)}</span>
        {cycles.map((c) => {
          const m = multAt(c, h);
          return (
            m !== null && (
              <span key={c.year} className={`legend cycle-${c.year} num`}>
                {c.year} <strong>{fmtMult(m)}</strong>
              </span>
            )
          );
        })}
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {chart.ticks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.y(v)} y2={chart.y(v)} className={v === 1 ? "grid grid-ref" : "grid"} />
            <text x={PAD_L + plotW + 6} y={chart.y(v) + 4} className="axis">{fmtMult(v)}</text>
          </g>
        ))}
        {[0, 1, 2, 3, 4].map((yr) => (
          <g key={yr}>
            {yr > 0 && <line x1={x(yr * 365.25)} x2={x(yr * 365.25)} y1={PAD_T} y2={PAD_T + plotH} className="grid" />}
            <text x={x(yr * 365.25)} y={H - 6} className="axis" textAnchor={yr === 0 ? "start" : yr === 4 ? "end" : "middle"}>
              {tx.yearN(yr)}
            </text>
          </g>
        ))}
        <line x1={x(today)} x2={x(today)} y1={PAD_T} y2={PAD_T + plotH} className="cycle-today" />
        <text x={x(today) + 4} y={PAD_T + 10} className="axis">{tx.today}</text>

        {cycles.map((c, i) => (
          <path key={c.year} d={chart.lines[i]} className={`cycle-line cycle-${c.year}${c.current ? " current" : ""}`} />
        ))}
        {cycles.map((c) => (
          <circle key={c.year} cx={x(c.peak.day)} cy={chart.y(c.peak.mult)} r="4" className={`cycle-peak cycle-${c.year}`}>
            <title>{tx.peakTitle(c.year, c.peak.day, fmtMult(c.peak.mult))}</title>
          </circle>
        ))}

        {hover !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />
            {cycles.map((c) => {
              const m = multAt(c, h);
              return m !== null && <circle key={c.year} cx={x(h)} cy={chart.y(m)} r="3.5" className={`cycle-dot cycle-${c.year}`} />;
            })}
          </>
        )}
      </svg>
    </div>
  );
}
