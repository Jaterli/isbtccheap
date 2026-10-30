import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import { load4h } from "../lib/history4h";
import type { History, Latest } from "../types";
import { InfoTip } from "./InfoTip";

const RANGES = [
  { id: "6m", days: 182 },
  { id: "1y", days: 365 },
  { id: "4y", days: 1461 },
  { id: "all", days: Infinity },
];

const GAP = 18; // es también la barra para cambiar el alto
const AXIS_H = 20;
const HANDLE_H = 14;
const PAD_L = 8;
const PAD_R = 52;
const MIN_SPAN = 14; // días
const MIN_SPAN_4H = 12; // velas de 4 h (2 días)
const LIMITS = { price: [80, 600], score: [50, 400] } as const;
const HEIGHTS_KEY = "isbtccheap:chart-heights";

/** Ventana visible: índices fraccionarios del primer y último día. */
interface View {
  start: number;
  end: number;
}
type Panel = "price" | "score";
type Heights = Record<Panel, number>;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function clampView(start: number, span: number, n: number, minSpan = MIN_SPAN): View {
  const maxSpan = Math.max(1, n - 1);
  const s = clamp(span, Math.min(minSpan, maxSpan), maxSpan);
  const st = clamp(start, 0, n - 1 - s);
  return { start: st, end: st + s };
}

const viewForRange = (days: number, n: number) => clampView(n - 1 - days, Math.min(days, n - 1), n);

/** Zoom manteniendo fijo el día que hay en la posición relativa fx (0 = izquierda, 1 = derecha). */
function zoomAt(v: View, factor: number, fx: number, n: number, minSpan: number): View {
  const span = v.end - v.start;
  const newSpan = clamp(span * factor, Math.min(minSpan, n - 1), n - 1);
  return clampView(v.start + fx * span - fx * newSpan, newSpan, n, minSpan);
}

function loadHeights(): Heights | null {
  try {
    const h = JSON.parse(localStorage.getItem(HEIGHTS_KEY) ?? "null");
    return h && typeof h.price === "number" && typeof h.score === "number" ? h : null;
  } catch {
    return null;
  }
}

const shortUsd = (p: number) => (p >= 1000 ? `$${(p / 1000).toFixed(p < 10_000 ? 1 : 0)}k` : `$${p.toFixed(p < 10 ? 2 : 0)}`);

