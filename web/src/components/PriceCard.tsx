import { useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import { fetchCandles } from "../lib/binance";
import { axisPad, fmtTime, linePath, logPriceScale, shortUsd, usd, useWidth } from "../lib/chart";
import type { CandleTf } from "../lib/series";
import { RefreshStatus } from "./RefreshStatus";

const PAD_L = 4;
const PAD_T = 6;
const AXIS_H = 18;

// Temporalidad propia de esta tarjeta, independiente de la del score, y velas que se dibujan en cada una
const PRICE_TFS = ["15m", "1h", "4h", "1d"] as const;
type PriceTf = (typeof PRICE_TFS)[number];
// (60-90: en un móvil quedan 4-5 px entre cierres, lo justo para que cada punto se distinga). Con − y + se ven más o
// menos, entre MIN_VISIBLE y todas las descargadas
const MIN_VISIBLE = 20;
const ZOOM = 1.5;
// Alto del gráfico, ajustable arrastrando la barra de debajo (se guarda)
const HEIGHT_KEY = "isbtccheap:price-height";
const HEIGHT_LIMITS = [90, 360] as const;
const VISIBLE: Record<PriceTf, number> = { "15m": 64, "1h": 72, "4h": 60, "1d": 90 };
const REFRESH_MS: Record<PriceTf, number> = { "15m": 60_000, "1h": 120_000, "4h": 300_000, "1d": 600_000 };
// Fechas del eje según el tramo visible (cambia con el zoom): con la hora si son pocos días; sin el día, con el año, si
// pasa de medio año
const axisFmt = (spanMs: number): Intl.DateTimeFormatOptions =>
  spanMs <= 4 * 86_400_000
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : spanMs <= 180 * 86_400_000
      ? { day: "numeric", month: "short" }
      : { month: "short", year: "numeric" };
// Formato de la fecha de la lectura: 15 min como intradía
const AXIS_TF: Record<PriceTf, CandleTf> = { "15m": "1h", "1h": "1h", "4h": "4h", "1d": "1d" };
const TF_KEY = "isbtccheap:price-tf";

function loadHeight(): number | null {
  try {
    const h = Number(localStorage.getItem(HEIGHT_KEY));
    return h >= HEIGHT_LIMITS[0] && h <= HEIGHT_LIMITS[1] ? h : null;
  } catch {
    return null;
  }
}

function loadTf(): PriceTf {
  try {
    const saved = localStorage.getItem(TF_KEY);
    return PRICE_TFS.includes(saved as PriceTf) ? (saved as PriceTf) : "1d";
  } catch {
    return "1d";
  }
}

interface Closes {
  time: number[];
  open: number[];
  close: number[];
}

/** Velas de `tf`, recargadas a su ritmo (con su propio reloj, independiente del del score), mientras `active`. */
function useCloses(tf: PriceTf, active: boolean) {
  const [data, setData] = useState<{ tf: PriceTf; closes: Closes } | null>(null);
  const [nextAt, setNextAt] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      setLoading(true);
      try {
        const candles = await fetchCandles(tf);
        if (!cancelled) setData({ tf, closes: { time: candles.map((c) => c.time), open: candles.map((c) => c.open), close: candles.map((c) => c.close) } });
      } catch {
        /* sin respuesta se mantiene lo último y se reintenta en el siguiente ciclo */
      }
      if (cancelled) return;
      setLoading(false);
      setNextAt(Date.now() + REFRESH_MS[tf]);
      timer = setTimeout(load, REFRESH_MS[tf]);
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tf, active]);
  // Recién cambiada la temporalidad, no se muestran las velas de la anterior
  return { closes: data?.tf === tf ? data.closes : null, nextAt, loading };
}

/**
 * Precio de cierre de las últimas velas, con su propia temporalidad. En móvil se ve siempre; en pantallas mayores, solo
 * si se abre con el botón flotante (App.tsx). Solo pide velas mientras `active` (visible).
 */
