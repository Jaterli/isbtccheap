import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import { fetchCandles } from "../lib/binance";
import { axisPad, fmtTime, linePath, logPriceScale, shortUsd, usd, useWidth } from "../lib/chart";
import type { CandleTf } from "../lib/series";
import { RefreshStatus } from "./RefreshStatus";

const PAD_L = 4;
const PAD_T = 6;
const AXIS_H = 18;

// Temporalidad propia de esta tarjeta, independiente de la del score, y velas que se dibujan en cada una
const PRICE_TFS = ["15m", "1h", "4h", "1d", "1w"] as const;
type PriceTf = (typeof PRICE_TFS)[number];
// (60-90: en un móvil quedan 4-5 px entre cierres, lo justo para que cada punto se distinga)
const VISIBLE: Record<PriceTf, number> = { "15m": 64, "1h": 72, "4h": 60, "1d": 90, "1w": 78 };
const REFRESH_MS: Record<PriceTf, number> = { "15m": 60_000, "1h": 120_000, "4h": 300_000, "1d": 600_000, "1w": 1_800_000 };
// Fechas del eje: con la hora en los tramos de horas o pocos días, sin el día en el semanal
const AXIS_FMT: Record<PriceTf, Intl.DateTimeFormatOptions> = {
  "15m": { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  "1h": { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  "4h": { day: "numeric", month: "short" },
  "1d": { day: "numeric", month: "short" },
  "1w": { month: "short", year: "numeric" },
};
// Formato de la fecha de la lectura: 15 min como intradía
const AXIS_TF: Record<PriceTf, CandleTf> = { "15m": "1h", "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w" };
const TF_KEY = "isbtccheap:price-tf";
// La tarjeta solo se ve en móvil (styles.css): en pantallas mayores no se piden velas
const MOBILE = "(max-width: 639px)";

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

function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** Precio de cierre de las últimas velas, con su propio selector de temporalidad (solo en móvil). */
export function PriceCard() {
  const { ref, width } = useWidth(200);
  const [hover, setHover] = useState<number | null>(null);
  const [tf, setTf] = useState<PriceTf>(loadTf);
  const { closes: data, nextAt, loading } = useCloses(tf, useMedia(MOBILE));
  const tx = t.priceCard;
  const axisTf = AXIS_TF[tf];

  const select = (v: PriceTf) => {
    setTf(v);
    setHover(null);
    try {
      localStorage.setItem(TF_KEY, v);
    } catch {
      /* almacenamiento no disponible: no pasa nada */
    }
  };

  const view = useMemo(() => {
    if (!data || data.close.length < 2) return null;
    const from = Math.max(0, data.close.length - VISIBLE[tf]);
    return { time: data.time.slice(from), open: data.open.slice(from), close: data.close.slice(from) };
  }, [data, tf]);

  const H = width < 520 ? 130 : 150;
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
    <article className="card price-card">
      <header>
        <h3>{tx.title}</h3>
        <span className="muted small">{tx.period[tf]}</span>
      </header>
      <div className="segmented small timeframes price-tfs" role="radiogroup" aria-label={t.timeframeAria}>
        {PRICE_TFS.map((v) => (
          <button key={v} role="radio" aria-checked={tf === v} aria-label={tx.tfs[v].label} title={tx.tfs[v].label} className={tf === v ? "active" : ""} onClick={() => select(v)}>
            {tx.tfs[v].short}
          </button>
        ))}
      </div>
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
              {/* Un punto por cierre de vela (el último, el precio actual con la vela en curso), verde si está por encima de
                  su apertura y rojo si por debajo */}
              <g className="price-card-dots">
                {view.close.map((c, i) => (
                  <circle key={i} cx={x(i)} cy={chart.y(c)} r="1.3" className={dir(i)} />
                ))}
              </g>
              {[0, N - 1].map((i, k) => (
                <text key={i} x={x(i)} y={H - 4} className="axis" textAnchor={k === 0 ? "start" : "end"}>
                  {new Date(view.time[i]).toLocaleString(locale, AXIS_FMT[tf])}
                </text>
              ))}
              {hover !== null && (
                <>
                  <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />
                  <circle cx={x(h)} cy={chart.y(view.close[h])} r="3" className={`dot-price price-card-now ${dir(h) ?? ""}`} />
                </>
              )}
            </svg>
          </>
        ) : (
          <p className="muted price-card-empty">{t.loading}</p>
        )}
      </div>
    </article>
  );
}
