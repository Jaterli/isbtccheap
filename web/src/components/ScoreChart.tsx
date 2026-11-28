import { useEffect, useId, useMemo, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { t } from "../i18n";
import { axisPad, dateTickIndexes, fmtTime, linePath, logPriceScale, niceTicks, shortUsd, usd, useWidth } from "../lib/chart";
import { usePanZoom } from "../lib/panZoom";
import type { CandleTf, PriceSeries } from "../lib/series";
import { BtcIcon } from "./BtcIcon";

const PAD_T = 10;
const AXIS_H = 22;
const SCORE_TICKS = [0, 25, 50, 75, 100];
// Con la puntuación y el valor real a la vez, si se dibuja la línea de la puntuación (se puede ocultar: va por encima de la
// del valor y la tapa). Una sola elección para todas las gráficas, recordada en el navegador
const SCORE_LINE_KEY = "isbtccheap:score-line";
// Desplazar y hacer zoom (lib/panZoom.ts) a partir de estos puntos: en series largas las líneas quedaban muy apretadas
const ZOOM_MIN_POINTS = 120;
const MIN_SPAN = 20; // puntos visibles como mínimo
// Con más de DENSE puntos por píxel las líneas quedan muy juntas: la gráfica empieza con zoom en los últimos datos, hasta
// unos START puntos por píxel (en 700 px, unos 1.400 días); con «−» se ve entera
const DENSE = 3;
const START = 2;
const EDGE = 2; // margen a cada lado del gráfico (las cifras de los ejes van dentro)
const INSET = 4; // de las cifras de los ejes al borde

// Las franjas (los días de capitulación en el SOPR y la pérdida realizada): visibles o no, una sola elección para todas
const BANDS_KEY = "isbtccheap:chart-bands";

/** Un interruptor recordado en el navegador (si se puede); encendido por defecto */
function useStoredToggle(key: string) {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(key) !== "off";
    } catch {
      return true;
    }
  });
  const toggle = () =>
    setOn((v) => {
      try {
        localStorage.setItem(key, v ? "off" : "on");
      } catch {
        /* sin almacenamiento: solo en esta visita */
      }
      return !v;
    });
  return [on, toggle] as const;
}

function useScoreLine() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(SCORE_LINE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const toggle = () => {
    setOn((v) => {
      try {
        localStorage.setItem(SCORE_LINE_KEY, v ? "off" : "on");
      } catch {
        /* sin almacenamiento: solo en esta visita */
      }
      return !v;
    });
  };
  return [on, toggle] as const;
}

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
  /**
   * Franjas detrás de las líneas: una clase por vela (null, sin franja). Las velas seguidas con la misma clase forman
   * una sola franja, de 3 px como poco para que un solo día se vea también en el histórico completo
   */
  bands?: (string | null)[];
  /** Lo que dice la lectura de la vela señalada si está en una franja */
  bandLabel?: (cls: string) => string;
  /** Nombre de las franjas en la leyenda: un botón que las muestra u oculta (recordado en el navegador) */
  bandLegend?: string;
  /** Líneas horizontales en la escala del valor real (umbrales), con su formato en la etiqueta */
  refLines?: number[];
  /**
   * id del sitio de la tarjeta donde van los botones de zoom en pantallas grandes (al final de la fila de selectores, como
   * en la cabecera del score frente al precio); en las pequeñas van sobre la gráfica, arriba a la izquierda
   */
  zoomSlot?: string;
  /** Al cambiar (cada pulsación de la temporalidad o del periodo, aunque sea el ya elegido), el zoom vuelve a su estado */
  resetKey?: string | number;
}

/**
 * El precio (eje derecho, logarítmico) y, superpuesta, la puntuación de 0 a 100 o el valor real de una categoría o de una
 * de sus métricas (páginas de métricas).
 */