export function PriceCard({ active }: { active: boolean }) {
  const { ref, width } = useWidth(200);
  const [hover, setHover] = useState<number | null>(null);
  const [tf, setTf] = useState<PriceTf>(loadTf);
  const { closes: data, nextAt, loading } = useCloses(tf, active);
  const tx = t.priceCard;
  const axisTf = AXIS_TF[tf];

  const [visible, setVisible] = useState(VISIBLE[tf]);
  const [height, setHeight] = useState<number | null>(loadHeight);

  const select = (v: PriceTf) => {
    setTf(v);
    setVisible(VISIBLE[v]);
    setHover(null);
    try {
      localStorage.setItem(TF_KEY, v);
    } catch {
      /* almacenamiento no disponible: no pasa nada */
    }
  };

  const view = useMemo(() => {
    if (!data || data.close.length < 2) return null;
    const from = Math.max(0, data.close.length - visible);
    return { time: data.time.slice(from), open: data.open.slice(from), close: data.close.slice(from) };
  }, [data, visible]);

  const total = data?.close.length ?? 0;
  const zoom = (factor: number) => {
    setHover(null);
    setVisible((v) => Math.round(Math.min(Math.max(total, MIN_VISIBLE), Math.max(MIN_VISIBLE, v * factor))));
  };

  const H = height ?? (width < 520 ? 130 : 150);
  const saveHeight = (h: number | null) => {
    const v = h === null ? null : Math.round(Math.min(HEIGHT_LIMITS[1], Math.max(HEIGHT_LIMITS[0], h)));
    setHeight(v);
    try {
      if (v === null) localStorage.removeItem(HEIGHT_KEY);
      else localStorage.setItem(HEIGHT_KEY, String(v));
    } catch {
      /* almacenamiento no disponible */
    }
  };
  const startResize = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const y0 = e.clientY;
    const base = H;
    const move = (ev: globalThis.PointerEvent) => saveHeight(base + ev.clientY - y0);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const keyResize = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowUp" ? -10 : e.key === "ArrowDown" ? 10 : 0;
    if (!step) return;
    e.preventDefault();
    saveHeight(H + step);
  };

  const plotH = H - PAD_T - AXIS_H;
  const scale = useMemo(() => {
    if (!view) return null;
    const { y, ticks } = logPriceScale(view.close, PAD_T, plotH);
    return { y, ticks: ticks.length > 4 ? ticks.filter((_, k) => k % 2 === 0) : ticks };
  }, [view, plotH]);
  const plotW = width - PAD_L - axisPad(scale?.ticks.map(shortUsd) ?? []);
  const N = view?.close.length ?? 0;
  const x = (i: number) => PAD_L + (i / Math.max(1, N - 1)) * plotW;

  const chart = useMemo(() => {
    if (!view || !scale) return null;
    const { y, ticks } = scale;
    const line = linePath(view.close, x, y);
    const area = `${line}L${x(N - 1).toFixed(1)},${PAD_T + plotH}L${x(0).toFixed(1)},${PAD_T + plotH}Z`;
    return { y, ticks, line, area };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, scale, plotW]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.round(((e.clientX - r.left - PAD_L) / plotW) * (N - 1)))));
  };

  const h = hover ?? N - 1;
  const dir = (i: number) => (!view ? undefined : view.close[i] > view.open[i] ? "up" : view.close[i] < view.open[i] ? "down" : undefined);

  return (
    <article className="card price-card" id="precio">
      {/* Título y, en la misma fila, temporalidad y zoom (como en el histórico) */}
      <header>
        <h3>{tx.title}</h3>
        <div className="price-controls">
          <div className="segmented small timeframes price-tfs" role="radiogroup" aria-label={t.timeframeAria}>
            {PRICE_TFS.map((v) => (
              <button key={v} role="radio" aria-checked={tf === v} aria-label={tx.tfs[v].label} title={tx.tfs[v].label} className={tf === v ? "active" : ""} onClick={() => select(v)}>
                {tx.tfs[v].short}
              </button>
            ))}
          </div>
          <div className="segmented small" role="group" aria-label="Zoom">
            <button onClick={() => zoom(ZOOM)} aria-label={t.history.zoomOut} title={t.history.zoomOut} disabled={!total || visible >= total}>−</button>
            <button onClick={() => zoom(1 / ZOOM)} aria-label={t.history.zoomIn} title={t.history.zoomIn} disabled={!total || visible <= MIN_VISIBLE}>+</button>
          </div>
        </div>
      </header>
      <div ref={ref}>
        {view && chart ? (
          <>
            <p className="chart-readout">
              <span className="muted num">{fmtTime(view.time[h], axisTf, true)}</span>
              <span className="legend legend-price num">
                <strong>{usd(view.close[h])}</strong>
              </span>
              <RefreshStatus nextAt={nextAt} loading={loading} />
            </p>
            <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
              {chart.ticks.map((p) => (
                <g key={p}>
                  <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.y(p)} y2={chart.y(p)} className="grid" />
                  <text x={PAD_L + plotW + 6} y={chart.y(p) + 4} className="axis">{shortUsd(p)}</text>
                </g>
              ))}
              <defs>
                <linearGradient id="price-card-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" className="price-fill-top" />
                  <stop offset="1" className="price-fill-bottom" />
                </linearGradient>
              </defs>
              <path d={chart.area} fill="url(#price-card-fill)" />
              <path d={chart.line} className="line-price price-card-line" />
              {[0, N - 1].map((i, k) => (
                <text key={i} x={x(i)} y={H - 4} className="axis" textAnchor={k === 0 ? "start" : "end"}>
                  {new Date(view.time[i]).toLocaleString(locale, axisFmt(view.time[N - 1] - view.time[0]))}
                </text>
              ))}
              {hover !== null && (
                <>
                  <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />
                  <circle cx={x(h)} cy={chart.y(view.close[h])} r="3" className={`dot-price price-card-now ${dir(h) ?? ""}`} />
                </>
              )}
            </svg>
            <div
              className="resize-handle price-card-resize"
              role="separator"
              aria-orientation="horizontal"
              aria-label={tx.resize}
              aria-valuenow={H}
              aria-valuemin={HEIGHT_LIMITS[0]}
              aria-valuemax={HEIGHT_LIMITS[1]}
              tabIndex={0}
              title={t.history.resizeTitle}
              onPointerDown={startResize}
              onDoubleClick={() => saveHeight(null)}
              onKeyDown={keyResize}
            >
              <span />
            </div>
          </>
        ) : (
          <p className="muted price-card-empty">{t.loading}</p>
        )}
      </div>
    </article>
  );
}
