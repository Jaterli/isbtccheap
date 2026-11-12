import { useMemo, useState, type PointerEvent } from "react";
import { t } from "../i18n";
import { axisPad, dateTickIndexes, fmtTime, linePath, logPriceScale, shortUsd, usd, useWidth } from "../lib/chart";
import type { CandleTf, PriceSeries } from "../lib/series";

const PAD_T = 10;
const AXIS_H = 22;
const SCORE_TICKS = [0, 25, 50, 75, 100];

interface Props {
  /** Precio de cada vela */
  data: PriceSeries;
  /** Puntuación de 0 a 100 en cada vela (null si no hay) */
  scores: (number | null)[];
  tf: CandleTf;
  label: string;
  /** Valor real de la métrica en una vela, con su formato (null si no hay o es la categoría) */
  detail?: (i: number) => string | null;
  aria: string;
}

/**
 * El precio (eje derecho, logarítmico) y, superpuesta, una puntuación de 0 a 100 (eje izquierdo): la de una categoría o
 * de una de sus métricas (páginas de sentimiento y de liquidez).
 */
export function ScoreChart({ data, scores, tf, label, detail, aria }: Props) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const small = width < 600;
  const H0 = small ? 260 : 340;
  const PAD_L = axisPad(SCORE_TICKS.map(String));
  const price = useMemo(() => logPriceScale(data.price, PAD_T, H0), [data.price, H0]);
  const plotW = width - PAD_L - axisPad(price.ticks.map(shortUsd));
  const H = PAD_T + H0 + AXIS_H;
  const N = data.time.length;
  const x = (i: number) => PAD_L + (N > 1 ? (i / (N - 1)) * plotW : plotW / 2);
  const yS = (v: number) => PAD_T + H0 - (v / 100) * H0;

  const paths = useMemo(
    () => ({ price: linePath(data.price, x, price.y), score: linePath(scores, x, yS) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, scores, price, plotW, H0],
  );
  const dateTicks = useMemo(() => dateTickIndexes(N, plotW), [N, plotW]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.round(((e.clientX - r.left - PAD_L) / plotW) * (N - 1)))));
  };

  const h = hover ?? N - 1;
  const v = scores[h];
  const extra = detail?.(h);

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(data.time[h], tf, true)}</span>
        <span className="legend legend-price num">
          {t.catHistory.priceLegend} <strong>{usd(data.price[h])}</strong>
        </span>
        <span className="legend etf-fg num">
          {label} <strong>{v === null ? "—" : Math.round(v)}</strong>
          {extra && <span className="muted"> ({extra})</span>}
        </span>
      </p>
      <svg width={width} height={H} role="img" aria-label={aria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {price.ticks.map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={price.y(p)} y2={price.y(p)} className="grid" />
            <text x={PAD_L + plotW + 6} y={price.y(p) + 4} className="axis">{shortUsd(p)}</text>
          </g>
        ))}
        {SCORE_TICKS.map((s) => (
          <text key={s} x={PAD_L - 6} y={yS(s) + 4} className="axis" textAnchor="end">
            {s}
          </text>
        ))}
        <line x1={PAD_L} x2={PAD_L + plotW} y1={yS(50)} y2={yS(50)} className="grid grid-ref" />
        <path d={paths.score} className="sent-line" />
        <path d={paths.price} className="line-price" />

        {dateTicks.map((i, j) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={j === 0 ? "start" : j === dateTicks.length - 1 ? "end" : "middle"}>
            {fmtTime(data.time[i], tf, false)}
          </text>
        ))}
        {hover !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + H0} className="crosshair" />
            <circle cx={x(h)} cy={price.y(data.price[h])} r="3.5" className="dot-price" />
            {v !== null && <circle cx={x(h)} cy={yS(v)} r="3" className="sent-dot" />}
          </>
        )}
      </svg>
    </div>
  );
}
