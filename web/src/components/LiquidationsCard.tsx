import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import { axisPad, dateTickIndexes, fmtTime, logPriceScale, niceTicks, shortUsd, usd, useWidth } from "../lib/chart";
import { getJson } from "../lib/data";
import { useHashScroll } from "../lib/hashScroll";
import { InfoTip } from "./InfoTip";
import { Rich } from "./Rich";
import { useRange } from "./RangeSelect";

/** liquidations.json de news/build_liquidations.py (Coinalyze, cada hora): millones de dólares por vela, sin huecos */
interface LiqSeries {
  start: number;
  step: number;
  long: number[];
  short: number[];
  close: (number | null)[];
}
type Tf = "4h" | "1d";
interface LiqJson {
  updated_at: string;
  "1d": LiqSeries;
  "4h": LiqSeries;
}

const URL = `${import.meta.env.BASE_URL}news/liquidations.json`;
const TFS: Tf[] = ["4h", "1d"];
const TF_KEY = "isbtccheap:liq-tf";
// En 4 h solo hay unos 8 meses
const RANGES: Record<Tf, { id: string; days: number }[]> = {
  "4h": [{ id: "6m", days: 182 }, { id: "all", days: Infinity }],
  "1d": [{ id: "6m", days: 182 }, { id: "1y", days: 365 }, { id: "all", days: Infinity }],
};
// La lectura marca lo que pasa de este múltiplo de su media de 90 días
const RATIO_SHOWN = 2;
const PAD_T = 10;
const AXIS_H = 22;
const DAY = 86_400_000;

type CapLevel = "capitulation_levels" | "intense_capitulation";
// Día UTC (AAAA-MM-DD) de una vela: las de 4 h caen en el día de capitulación de su fecha
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const m = (v: number, d = 1) => t.liquidations.m(v.toLocaleString(locale, { maximumFractionDigits: d }));

/**
 * Tarjeta de la página de sentimiento: liquidaciones de largos (hacia abajo) y de cortos (hacia arriba) de los futuros
 * perpetuos de BTC, frente al precio. Informativa: el índice no la usa. Sin el fichero (aún no generado), no se muestra.
 */