export function ScoreChart({ data, scores, values, format = (v) => String(v), mode = "score", tf, label, aria, bands, bandLabel, bandLegend, refLines = [], zoomSlot, resetKey = "" }: Props) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const showValue = mode !== "score" && values !== undefined;
  const [scoreLine, toggleScoreLine] = useScoreLine();
  const [bandsOn, toggleBands] = useStoredToggle(BANDS_KEY);
  const showBands = !!bands && (!bandLegend || bandsOn);
  // Solo con el valor real a la vez se puede ocultar la puntuación (sin él, la gráfica se quedaría solo con el precio)
  const showScore = mode === "score" || (mode === "both" && scoreLine);

  const small = width < 600;
  const H0 = small ? 260 : 340;
  const N = data.time.length;
  const zoomable = N >= ZOOM_MIN_POINTS;
  const clipId = `sc-clip-${useId().replace(/:/g, "")}`;
  // El ancho de las cifras del eje izquierdo no sigue al zoom (lo que va junto a ellas saltaría): con las de toda la serie
  const fullValues = useMemo(() => (values ?? []).filter((v): v is number => v !== null && Number.isFinite(v)), [values]);
  // Solo las etiquetas del eje que se muestra: las del valor real si es su eje (solo el valor, o la puntuación oculta) y,
  // si no, las de la puntuación (antes se sumaban siempre las del valor: en los ETF, "+12,3k BTC" con el eje en 0-100,
  // dejaba un hueco a la izquierda). Las marcas redondas de toda la serie: con el zoom no cambian de ancho (el formato
  // de cada métrica tiene sus decimales fijos)
  const valueOnLeft = showValue && fullValues.length > 0 && (mode === "value" || !scoreLine);
  const leftAll = useMemo(() => {
    if (!valueOnLeft) return SCORE_TICKS.map(String);
    const lo = Math.min(...fullValues, ...refLines);
    const hi = Math.max(...fullValues, ...refLines);
    return niceTicks(lo, hi, 4).map((v) => format(v, -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullValues, valueOnLeft, refLines.join()]);
  // Las cifras de los ejes van dentro del gráfico, pegadas a cada borde y sobre las líneas (con un contorno del color de
  // la tarjeta para que se lean): el gráfico ocupa todo el ancho, sin columnas reservadas para ellas. LABEL_W, el ancho de
  // las de la izquierda: lo que se aparta lo que va junto a ellas (el zoom en móvil, las cifras de los umbrales)
  const PAD_L = EDGE;
  const plotW = width - 2 * EDGE;
  const LABEL_W = axisPad(leftAll);
  // Se vuelve a ver entera al cambiar de temporalidad, de métrica o de periodo (otro primer punto), no con cada vela nueva
  const initialSpan = zoomable && plotW > 0 && N / plotW > DENSE ? Math.round(plotW * START) : Infinity;
  const pz = usePanZoom(N, PAD_L, plotW, MIN_SPAN, `${tf}|${label}|${data.time[0]}|${resetKey}`, initialSpan);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(zoomSlot ? document.getElementById(zoomSlot) : null), [zoomSlot]);
  const { view, span } = pz;
  // Lo visible, con un punto más a cada lado para que las líneas lleguen al borde (se recortan con clipPath)
  const v0 = Math.ceil(view.start);
  const v1 = Math.floor(view.end);
  const from = Math.max(0, v0 - 1);
  const to = Math.min(N - 1, v1 + 1);
  const price = useMemo(() => logPriceScale(data.price.slice(v0, v1 + 1), PAD_T, H0), [data.price, v0, v1, H0]);
  // Escala del valor real: su rango en lo visible, con un margen
  const valueScale = useMemo(() => {
    const vs = (values ?? []).slice(v0, v1 + 1).filter((v): v is number => v !== null && Number.isFinite(v));
    if (!showValue || !vs.length) return null;
    // Los umbrales, dentro del rango, para que sus líneas se vean
    vs.push(...refLines);
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.06;
    const ticks = niceTicks(lo, hi, 4).filter((v) => v >= lo - pad && v <= hi + pad);
    return { y: (v: number) => PAD_T + H0 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * H0, ticks, crossesZero: lo < 0 && hi > 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, showValue, H0, refLines.join(), v0, v1]);
  // Eje izquierdo: el del valor si solo se dibuja el valor (también con la puntuación oculta); si no, el de la puntuación
  const valueAxis = valueScale !== null && (mode === "value" || (mode === "both" && !scoreLine));
  const H = PAD_T + H0 + AXIS_H;
  const x = (i: number) => PAD_L + (N > 1 ? ((i - view.start) / span) * plotW : plotW / 2);
  const yS = (v: number) => PAD_T + H0 - (v / 100) * H0;

  const paths = useMemo(() => {
    const seg = <T,>(xs: T[]) => xs.slice(from, to + 1);
    const xi = (k: number) => x(from + k);
    return {
      price: linePath(seg(data.price), xi, price.y),
      score: showScore ? linePath(seg(scores), xi, yS) : "",
      value: valueScale && values ? linePath(seg(values), xi, valueScale.y) : "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, scores, values, valueScale, price, plotW, H0, showScore, from, to, view.start, span, PAD_L]);
  const dateTicks = useMemo(() => dateTickIndexes(v1 - v0 + 1, plotW).map((k) => v0 + k), [v0, v1, plotW]);
  const bandRects = useMemo(() => {
    if (!showBands || !bands || N < 2) return [];
    const half = plotW / span / 2;
    const out: { x: number; w: number; cls: string }[] = [];
    for (let i = from; i <= to; i++) {
      const c = bands[i];
      if (!c) continue;
      const last = out.at(-1);
      if (last && last.cls === c && bands[i - 1] === c) last.w = x(i) + half - last.x;
      else out.push({ x: x(i) - half, w: 2 * half, cls: c });
    }
    for (const r of out) if (r.w < 3) Object.assign(r, { x: r.x + r.w / 2 - 1.5, w: 3 });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bands, showBands, N, plotW, PAD_L, from, to, view.start, span]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    // Al arrastrar se mueve la gráfica; si no, la lectura sigue al puntero
    if (zoomable && pz.handlers.onPointerMove(e)) return;
    setHover(Math.min(v1, Math.max(v0, pz.indexAt(e.clientX))));
  };

  const h = hover !== null ? Math.min(Math.max(hover, v0), v1) : v1;
  // − y +, del mismo tamaño que en el score frente al precio (segmented small chart-zoom)
  const zoomButtons = (cls: string, style?: { left: number }) => (
    <div className={`segmented small chart-zoom ${cls}`} role="group" aria-label="Zoom" style={style}>
      <button type="button" onClick={pz.zoomOut} aria-label={t.history.zoomOut} title={t.history.zoomOut} disabled={!pz.zoomed}>
        −
      </button>
      <button type="button" onClick={pz.zoomIn} aria-label={t.history.zoomIn} title={t.history.zoomIn} disabled={span <= MIN_SPAN + 0.5}>
        +
      </button>
    </div>
  );
  const s = scores[h];
  const v = values?.[h] ?? null;

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(data.time[h], tf, true)}</span>
        <span className="legend legend-price num">
          <BtcIcon size={14} label={t.catHistory.priceLegend} /> <strong>{usd(data.price[h])}</strong>
        </span>
        {mode === "both" ? (
          // La puntuación, como botón: muestra u oculta su línea
          <button
            type="button"
            className="legend etf-fg num legend-toggle"
            aria-pressed={scoreLine}
            title={t.catHistory.scoreToggle}
            onClick={toggleScoreLine}
          >
            {label} <strong>{s === null ? "—" : Math.round(s)}</strong>
          </button>
        ) : (
          <span className="legend etf-fg num">
            {label} <strong>{mode === "value" ? (v === null ? "—" : format(v, h)) : s === null ? "—" : Math.round(s)}</strong>
          </span>
        )}
        {/* Con la puntuación, el valor real va aparte, con el color y el trazo discontinuo de su línea */}
        {mode === "both" && (
          <span className="legend legend-value num">
            {t.catHistory.valueLegend} <strong>{v === null ? "—" : format(v, h)}</strong>
          </span>
        )}
        {/* Las franjas en la leyenda, como botón: las muestra u oculta */}
        {bands && bandLegend && (
          <button type="button" className="legend legend-bands legend-toggle" aria-pressed={bandsOn} title={t.catHistory.bandsToggle} onClick={toggleBands}>
            {bandLegend}
          </button>
        )}
        {showBands && bands?.[h] && bandLabel && <span className={`band-tag ${bands[h]}`}>{bandLabel(bands[h]!)}</span>}
      </p>
      {zoomable && slot && createPortal(zoomButtons("sc-zoom-header"), slot)}
      <div className="sc-area">
      {/* En pantallas pequeñas (o sin sitio en la tarjeta), sobre la gráfica, arriba a la izquierda del área */}
      {zoomable && zoomButtons(slot ? "sc-zoom-overlay" : "sc-zoom-overlay always", { left: PAD_L + LABEL_W + INSET })}
      <svg
        ref={pz.svgRef}
        width={width}
        height={H}
        role="img"
        aria-label={aria}
        className={zoomable ? "sc-pannable" : undefined}
        onPointerDown={zoomable ? pz.handlers.onPointerDown : undefined}
        onPointerMove={onMove}
        onPointerUp={zoomable ? pz.handlers.onPointerEnd : undefined}
        onPointerCancel={zoomable ? pz.handlers.onPointerEnd : undefined}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD_L} y={0} width={plotW} height={PAD_T + H0} />
          </clipPath>
        </defs>
        {price.ticks.map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={price.y(p)} y2={price.y(p)} className="grid" />
          </g>
        ))}
        {valueAxis
          ? valueScale.crossesZero && <line x1={PAD_L} x2={PAD_L + plotW} y1={valueScale.y(0)} y2={valueScale.y(0)} className="grid grid-ref" />
          : <line x1={PAD_L} x2={PAD_L + plotW} y1={yS(50)} y2={yS(50)} className="grid grid-ref" />}
        <g clipPath={`url(#${clipId})`}>
        {bandRects.map((r) => (
          <rect key={r.x} x={r.x} y={PAD_T} width={r.w} height={H0} className={`chart-band ${r.cls}`} />
        ))}
        {/* Umbrales del valor real: línea discontinua y su cifra junto al borde izquierdo */}
        {valueScale &&
          refLines.map((rv) => (
            <g key={rv}>
              <line x1={PAD_L} x2={PAD_L + plotW} y1={valueScale.y(rv)} y2={valueScale.y(rv)} className="value-ref" />
              <text x={PAD_L + LABEL_W + INSET} y={valueScale.y(rv) - 3} className="axis value-ref-label">
                {format(rv, -1)}
              </text>
            </g>
          ))}
        {mode === "both" && <path d={paths.value} className="sent-line value-line" />}
        {mode === "value" && <path d={paths.value} className="sent-line" />}
        {showScore && <path d={paths.score} className="sent-line" />}
        <path d={paths.price} className="line-price" />
        </g>
        {/* Cifras de los ejes, encima de las líneas: el precio a la derecha y la puntuación o el valor a la izquierda */}
        <g className="axis-in">
          {price.ticks.map((p) => (
            <text key={p} x={PAD_L + plotW - INSET} y={price.y(p) + 4} className="axis" textAnchor="end">
              {shortUsd(p)}
            </text>
          ))}
          {valueAxis
            ? valueScale.ticks.map((tv) => (
                <text key={tv} x={PAD_L + INSET} y={valueScale.y(tv) + 4} className="axis">
                  {format(tv, -1)}
                </text>
              ))
            : SCORE_TICKS.map((st) => (
                <text key={st} x={PAD_L + INSET} y={yS(st) + 4} className="axis">
                  {st}
                </text>
              ))}
        </g>

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
            {mode === "both" && v !== null && valueScale && <circle cx={x(h)} cy={valueScale.y(v)} r="3" className="value-dot" />}
          </>
        )}
      </svg>
      </div>
    </div>
  );
}
