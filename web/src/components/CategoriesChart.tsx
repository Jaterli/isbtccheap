import { useMemo, useState, type PointerEvent } from "react";
import { t } from "../i18n";
import { axisPad, dateTickIndexes, fmtTime, linePath, logPriceScale, shortUsd, usd, useWidth } from "../lib/chart";
import type { CategoriesSeries } from "../lib/categories";
import { ROWS } from "../lib/categories";
import type { PriceSeries } from "../lib/series";
import { bandColor } from "./Gauge";

const PAD_L = 8;
const PAD_T = 10;
const GAP = 14;
const AXIS_H = 22;
const CELL_W = 3; // ancho mínimo de columna: con muchos días, cada una es la media de varios

/** Precio y, para cada fila del mapa, una serie de puntuaciones de 0 a 100 con las mismas fechas (puede llevar más campos) */
export type HeatmapSeries = PriceSeries;
const rowOf = (data: HeatmapSeries, row: string) => (data as unknown as Record<string, (number | null)[]>)[row];

interface HeatmapProps {
  data: HeatmapSeries;
  /** Filas del mapa, de arriba abajo, con su nombre; la de `bold` se resalta */
  rows: readonly string[];
  labels: Record<string, string>;
  bold?: string;
  /** Texto extra de cada fila en la lectura (p. ej. el valor de la métrica), o null */
  detail?: (row: string, i: number) => string | null;
  /** Líneas verticales: techos (rojo) y suelos (verde) */
  marks?: { time: number; top: boolean }[];
  aria: string;
}

/** Precio arriba y, debajo, un mapa de calor de puntuaciones de 0 a 100 con los mismos tramos de color que el medidor. */
export function HeatmapChart({ data, rows, labels, bold, detail, marks = [], aria }: HeatmapProps) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const small = width < 600;
  const priceH = small ? 150 : 200;
  const rowH = small ? 18 : 22;
  const scale = useMemo(() => logPriceScale(data.price, PAD_T, priceH), [data, priceH]);
  // A la derecha, el eje de precio y los nombres de las filas (el resaltado, en negrita)
  const plotW = width - PAD_L - axisPad([...scale.ticks.map(shortUsd), ...rows.filter((r) => r !== bold).map((r) => labels[r])], bold ? [labels[bold]] : []);
  const heatTop = PAD_T + priceH + GAP;
  const H = heatTop + rows.length * rowH + AXIS_H;
  const N = data.time.length;
  const x = (i: number) => PAD_L + (N > 1 ? (i / (N - 1)) * plotW : 0);

  const chart = useMemo(() => {
    const { y, ticks } = scale;
    // Los tramos seguidos del mismo color se unen en un solo rectángulo
    const cols = Math.max(1, Math.min(N, Math.floor(plotW / CELL_W)));
    const colW = plotW / cols;
    const cells = rows.map((row) => {
      const out: { x: number; w: number; color: string }[] = [];
      for (let c = 0; c < cols; c++) {
        const vals = rowOf(data, row).slice(Math.floor((c * N) / cols), Math.floor(((c + 1) * N) / cols)).filter((v): v is number => v !== null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, scale, plotW, N, rows.join()]);

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
        {rows.map((row) => {
          const v = rowOf(data, row)[h];
          const extra = detail?.(row, h);
          return (
            v !== null && (
              <span key={row} className="num cat-readout">
                <i style={{ background: bandColor(v) }} />
                {labels[row]} <strong>{Math.round(v)}</strong>
                {extra && <span className="muted"> ({extra})</span>}
              </span>
            )
          );
        })}
      </p>
      <svg width={width} height={H} role="img" aria-label={aria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {chart.ticks.map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.y(p)} y2={chart.y(p)} className="grid" />
            <text x={PAD_L + plotW + 6} y={chart.y(p) + 4} className="axis">{shortUsd(p)}</text>
          </g>
        ))}
        <path d={chart.price} className="line-price" />
        {marksIn.map((m) => (
          <g key={m.time}>
            <line x1={x(m.i)} x2={x(m.i)} y1={PAD_T} y2={heatTop + rows.length * rowH} className={m.top ? "cat-mark top" : "cat-mark bottom"} />
            <circle cx={x(m.i)} cy={chart.y(data.price[m.i])} r="3.5" className={m.top ? "cat-dot top" : "cat-dot bottom"} />
          </g>
        ))}

        {rows.map((row, r) => (
          <g key={row}>
            <rect x={PAD_L} y={heatTop + r * rowH} width={plotW} height={rowH - 2} className="cat-empty" />
            {chart.cells[r].map((c) => (
              <rect key={c.x} x={c.x} y={heatTop + r * rowH} width={c.w + 0.5} height={rowH - 2} style={{ fill: c.color }} />
            ))}
            <text x={PAD_L + plotW + 6} y={heatTop + r * rowH + rowH / 2 + 3} className={row === bold ? "axis cat-label score" : "axis cat-label"}>
              {labels[row]}
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
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={heatTop + rows.length * rowH} className="crosshair" />
            <circle cx={x(h)} cy={chart.y(data.price[h])} r="3.5" className="dot-price" />
          </>
        )}
      </svg>
    </div>
  );
}

/** El histórico del score y sus cinco categorías */
export function CategoriesChart({ data, marks }: { data: CategoriesSeries; marks: { time: number; top: boolean }[] }) {
  return <HeatmapChart data={data} rows={ROWS} labels={t.catHistory.short} bold="score" marks={marks} aria={t.catHistory.chartAria} />;
}