export function LiquidationsCard() {
  const [data, setData] = useState<LiqJson | null>(null);
  const [tf, setTfState] = useState<Tf>(() => {
    try {
      return localStorage.getItem(TF_KEY) === "4h" ? "4h" : "1d";
    } catch {
      return "1d";
    }
  });
  const setTf = (x: Tf) => {
    setTfState(x);
    try {
      localStorage.setItem(TF_KEY, x);
    } catch {
      /* sin almacenamiento */
    }
  };
  const range1d = useRange("isbtccheap:liq-range-1d", "1y", RANGES["1d"]);
  const range4h = useRange("isbtccheap:liq-range-4h", "6m", RANGES["4h"]);
  const range = tf === "1d" ? range1d : range4h;

  // Días en niveles de capitulación (capitulation.json del pipeline): se sombrean detrás de las barras
  const [capDays, setCapDays] = useState<Map<string, CapLevel>>(new Map());
  useEffect(() => {
    fetch(URL, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData, () => {});
    getJson("capitulation.json").then(
      (c: { episodes?: { from: string; to: string; level: CapLevel; intense_days?: string[] }[] }) => {
        // El nivel de cada día (el que daba la tarjeta de capitulación ese día), no el más alto del episodio
        const days = new Map<string, CapLevel>();
        for (const e of c.episodes ?? []) {
          const intense = e.intense_days && new Set(e.intense_days);
          for (let d = Date.parse(`${e.from}T00:00:00Z`); d <= Date.parse(`${e.to}T00:00:00Z`); d += DAY) {
            const k = dayKey(d);
            // Sin intense_days (un capitulation.json anterior), el nivel del episodio
            days.set(k, !intense ? e.level : intense.has(k) ? "intense_capitulation" : "capitulation_levels");
          }
        }
        setCapDays(days);
      },
      () => {},
    );
  }, []);

  // La serie elegida, recortada al periodo, con la media de 90 días de los largos (calculada antes de recortar)
  const view = useMemo(() => {
    if (!data?.[tf]) return null;
    const s = data[tf];
    const per90 = Math.round((90 * DAY) / s.step);
    const avg: (number | null)[] = [];
    let sum = 0;
    s.long.forEach((v, i) => {
      avg.push(i >= 30 * (DAY / s.step) ? sum / Math.min(i, per90) : null);
      sum += v;
      if (i >= per90) sum -= s.long[i - per90];
    });
    const n = s.long.length;
    const from = range.days === Infinity ? 0 : Math.max(0, n - Math.round((range.days * DAY) / s.step));
    const time = Array.from({ length: n - from }, (_, i) => s.start + (from + i) * s.step);
    const cap = time.map((ms) => capDays.get(dayKey(ms)) ?? null);
    return { time, long: s.long.slice(from), short: s.short.slice(from), close: s.close.slice(from), avg: avg.slice(from), cap };
  }, [data, tf, range.days, capDays]);

  // El enlace de la tarjeta de alertas (#liquidaciones): la tarjeta solo existe cuando llegan sus datos
  useHashScroll("liquidaciones", !!data);
  if (!data) return null;
  const tx = t.liquidations;

  return (
    <section className="card chart vol lqd-card" id="liquidaciones">
      <header>
        <h2>
          {tx.card}
          <InfoTip label={tx.card} title={tx.card}>
            {tx.info.map((p) => (
              <p key={p}>
                <Rich text={p} />
              </p>
            ))}
          </InfoTip>
        </h2>
      </header>
      <div className="sent-controls">
        <div className="segmented small" role="radiogroup" aria-label={tx.tfAria}>
          {TFS.map((x) => (
            <button key={x} role="radio" aria-checked={tf === x} className={[x === "1d" && "daily", tf === x && "active"].filter(Boolean).join(" ")} onClick={() => setTf(x)}>
              {t.timeframes[x].short}
            </button>
          ))}
        </div>
        {range.control}
      </div>
      {view && view.time.length > 1 ? <LiqChart v={view} tf={tf} /> : <p className="muted chart-placeholder">{t.noData}</p>}
      <p className="muted small vol-note">{tx.note}</p>
    </section>
  );
}

interface View {
  time: number[];
  long: number[];
  short: number[];
  close: (number | null)[];
  avg: (number | null)[];
  cap: (CapLevel | null)[];
}

