import { useMemo, useState, type PointerEvent } from "react";
import { t } from "../i18n";
import { axisPad, dateTickIndexes, fmtTime, linePath, logPriceScale, niceTicks, shortUsd, usd, useWidth } from "../lib/chart";
import type { EtfSeries } from "../lib/etf";

const FG_TICKS = [25, 50, 75]; // eje del Fear & Greed (0-100), a la izquierda
const PAD_T = 10;
const GAP = 18;
const AXIS_H = 22;

/** +527 M$, −1,2 mil M$ ($527M, $1.2B en inglés) */
export const flowUsd = (v: number, signed = true) => {
  const sign = v > 0 && signed ? "+" : v < 0 ? "−" : "";
  return `${sign}${t.etf.money(Math.abs(v))}`;
};

/** El eje x son sesiones de mercado, sin huecos en fines de semana. En el panel del precio, el Fear & Greed (0-100). */
export function EtfChart({ data }: { data: EtfSeries }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const small = width < 600;
  const PAD_L = axisPad(FG_TICKS.map(String));
  const priceH = small ? 160 : 210;
  const flowH = small ? 140 : 180;
  const scale = useMemo(() => {
    // Flujos: simétrico alrededor de 0, para comparar entradas y salidas
    const max = Math.max(...data.flow.map(Math.abs), 1);
    return { ...logPriceScale(data.price, PAD_T, priceH), max, flowTicks: niceTicks(0, max, 2).filter((v) => v > 0) };
  }, [data, priceH]);
  const flowLabels = [0, ...scale.flowTicks, ...scale.flowTicks.map((v) => -v)].map((v) => (v === 0 ? "0" : flowUsd(v)));
  const plotW = width - PAD_L - axisPad([...scale.ticks.map(shortUsd), ...flowLabels]);
  const flowTop = PAD_T + priceH + GAP;
  const H = flowTop + flowH + AXIS_H;
  const N = data.time.length;
  const step = plotW / Math.max(N, 1);
  const x = (i: number) => PAD_L + (i + 0.5) * step;

  const chart = useMemo(() => {
    const { y, ticks, max, flowTicks } = scale;
    const yFlow = (v: number) => flowTop + flowH / 2 - (v / max) * (flowH / 2 - 4);
    const yFg = (v: number) => PAD_T + priceH - (v / 100) * priceH;
    return { y, ticks, yFlow, flowTicks, yFg, price: linePath(data.price, x, y), fg: linePath(data.fearGreed, x, yFg) };
  }, [data, scale, plotW, priceH, flowH, flowTop]);

  const dateTicks = useMemo(() => dateTickIndexes(N, plotW), [N, plotW]);
  const barW = Math.max(1, step * 0.75);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.floor((e.clientX - r.left - PAD_L) / step))));
  };

  const h = hover ?? N - 1;
  const tx = t.etf;
  const zero = chart.yFlow(0);

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(data.time[h], "1d", true)}</span>
        <span className="legend legend-price num">
          {tx.legend.price} <strong>{usd(data.price[h])}</strong>
        </span>
        <span className={`legend num ${data.flow[h] >= 0 ? "etf-in" : "etf-out"}`}>
          {tx.legend.flow} <strong>{flowUsd(data.flow[h])}</strong>
        </span>
        {data.fearGreed[h] !== null && (
          <span className="legend etf-fg num">
            {tx.legend.fearGreed} <strong>{data.fearGreed[h]}</strong>
          </span>
        )}
        <span className="muted num">
          {tx.legend.cumulative} {flowUsd(data.cumulative[h])}
        </span>
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {chart.ticks.map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.y(p)} y2={chart.y(p)} className="grid" />
            <text x={PAD_L + plotW + 6} y={chart.y(p) + 4} className="axis">{shortUsd(p)}</text>
          </g>
        ))}
        {chart.fg && (
          <>
            {FG_TICKS.map((v) => (
              <text key={v} x={PAD_L - 6} y={chart.yFg(v) + 4} className="axis" textAnchor="end">
                {v}
              </text>
            ))}
            <path d={chart.fg} className="etf-fg-line" />
          </>
        )}
        <path d={chart.price} className="line-price" />

        {[0, ...chart.flowTicks, ...chart.flowTicks.map((v) => -v)].map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.yFlow(v)} y2={chart.yFlow(v)} className={v === 0 ? "grid" : "grid grid-ref"} />
            <text x={PAD_L + plotW + 6} y={chart.yFlow(v) + 4} className="axis">{v === 0 ? "0" : flowUsd(v)}</text>
          </g>
        ))}
        {data.flow.map((f, i) => {
          const yv = chart.yFlow(f);
          return (
            <rect
              key={i}
              x={x(i) - barW / 2}
              width={barW}
              y={Math.min(yv, zero)}
              height={Math.max(0.5, Math.abs(yv - zero))}
              className={f >= 0 ? "etf-bar in" : "etf-bar out"}
            />
          );
        })}

        {dateTicks.map((i, k) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={k === 0 ? "start" : k === dateTicks.length - 1 ? "end" : "middle"}>
            {fmtTime(data.time[i], "1d", false)}
          </text>
        ))}
        {hover !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={flowTop + flowH} className="crosshair" />
            <circle cx={x(h)} cy={chart.y(data.price[h])} r="3.5" className="dot-price" />
          </>
        )}
      </svg>
    </div>
  );
}
