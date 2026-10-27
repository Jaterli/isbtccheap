import { useMemo, useState, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import { dateTickIndexes, fmtTime, linePath, logPriceScale, shortUsd, useWidth } from "../lib/chart";
import type { ValuationSeries } from "../lib/valuation";

const PAD_L = 8;
const PAD_R = 56; // eje de precio, a la derecha
const PAD_T = 10;
const AXIS_H = 22; // fechas

export const usd = (p: number) => p.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: p < 100 ? 2 : 0 });

/**
 * El precio de BTC (escala logarítmica) con sus niveles de referencia: precio realizado, media de 200 semanas y la
 * tendencia de la power law con su corredor sombreado.
 */
export function ValuationChart({ data }: { data: ValuationSeries }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const plotH = width < 600 ? 280 : 380;
  const plotW = width - PAD_L - PAD_R;
  const H = PAD_T + plotH + AXIS_H;
  const N = data.time.length;
  const x = (i: number) => PAD_L + (N > 1 ? (i / (N - 1)) * plotW : 0);

  const chart = useMemo(() => {
    // La escala se ajusta al precio y los niveles cercanos; lo que se sale se recorta: el techo del corredor, muy arriba,
    // y el precio realizado de 2010, de céntimos
    const values = [...data.price, ...data.wma200, ...data.trend, ...data.low].filter((v): v is number => v !== null);
    const { y, ticks } = logPriceScale(values, PAD_T, plotH);
    const pt = (i: number, v: number) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    const corridor = N
      ? `M${data.high.map((v, i) => pt(i, v)).join("L")}L${data.low.map((_, k) => pt(N - 1 - k, data.low[N - 1 - k])).join("L")}Z`
      : "";
    return {
      y,
      ticks,
      corridor,
      high: linePath(data.high, x, y),
      low: linePath(data.low, x, y),
      trend: linePath(data.trend, x, y),
      wma: linePath(data.wma200, x, y),
      realized: linePath(data.realized, x, y),
      price: linePath(data.price, x, y),
    };
  }, [data, plotW, plotH]);

  const dateTicks = useMemo(() => dateTickIndexes(N, plotW), [N, plotW]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.round(((e.clientX - r.left - PAD_L) / plotW) * (N - 1)))));
  };

  const h = hover ?? N - 1;
  const tx = t.valuation;
  const readout: [string, number | null][] = [
    ["price", data.price[h]],
    ["realized", data.realized[h]],
    ["wma", data.wma200[h]],
    ["trend", data.trend[h]],
  ];

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(data.time[h], "1d", true)}</span>
        {readout.map(
          ([k, v]) =>
            v !== null && (
              <span key={k} className={`legend val-${k} num`}>
                {tx.legend[k]} <strong>{usd(v)}</strong>
              </span>
            ),
        )}
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <clipPath id="val-plot">
            <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} />
          </clipPath>
        </defs>
        {chart.ticks.map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.y(p)} y2={chart.y(p)} className="grid" />
            <text x={PAD_L + plotW + 6} y={chart.y(p) + 4} className="axis">{shortUsd(p)}</text>
          </g>
        ))}
        <g clipPath="url(#val-plot)">
          <path d={chart.corridor} className="val-corridor" />
          <path d={chart.high} className="val-edge" />
          <path d={chart.low} className="val-edge" />
          <path d={chart.trend} className="val-line val-trend" />
          <path d={chart.wma} className="val-line val-wma" />
          <path d={chart.realized} className="val-line val-realized" />
          <path d={chart.price} className="line-price" />
        </g>

        {dateTicks.map((i, k) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={k === 0 ? "start" : k === dateTicks.length - 1 ? "end" : "middle"}>
            {fmtTime(data.time[i], "1d", false)}
          </text>
        ))}
        {hover !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />
            <circle cx={x(h)} cy={chart.y(data.price[h])} r="3.5" className="dot-price" />
          </>
        )}
      </svg>
    </div>
  );
}
