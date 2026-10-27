import { useMemo, useState, type PointerEvent } from "react";
import { t } from "../i18n";
import { dateTickIndexes, fmtTime, linePath, logPriceScale, shortUsd, usd, useWidth } from "../lib/chart";
import type { CategoriesSeries } from "../lib/categories";
import { ROWS } from "../lib/categories";
import { bandColor } from "./Gauge";

const PAD_L = 8;
const PAD_T = 10;
const GAP = 14; // entre el precio y el mapa de calor
const AXIS_H = 22; // fechas
const CELL_W = 3; // ancho mínimo de cada columna del mapa: con muchos días, cada una agrupa varios (su media)

/**
 * Arriba, el precio (escala logarítmica) con los techos y suelos de ciclo marcados; debajo, un mapa de calor con el score
 * diario y la puntuación de cada categoría, del verde (barato) al rojo (caro), con los mismos tramos que el medidor.
 */
export function CategoriesChart({ data, marks }: { data: CategoriesSeries; marks: { time: number; top: boolean }[] }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const small = width < 600;
  const PAD_R = small ? 74 : 84; // eje de precio y nombres de las filas, a la derecha
  const priceH = small ? 150 : 200;
  const rowH = small ? 18 : 22;
  const plotW = width - PAD_L - PAD_R;
  const heatTop = PAD_T + priceH + GAP;
  const H = heatTop + ROWS.length * rowH + AXIS_H;
  const N = data.time.length;
  const x = (i: number) => PAD_L + (N > 1 ? (i / (N - 1)) * plotW : 0);

  const chart = useMemo(() => {
    const { y, ticks } = logPriceScale(data.price, PAD_T, priceH);
    // Columnas del mapa: media de los días de cada una, y tramos seguidos del mismo color unidos en un solo rectángulo
    const cols = Math.max(1, Math.min(N, Math.floor(plotW / CELL_W)));
    const colW = plotW / cols;
    const cells = ROWS.map((row) => {
      const out: { x: number; w: number; color: string }[] = [];
      for (let c = 0; c < cols; c++) {
        const vals = data[row].slice(Math.floor((c * N) / cols), Math.floor(((c + 1) * N) / cols)).filter((v): v is number => v !== null);
        if (!vals.length) continue;
        const color = bandColor(vals.reduce((a, b) => a + b, 0) / vals.length);
        const last = out.at(-1);
        const cx = PAD_L + c * colW;
        if (last && last.color === color && Math.abs(last.x + last.w - cx) < 0.01) last.w += colW;
        else out.push({ x: cx, w: colW, color });
      }
      return out;
    });
    return { y, ticks, price: linePath(data.price, x, y), cells };
  }, [data, plotW, priceH, N]);

  const dateTicks = useMemo(() => dateTickIndexes(N, plotW), [N, plotW]);
  const marksIn = marks
    .map((m) => ({ ...m, i: data.time.indexOf(m.time) }))
    .filter((m) => m.i >= 0);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.round(((e.clientX - r.left - PAD_L) / plotW) * (N - 1)))));
  };

  const h = hover ?? N - 1;
  const tx = t.catHistory;

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(data.time[h], "1d", true)}</span>
        <span className="legend legend-price num">
          {tx.priceLegend} <strong>{usd(data.price[h])}</strong>
        </span>
        {ROWS.map((row) => {
          const v = data[row][h];
          return (
            v !== null && (
              <span key={row} className="num cat-readout">
                <i style={{ background: bandColor(v) }} />
                {tx.short[row]} <strong>{Math.round(v)}</strong>
              </span>
            )
          );
        })}
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {/* Precio */}
        {chart.ticks.map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.y(p)} y2={chart.y(p)} className="grid" />
            <text x={PAD_L + plotW + 6} y={chart.y(p) + 4} className="axis">{shortUsd(p)}</text>
          </g>
        ))}
        <path d={chart.price} className="line-price" />
        {marksIn.map((m) => (
          <g key={m.time}>
            <line x1={x(m.i)} x2={x(m.i)} y1={PAD_T} y2={heatTop + ROWS.length * rowH} className={m.top ? "cat-mark top" : "cat-mark bottom"} />
            <circle cx={x(m.i)} cy={chart.y(data.price[m.i])} r="3.5" className={m.top ? "cat-dot top" : "cat-dot bottom"} />
          </g>
        ))}

        {/* Mapa de calor: una fila por serie */}
        {ROWS.map((row, r) => (
          <g key={row}>
            <rect x={PAD_L} y={heatTop + r * rowH} width={plotW} height={rowH - 2} className="cat-empty" />
            {chart.cells[r].map((c) => (
              <rect key={c.x} x={c.x} y={heatTop + r * rowH} width={c.w + 0.5} height={rowH - 2} style={{ fill: c.color }} />
            ))}
            <text x={PAD_L + plotW + 6} y={heatTop + r * rowH + rowH / 2 + 3} className={row === "score" ? "axis cat-label score" : "axis cat-label"}>
              {tx.short[row]}
            </text>
          </g>
        ))}

        {dateTicks.map((i, k) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={k === 0 ? "start" : k === dateTicks.length - 1 ? "end" : "middle"}>
            {fmtTime(data.time[i], "1d", false)}
          </text>
        ))}
        {hover !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={heatTop + ROWS.length * rowH} className="crosshair" />
            <circle cx={x(h)} cy={chart.y(data.price[h])} r="3.5" className="dot-price" />
          </>
        )}
      </svg>
    </div>
  );
}
