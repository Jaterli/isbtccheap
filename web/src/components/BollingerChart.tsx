import { useMemo, useState, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import type { BollingerSeries } from "../lib/bollinger";
import { dateTickIndexes, fmtTime, linePath, logPriceScale, shortUsd, useWidth } from "../lib/chart";
import type { CandleTf } from "../lib/series";

const PAD_L = 8;
const PAD_R = 56; // ejes de precio y %B, a la derecha
const PAD_T = 10;
const GAP = 18; // entre el panel del precio y el del %B
const AXIS_H = 22; // fechas

const usd = (p: number) => p.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Arriba, el precio con las bandas de Bollinger (escala logarítmica); abajo, el %B con las referencias 0, 50 y 100
 * y sombreadas las zonas por encima de la banda superior (rojo) y por debajo de la inferior (verde).
 */
export function BollingerChart({ data, tf }: { data: BollingerSeries; tf: CandleTf }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const small = width < 600;
  const priceH = small ? 200 : 270;
  const bH = small ? 110 : 140;
  const plotW = width - PAD_L - PAD_R;
  const bTop = PAD_T + priceH + GAP;
  const H = bTop + bH + AXIS_H;
  const N = data.time.length;
  const x = (i: number) => PAD_L + (N > 1 ? (i / (N - 1)) * plotW : 0);

  const chart = useMemo(() => {
    const bandValues = [...data.price, ...data.upper, ...data.lower].filter((v): v is number => v !== null);
    const { y: yPrice, ticks: priceTicks } = logPriceScale(bandValues, PAD_T, priceH);
    // Área entre bandas: la superior de izquierda a derecha y la inferior de vuelta
    const idx = data.upper.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
    const band = idx.length
      ? `M${idx.map((i) => `${x(i).toFixed(1)},${yPrice(data.upper[i]!).toFixed(1)}`).join("L")}` +
        `L${[...idx].reverse().map((i) => `${x(i).toFixed(1)},${yPrice(data.lower[i]!).toFixed(1)}`).join("L")}Z`
      : "";
    // %B: al menos de -10 a 110, ampliado si el valor se sale más
    const bs = data.pctB.filter((v): v is number => v !== null);
    const bLo = Math.min(-10, ...bs);
    const bHi = Math.max(110, ...bs);
    const yB = (v: number) => bTop + bH - ((v - bLo) / (bHi - bLo)) * bH;
    return {
      yPrice,
      priceTicks,
      yB,
      band,
      upper: linePath(data.upper, x, yPrice),
      lower: linePath(data.lower, x, yPrice),
      mid: linePath(data.mid, x, yPrice),
      price: linePath(data.price, x, yPrice),
      pctB: linePath(data.pctB, x, yB),
      bLo,
      bHi,
    };
  }, [data, plotW, priceH, bH, bTop]);

  const dateTicks = useMemo(() => dateTickIndexes(N, plotW), [N, plotW]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.round(((e.clientX - r.left - PAD_L) / plotW) * (N - 1)))));
  };

  const h = hover ?? N - 1;
  const b = data.pctB[h];
  const tx = t.bb;

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(data.time[h], tf, true)}</span>
        <span className="legend legend-price num">
          {tx.priceLegend} <strong>{usd(data.price[h])}</strong>
        </span>
        <span className="legend legend-score num">
          %B <strong>{b === null ? "—" : Math.round(b)}</strong>
        </span>
        {data.upper[h] !== null && (
          <span className="muted num">
            {tx.bandsLegend} {usd(data.lower[h]!)} – {usd(data.upper[h]!)}
          </span>
        )}
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {/* Panel del precio */}
        {chart.priceTicks.map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.yPrice(p)} y2={chart.yPrice(p)} className="grid" />
            <text x={PAD_L + plotW + 6} y={chart.yPrice(p) + 4} className="axis">{shortUsd(p)}</text>
          </g>
        ))}
        <path d={chart.band} className="bb-band" />
        <path d={chart.upper} className="bb-edge" />
        <path d={chart.lower} className="bb-edge" />
        <path d={chart.mid} className="bb-mid" />
        <path d={chart.price} className="line-price" />

        {/* Panel del %B */}
        <rect x={PAD_L} width={plotW} y={chart.yB(chart.bHi)} height={chart.yB(100) - chart.yB(chart.bHi)} className="zone-hot" />
        <rect x={PAD_L} width={plotW} y={chart.yB(0)} height={chart.yB(chart.bLo) - chart.yB(0)} className="zone-cold" />
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.yB(v)} y2={chart.yB(v)} className={v === 50 ? "grid bb-ref" : "grid"} />
            <text x={PAD_L + plotW + 6} y={chart.yB(v) + 4} className="axis">{v}</text>
          </g>
        ))}
        <path d={chart.pctB} className="line-score" />

        {dateTicks.map((i, k) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={k === 0 ? "start" : k === dateTicks.length - 1 ? "end" : "middle"}>
            {fmtTime(data.time[i], tf, false)}
          </text>
        ))}
        {hover !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={bTop + bH} className="crosshair" />
            <circle cx={x(h)} cy={chart.yPrice(data.price[h])} r="3.5" className="dot-price" />
            {b !== null && <circle cx={x(h)} cy={chart.yB(b)} r="3.5" className="dot-score" />}
          </>
        )}
      </svg>
    </div>
  );
}