/** Fecha y hora locales de una vela, en el mismo formato que las fechas diarias ("2026-10-29T08:00"). */
function localStamp(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Marcas en límites naturales (años, meses o días) según el zoom. Con velas de 4 h, en el cambio de día. */
function dateTicks(dates: string[], v0: number, v1: number, maxTicks: number, intraday: boolean) {
  const span = v1 - v0;
  const unit = intraday ? "d" : span > 1100 ? "y" : span > 75 ? "m" : "d";
  const cands: number[] = [];
  for (let i = v0; i <= v1; i++) {
    const prev = dates[i - 1];
    const cut = unit === "y" ? 4 : unit === "m" ? 7 : 10;
    if ((unit === "d" && !intraday) || !prev || dates[i].slice(0, cut) !== prev.slice(0, cut)) cands.push(i);
  }
  const step = Math.max(1, Math.ceil(cands.length / maxTicks));
  return cands
    .filter((_, k) => k % step === 0)
    .map((i) => {
      const [y, m, d] = dates[i].slice(0, 10).split("-");
      const month = t.history.months[+m - 1];
      const label = unit === "y" ? y : unit === "m" ? `${month} ${y.slice(2)}` : `${+d} ${month}`;
      return { i, label };
    });
}

export function HistoryChart({ history: daily, latest }: { history: History; latest: Latest | null }) {
  // En "6 meses" se cambia a velas de 4 h con el score de esa temporalidad
  const [want4h, setWant4h] = useState(false);
  const [h4, setH4] = useState<History | null>(null);
  const [h4Failed, setH4Failed] = useState(false);
  const want4hRef = useRef(want4h);
  want4hRef.current = want4h;
  const is4h = want4h && h4 !== null;
  const history = is4h ? h4 : daily;
  const minSpan = is4h ? MIN_SPAN_4H : MIN_SPAN;
  const N = history.dates.length;
  const uid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(720);
  const [range, setRange] = useState<string | null>("4y");
  const [view, setView] = useState<View>(() => viewForRange(1461, N));
  const fullView = (n: number) => clampView(0, n - 1, n, MIN_SPAN_4H);
  const [custom, setCustom] = useState<Heights | null>(loadHeights);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const auto: Heights = { price: width < 520 ? 140 : width < 900 ? 170 : 220, score: width < 520 ? 80 : 100 };
  const heights = custom ?? auto;
  const plotW = Math.max(50, width - PAD_L - PAD_R);
  const scoreTop = heights.price + GAP;
  const scoreBottom = scoreTop + heights.score;
  const H = scoreBottom + AXIS_H + HANDLE_H;

  const span = view.end - view.start;
  const x = (i: number) => PAD_L + ((i - view.start) / span) * plotW;
  const yScore = (s: number) => scoreBottom - (s / 100) * heights.score;
  const v0 = Math.ceil(view.start);
  const v1 = Math.floor(view.end);

  const chart = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    let iMax = v0;
    let iMin = v0;
    for (let i = v0; i <= v1; i++) {
      const l = Math.log10(history.price[i]);
      lo = Math.min(lo, l);
      hi = Math.max(hi, l);
      if (history.score[i] > history.score[iMax]) iMax = i;
      if (history.score[i] < history.score[iMin]) iMin = i;
    }
    const yPrice = (p: number) => heights.price - 6 - ((Math.log10(p) - lo) / (hi - lo || 1)) * (heights.price - 12);
    // Un punto más a cada lado para que la línea llegue al borde (se recorta con clipPath)
    const from = Math.max(0, v0 - 1);
    const to = Math.min(N - 1, v1 + 1);
    let pricePath = "";
    let scorePath = "";
    for (let i = from; i <= to; i++) {
      const cmd = i === from ? "M" : "L";
      pricePath += `${cmd}${x(i).toFixed(1)},${yPrice(history.price[i]).toFixed(1)}`;
      scorePath += `${cmd}${x(i).toFixed(1)},${yScore(history.score[i]).toFixed(1)}`;
    }
    const priceTicks = [0, 0.5, 1].map((t) => 10 ** (lo + (hi - lo) * t));
    return { iMax, iMin, yPrice, pricePath, scorePath, priceTicks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, view, plotW, heights.price, heights.score]);

  const ticks = useMemo(() => dateTicks(history.dates, v0, v1, Math.max(2, Math.floor(plotW / 90)), is4h), [history, v0, v1, plotW, is4h]);

  // Zoom con Ctrl + rueda o pellizco del trackpad; desplazamiento con scroll horizontal
  const plotWRef = useRef(plotW);
  plotWRef.current = plotW;
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const zooming = e.ctrlKey || e.metaKey;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!zooming && !horizontal && !e.shiftKey) return; // la rueda normal sigue haciendo scroll de la página
      e.preventDefault();
      const fx = clamp((e.clientX - el.getBoundingClientRect().left - PAD_L) / plotWRef.current, 0, 1);
      setRange(null);
      setView((v) => {
        if (zooming) return zoomAt(v, Math.exp(e.deltaY * 0.003), fx, N, minSpan);
        const delta = ((horizontal ? e.deltaX : e.deltaY) / plotWRef.current) * (v.end - v.start);
        return clampView(v.start + delta, v.end - v.start, N, minSpan);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [N, minSpan]);

  // Arrastrar para desplazar (1 dedo o ratón) y pellizcar para zoom (2 dedos)
  const pointers = useRef(new Map<number, number>());
  const gesture = useRef<{ view: View; anchor: number; dist: number; x0: number; moved: boolean } | null>(null);
  const relX = (clientX: number) => (clientX - svgRef.current!.getBoundingClientRect().left - PAD_L) / plotW;

  const baseline = () => {
    const xs = [...pointers.current.values()];
    if (!xs.length) return void (gesture.current = null);
    const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
    gesture.current = {
      view,
      anchor: view.start + relX(mid) * span,
      dist: xs.length > 1 ? Math.abs(xs[0] - xs[1]) : 0,
      x0: mid,
      moved: gesture.current?.moved ?? false,
    };
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, e.clientX);
    baseline();
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (pointers.current.size < 2) {
      setHover(clamp(Math.round(view.start + relX(e.clientX) * span), v0, v1));
    }
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.clientX);
    const xs = [...pointers.current.values()];
    const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
    if (!g.moved && xs.length === 1 && Math.abs(mid - g.x0) < 4) return; // un clic no mueve el gráfico
    g.moved = true;
    const span0 = g.view.end - g.view.start;
    const newSpan = xs.length > 1 && g.dist > 0 ? span0 * (g.dist / Math.max(1, Math.abs(xs[0] - xs[1]))) : span0;
    const s = clamp(newSpan, Math.min(minSpan, N - 1), N - 1);
    setRange(null);
    setView(clampView(g.anchor - relX(mid) * s, s, N, minSpan));
  };

  const onPointerEnd = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current) gesture.current.moved = false;
    baseline();
  };

  const saveHeights = (h: Heights | null) => {
    setCustom(h);
    try {
      if (h) localStorage.setItem(HEIGHTS_KEY, JSON.stringify(h));
      else localStorage.removeItem(HEIGHTS_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
  };

  const resizeTo = (panel: Panel, value: number, base: Heights) =>
    saveHeights({ ...base, [panel]: Math.round(clamp(value, LIMITS[panel][0], LIMITS[panel][1])) });

  const startResize = (panel: Panel) => (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const y0 = e.clientY;
    const base = { ...heights };
    const move = (ev: globalThis.PointerEvent) => resizeTo(panel, base[panel] + ev.clientY - y0, base);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const keyResize = (panel: Panel) => (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowUp" ? -10 : e.key === "ArrowDown" ? 10 : 0;
    if (!step) return;
    e.preventDefault();
    resizeTo(panel, heights[panel] + step, heights);
  };

  const handle = (panel: Panel, top: number, h: number) => (
    <div
      className="resize-handle"
      style={{ top, height: h }}
      role="separator"
      aria-orientation="horizontal"
      aria-label={panel === "price" ? t.history.resizePrice : t.history.resizeScore}
      aria-valuenow={heights[panel]}
      aria-valuemin={LIMITS[panel][0]}
      aria-valuemax={LIMITS[panel][1]}
      tabIndex={0}
      title={t.history.resizeTitle}
      onPointerDown={startResize(panel)}
      onDoubleClick={() => saveHeights(null)}
      onKeyDown={keyResize(panel)}
    >
      <span />
    </div>
  );

  const selectRange = (r: (typeof RANGES)[number]) => {
    setRange(r.id);
    const want = r.id === "6m" && latest !== null && !h4Failed;
    setWant4h(want);
    if (want && h4) return setView(fullView(h4.dates.length));
    // Mientras llegan las velas de 4 h se ven los últimos 6 meses en diario
    setView(viewForRange(r.days, daily.dates.length));
    if (!want) return;
    load4h(latest).then(
      (d) => {
        const series = { dates: d.time.map(localStamp), price: d.price, score: d.score };
        if (series.dates.length < 2) return setH4Failed(true);
        setH4(series);
        if (want4hRef.current) setView(fullView(series.dates.length));
      },
      () => {
        setH4Failed(true);
        setWant4h(false);
      },
    );
  };
  const zoomButton = (factor: number) => {
    setRange(null);
    // Si se está viendo el final de la serie, el zoom mantiene el último día a la derecha
    setView((v) => zoomAt(v, factor, v.end >= N - 1.5 ? 1 : 0.5, N, minSpan));
  };

  const h = hover ?? v1;

  const extreme = (i: number, kind: "max" | "min") => {
    const cx = x(i);
    const cy = yScore(history.score[i]);
    // La etiqueta va hacia el lado con más espacio
    const toRight = cx < PAD_L + plotW * 0.6;
    const stamp = history.dates[i];
    const date = is4h
      ? new Date(stamp).toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : new Date(`${stamp}T00:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "2-digit" });
    const py = chart.yPrice(history.price[i]);
    const tx = cx + (toRight ? 8 : -8);
    const anchor = toRight ? "start" : "end";
    return (
      <g key={kind} className={`extreme extreme-${kind}`}>
        <line x1={cx} x2={cx} y1={4} y2={scoreBottom} className="extreme-guide" />
        <circle cx={cx} cy={py} r="4" />
        <text x={tx} y={clamp(py + 4, 14, heights.price - 4)} textAnchor={anchor}>
          {`$${Math.round(history.price[i]).toLocaleString(locale)}`}
        </text>
        <circle cx={cx} cy={cy} r="4.5" />
        <text x={tx} y={cy + 4} textAnchor={anchor}>
          {kind === "max" ? t.history.max : t.history.min} {history.score[i].toFixed(0)} · {date}
        </text>
      </g>
    );
  };

  return (
    <section className="card chart">
      <header>
        <h3>
          {is4h ? t.history.title4h : t.history.title}
          <InfoTip label={t.history.infoLabel} title={t.history.infoTitle}>
            <p>{t.history.info1}</p>
            <p>{t.history.info2}</p>
            <p>{t.history.info4h}</p>
          </InfoTip>
        </h3>
        <div className="chart-controls">
          <div className="segmented small" role="group" aria-label={t.history.rangeAria}>
            {RANGES.map((r) => (
              <button key={r.id} className={range === r.id ? "active" : ""} onClick={() => selectRange(r)}>
                {t.history.ranges[r.id]}
              </button>
            ))}
          </div>
          <div className="segmented small" role="group" aria-label="Zoom">
            <button onClick={() => zoomButton(1.5)} aria-label={t.history.zoomOut} title={t.history.zoomOut} disabled={span >= N - 1.5}>−</button>
            <button onClick={() => zoomButton(1 / 1.5)} aria-label={t.history.zoomIn} title={t.history.zoomIn} disabled={span <= minSpan + 0.5}>+</button>
          </div>
        </div>
      </header>

      <p className="chart-readout">
        <span className="muted num">{history.dates[h]?.replace("T", " ")}</span>
        <span className="legend legend-price num">
          {t.history.price} <strong>{history.price[h]?.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</strong>
        </span>
        <span className="legend legend-score num">
          {is4h ? t.history.score4h : "Score"} <strong>{history.score[h]?.toFixed(0)}</strong>
        </span>
        {want4h && !h4 && <span className="muted">{t.history.loading4h}</span>}
      </p>

      <div ref={wrapRef} className="chart-area">
        <svg
          ref={svgRef}
          width={width}
          height={H}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={t.history.chartAria}
        >
          <defs>
            <clipPath id={`${uid}p`}>
              <rect x={PAD_L} y={0} width={plotW} height={heights.price} />
            </clipPath>
            <clipPath id={`${uid}s`}>
              <rect x={PAD_L} y={scoreTop - 6} width={plotW} height={heights.score + 12} />
            </clipPath>
          </defs>

          {chart.priceTicks.map((p, k) => (
            <g key={k}>
              <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.yPrice(p)} y2={chart.yPrice(p)} className="grid" />
              <text x={PAD_L + plotW + 6} y={chart.yPrice(p) + 4} className="axis">{shortUsd(p)}</text>
            </g>
          ))}
          <path d={chart.pricePath} className="line-price" clipPath={`url(#${uid}p)`} />

          {[20, 40, 60, 80].map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={PAD_L + plotW} y1={yScore(t)} y2={yScore(t)} className="grid" />
              <text x={PAD_L + plotW + 6} y={yScore(t) + 4} className="axis">{t}</text>
            </g>
          ))}
          <rect x={PAD_L} width={plotW} y={yScore(100)} height={yScore(80) - yScore(100)} className="zone-hot" />
          <rect x={PAD_L} width={plotW} y={yScore(20)} height={yScore(0) - yScore(20)} className="zone-cold" />
          <path d={chart.scorePath} className="line-score" clipPath={`url(#${uid}s)`} />

          {/* Sin la marca que quedaría cortada por el borde izquierdo */}
          {ticks.filter((t) => x(t.i) >= PAD_L + 16).map((t) => (
            <text key={t.i} x={x(t.i)} y={scoreBottom + 15} className="axis" textAnchor="middle">{t.label}</text>
          ))}

          {v1 > v0 && [extreme(chart.iMax, "max"), extreme(chart.iMin, "min")]}

          {hover !== null && (
            <>
              <line x1={x(h)} x2={x(h)} y1={0} y2={scoreBottom} className="crosshair" />
              <circle cx={x(h)} cy={chart.yPrice(history.price[h])} r="3.5" className="dot-price" />
              <circle cx={x(h)} cy={yScore(history.score[h])} r="3.5" className="dot-score" />
            </>
          )}
        </svg>
        {handle("price", heights.price, GAP)}
        {handle("score", scoreBottom + AXIS_H, HANDLE_H)}
      </div>

      <p className="chart-hint muted">
        {t.history.hint}
      </p>
    </section>
  );
}