function LiqChart({ v, tf }: { v: View; tf: Tf }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const tx = t.liquidations;
  const plotH = width < 600 ? 240 : 320;
  const H = PAD_T + plotH + AXIS_H;
  const N = v.time.length;

  // Cortos hacia arriba y largos hacia abajo desde el cero, cada lado con el alto que le toca por su máximo
  const scale = useMemo(() => {
    const hiS = Math.max(1, ...v.short);
    const hiL = Math.max(1, ...v.long);
    const k = plotH / (hiS + hiL);
    const y0 = PAD_T + hiS * k;
    const ticks = niceTicks(-hiL, hiS, 5).filter((x) => x !== 0);
    const prices = v.close.filter((p): p is number => p !== null);
    const { y: yPrice, ticks: priceTicks } = logPriceScale(prices.length ? prices : [1, 2], PAD_T, plotH);
    return { y: (x: number) => y0 - x * k, y0, ticks, yPrice, priceTicks };
  }, [v, plotH]);
  const PAD_L = axisPad(scale.ticks.map((x) => m(Math.abs(x), 0)));
  const plotW = width - PAD_L - axisPad(scale.priceTicks.map(shortUsd));
  const slot = plotW / N;
  const x = (i: number) => PAD_L + (i + 0.5) * slot;

  const chart = useMemo(() => {
    const w = Math.max(0.6, slot * 0.75);
    const bars = (xs: number[], sign: 1 | -1) =>
      xs
        .map((val, i) => (val > 0 ? `M${(x(i) - w / 2).toFixed(1)},${scale.y0.toFixed(1)}h${w.toFixed(2)}V${scale.y(sign * val).toFixed(1)}h${(-w).toFixed(2)}Z` : ""))
        .join("");
    let d = "";
    let pen = false;
    v.close.forEach((p, i) => {
      if (p === null) return void (pen = false);
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${scale.yPrice(p).toFixed(1)}`;
      pen = true;
    });
    // Tramos seguidos con el mismo nivel de capitulación: una franja cada uno, de 3 px como poco para que un solo día se
    // vea también en el histórico completo
    const caps: { x: number; w: number; level: CapLevel }[] = [];
    v.cap.forEach((c, i) => {
      if (!c) return;
      const last = caps.at(-1);
      if (last && last.level === c && v.cap[i - 1] === c) last.w = PAD_L + (i + 1) * slot - last.x;
      else caps.push({ x: PAD_L + i * slot, w: slot, level: c });
    });
    for (const c of caps) if (c.w < 3) Object.assign(c, { x: c.x + c.w / 2 - 1.5, w: 3 });
    return { shorts: bars(v.short, 1), longs: bars(v.long, -1), price: d, caps };
  }, [v, scale, slot, PAD_L]);
  const dateTicks = useMemo(() => dateTickIndexes(N, plotW), [N, plotW]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.floor((e.clientX - r.left - PAD_L) / slot))));
  };
  const h = hover ?? N - 1;
  const price = v.close[h];
  const avg = v.avg[h];
  const ratio = avg ? v.long[h] / avg : null;

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(v.time[h], tf, true)}</span>
        <span className="legend legend-price num">
          {tx.legend.price} <strong>{price === null ? "—" : usd(price)}</strong>
        </span>
        <span className="legend lqd-long num">
          {tx.legend.long} <strong>{m(v.long[h])}</strong>
          {ratio !== null && ratio >= RATIO_SHOWN && tx.ratio(tx.times(ratio.toLocaleString(locale, { maximumFractionDigits: 1 })))}
        </span>
        <span className="legend lqd-short num">
          {tx.legend.short} <strong>{m(v.short[h])}</strong>
        </span>
        {v.cap[h] && <span className={`lqd-cap-tag ${v.cap[h]}`}>{t.capitulation.levels[v.cap[h]!]}</span>}
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {scale.ticks.map((tv) => (
          <g key={tv}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={scale.y(tv)} y2={scale.y(tv)} className="grid" />
            <text x={PAD_L - 6} y={scale.y(tv) + 4} className="axis" textAnchor="end">
              {m(Math.abs(tv), 0)}
            </text>
          </g>
        ))}
        {scale.priceTicks.map((p) => (
          <text key={p} x={PAD_L + plotW + 6} y={scale.yPrice(p) + 4} className="axis">
            {shortUsd(p)}
          </text>
        ))}
        {chart.caps.map((c) => (
          <rect key={c.x} x={c.x} y={PAD_T} width={c.w} height={plotH} className={`lqd-cap ${c.level}`} />
        ))}
        <line x1={PAD_L} x2={PAD_L + plotW} y1={scale.y0} y2={scale.y0} className="lqd-zero" />
        <path d={chart.shorts} className="lqd-short" />
        <path d={chart.longs} className="lqd-long" />
        <path d={chart.price} className="line-price" />
        {dateTicks.map((i, k) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={k === 0 ? "start" : k === dateTicks.length - 1 ? "end" : "middle"}>
            {fmtTime(v.time[i], tf, false)}
          </text>
        ))}
        {hover !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />
            {price !== null && <circle cx={x(h)} cy={scale.yPrice(price)} r="3.5" className="dot-price" />}
          </>
        )}
      </svg>
    </div>
  );
}

