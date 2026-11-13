import { useMemo, useState, type PointerEvent } from "react";
import { t } from "../i18n";
import { axisPad, dateTickIndexes, fmtTime, linePath, logPriceScale, niceTicks, shortUsd, usd, useWidth } from "../lib/chart";
import type { CandleTf, PriceSeries } from "../lib/series";

const PAD_T = 10;
const AXIS_H = 22;
const SCORE_TICKS = [0, 25, 50, 75, 100];

/**
 * score: solo la puntuación (la categoría). value: solo el valor real, con su escala en el eje izquierdo (métricas
 * informativas: el índice no usa su puntuación). both: la puntuación (eje izquierdo) y el valor real en línea discontinua,
 * escalado a su propio rango (métricas del índice).
 */
export type ScoreChartMode = "score" | "value" | "both";

interface Props {
  /** Precio de cada vela */
  data: PriceSeries;
  /** Puntuación de 0 a 100 en cada vela (null si no hay) */
  scores: (number | null)[];
  /** Valor real de la métrica en cada vela (en los modos value y both) */
  values?: (number | null)[];
  /** Formato del valor real; `i` es la vela (-1 en las marcas del eje) */
  format?: (v: number, i: number) => string;
  mode?: ScoreChartMode;
  tf: CandleTf;
  label: string;
  aria: string;
}

/**
 * El precio (eje derecho, logarítmico) y, superpuesta, la puntuación de 0 a 100 o el valor real de una categoría o de una
 * de sus métricas (páginas de métricas).
 */
export function ScoreChart({ data, scores, values, format = (v) => String(v), mode = "score", tf, label, aria }: Props) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const showValue = mode !== "score" && values !== undefined;
  const showScore = mode !== "value";

  const small = width < 600;
  const H0 = small ? 260 : 340;
  const price = useMemo(() => logPriceScale(data.price, PAD_T, H0), [data.price, H0]);
  // Escala del valor real: su rango con un margen
  const valueScale = useMemo(() => {
    const vs = (values ?? []).filter((v): v is number => v !== null && Number.isFinite(v));
    if (!showValue || !vs.length) return null;
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.06;
    const ticks = niceTicks(lo, hi, 4).filter((v) => v >= lo - pad && v <= hi + pad);
    return { y: (v: number) => PAD_T + H0 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * H0, ticks, crossesZero: lo < 0 && hi > 0 };
  }, [values, showValue, H0]);
  // Eje izquierdo: el del valor si solo se dibuja el valor; si no, el de la puntuación
  const leftLabels = mode === "value" && valueScale ? valueScale.ticks.map((v) => format(v, -1)) : SCORE_TICKS.map(String);
  const PAD_L = axisPad(leftLabels);
  const plotW = width - PAD_L - axisPad(price.ticks.map(shortUsd));
  const H = PAD_T + H0 + AXIS_H;
  const N = data.time.length;
  const x = (i: number) => PAD_L + (N > 1 ? (i / (N - 1)) * plotW : plotW / 2);
  const yS = (v: number) => PAD_T + H0 - (v / 100) * H0;

  const paths = useMemo(
    () => ({
      price: linePath(data.price, x, price.y),
      score: showScore ? linePath(scores, x, yS) : "",
      value: valueScale && values ? linePath(values, x, valueScale.y) : "",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, scores, values, valueScale, price, plotW, H0, showScore],
  );
  const dateTicks = useMemo(() => dateTickIndexes(N, plotW), [N, plotW]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.round(((e.clientX - r.left - PAD_L) / plotW) * (N - 1)))));
  };

  const h = hover ?? N - 1;
  const s = scores[h];
  const v = values?.[h] ?? null;

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(data.time[h], tf, true)}</span>
        <span className="legend legend-price num">
          {t.catHistory.priceLegend} <strong>{usd(data.price[h])}</strong>
        </span>
        <span className={mode === "both" ? "legend etf-fg score-both num" : "legend etf-fg num"}>
          {label}{" "}
          {mode === "value" ? (
            <strong>{v === null ? "—" : format(v, h)}</strong>
          ) : (
            <>
              <strong>{s === null ? "—" : Math.round(s)}</strong>
              {mode === "both" && v !== null && <span className="muted"> · {format(v, h)}</span>}
            </>
          )}
        </span>
      </p>
      <svg width={width} height={H} role="img" aria-label={aria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {price.ticks.map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={price.y(p)} y2={price.y(p)} className="grid" />
            <text x={PAD_L + plotW + 6} y={price.y(p) + 4} className="axis">{shortUsd(p)}</text>
          </g>
        ))}
        {mode === "value" && valueScale ? (
          <>
            {valueScale.ticks.map((tv) => (
              <text key={tv} x={PAD_L - 6} y={valueScale.y(tv) + 4} className="axis" textAnchor="end">
                {format(tv, -1)}
              </text>
            ))}
            {valueScale.crossesZero && <line x1={PAD_L} x2={PAD_L + plotW} y1={valueScale.y(0)} y2={valueScale.y(0)} className="grid grid-ref" />}
          </>
        ) : (
          <>
            {SCORE_TICKS.map((st) => (
              <text key={st} x={PAD_L - 6} y={yS(st) + 4} className="axis" textAnchor="end">
                {st}
              </text>
            ))}
            <line x1={PAD_L} x2={PAD_L + plotW} y1={yS(50)} y2={yS(50)} className="grid grid-ref" />
          </>
        )}
        {mode === "both" && <path d={paths.value} className="sent-line value-line" />}
        {mode === "value" && <path d={paths.value} className="sent-line" />}
        {showScore && <path d={paths.score} className="sent-line" />}
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
            {showScore && s !== null && <circle cx={x(h)} cy={yS(s)} r="3" className="sent-dot" />}
            {mode === "value" && v !== null && valueScale && <circle cx={x(h)} cy={valueScale.y(v)} r="3" className="sent-dot" />}
          </>
        )}
      </svg>
    </div>
  );
}
