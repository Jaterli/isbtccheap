import { useMemo, useState, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import { fmtTime, logPriceScale, niceTicks, shortUsd, usd, useWidth } from "../lib/chart";
import type { LiquiditySeries } from "../lib/liquidity";

const PAD_L = 44;
const PAD_R = 56;
const PAD_T = 10;
const AXIS_H = 22;
const DAY = 86_400_000;

export const rocPct = (r: number, digits = 2) =>
  `${r > 0 ? "+" : r < 0 ? "−" : ""}${t.percent(Math.abs(r * 100).toLocaleString(locale, { maximumFractionDigits: digits }))}`;

const date = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Índice del último valor de `times` que no pasa de `t` (o -1). */
function indexAt(times: number[], t: number) {
  let lo = 0;
  let hi = times.length - 1;
  if (hi < 0 || times[0] > t) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Línea SVG sobre una escala de tiempo, saltando los huecos. */
function timePath(times: number[], values: (number | null)[], x: (t: number) => number, y: (v: number) => number) {
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) return void (pen = false);
    d += `${pen ? "L" : "M"}${x(times[i]).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

/**
 * Precio diario de BTC (eje derecho, logarítmico) y variación semanal de la liquidez global dibujada 13 semanas después
 * de su fecha (eje izquierdo). El eje x es de tiempo: el precio llega a hoy y la liquidez, 13 semanas más allá.
 */
export function LiquidityChart({ data }: { data: LiquiditySeries }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const plotH = width < 600 ? 260 : 340;
  const plotW = width - PAD_L - PAD_R;
  const H = PAD_T + plotH + AXIS_H;
  const t0 = Math.min(data.liqTime[0] ?? data.end, data.btcTime[0] ?? data.end);
  const t1 = data.end;
  const x = (t: number) => PAD_L + ((t - t0) / (t1 - t0 || 1)) * plotW;

  const chart = useMemo(() => {
    const rocs = data.roc.filter((v): v is number => v !== null);
    const lo = Math.min(0, ...rocs);
    const hi = Math.max(0, ...rocs);
    const pad = (hi - lo || 0.01) * 0.06;
    const yRoc = (v: number) => PAD_T + plotH - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * plotH;
    const prices = data.btc.filter((v): v is number => v !== null);
    const { y: yPrice, ticks: priceTicks } = logPriceScale(prices.length ? prices : [1, 2], PAD_T, plotH);
    const lastPrice = indexAt(data.btcTime, Infinity);
    const nTicks = Math.max(2, Math.floor(plotW / 110));
    const dateTicks = Array.from({ length: nTicks }, (_, k) => t0 + (k / (nTicks - 1)) * (t1 - t0));
    return {
      yRoc,
      rocTicks: niceTicks(lo, hi, 4),
      yPrice,
      priceTicks,
      lastPrice,
      dateTicks,
      roc: timePath(data.liqTime, data.roc, x, yRoc),
      btc: timePath(data.btcTime, data.btc, x, yPrice),
    };
  }, [data, plotW, plotH]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left - PAD_L) / plotW));
    setHover(t0 + f * (t1 - t0));
  };

  const tx = t.liquidity;
  const th = hover ?? t1;
  const li = indexAt(data.liqTime, th);
  const bi = indexAt(data.btcTime, th);
  const roc = li >= 0 ? data.roc[li] : null;
  // Pasado el último precio, BTC "aún no" tiene dato
  const btc = bi >= 0 && th - data.btcTime[bi] < 2 * DAY ? data.btc[bi] : null;
  const lastBtcTime = data.btcTime[chart.lastPrice];
  const short = t1 - t0 < 400 * DAY;

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{date(th)}</span>
        <span className="legend legend-price num">
          {tx.legend.price} <strong>{btc === null ? tx.legend.pending : usd(btc)}</strong>
        </span>
        <span className="legend liq-roc num">
          {tx.legend.roc(li >= 0 ? date(data.srcTime[li]) : "—")} <strong>{roc === null ? "—" : rocPct(roc)}</strong>
        </span>
      </p>
      <svg width={width} height={H} role="img" aria-label={tx.chartAria} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {chart.rocTicks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={chart.yRoc(v)} y2={chart.yRoc(v)} className={v === 0 ? "grid liq-zero" : "grid"} />
            <text x={PAD_L - 6} y={chart.yRoc(v) + 4} className="axis" textAnchor="end">
              {rocPct(v, 0)}
            </text>
          </g>
        ))}
        {chart.priceTicks.map((p) => (
          <text key={p} x={PAD_L + plotW + 6} y={chart.yPrice(p) + 4} className="axis">
            {shortUsd(p)}
          </text>
        ))}
        {/* Próximas semanas: la liquidez ya publicada anticipa un precio que aún no ha llegado */}
        {chart.lastPrice >= 0 && lastBtcTime < t1 && (
          <>
            <rect x={x(lastBtcTime)} y={PAD_T} width={x(t1) - x(lastBtcTime)} height={plotH} className="liq-ahead" />
            {/* Solo si cabe en el tramo (en periodos largos es estrecho) */}
            {x(t1) - x(lastBtcTime) > 130 && (
              <text x={x(lastBtcTime) + 6} y={PAD_T + 14} className="axis">
                {tx.ahead}
              </text>
            )}
          </>
        )}
        <path d={chart.btc} className="line-price" />
        <path d={chart.roc} className="liq-line" />
        {chart.lastPrice >= 0 && (
          <text x={x(lastBtcTime) - 4} y={chart.yPrice(data.btc[chart.lastPrice]!) - 8} className="axis liq-today" textAnchor="end">
            {tx.today}
          </text>
        )}

        {chart.dateTicks.map((tt, k) => (
          <text key={k} x={x(tt)} y={H - 6} className="axis" textAnchor={k === 0 ? "start" : k === chart.dateTicks.length - 1 ? "end" : "middle"}>
            {fmtTime(tt, short ? "1h" : "1d", false)}
          </text>
        ))}
        {hover !== null && (
          <>
            <line x1={x(th)} x2={x(th)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />
            {roc !== null && <circle cx={x(data.liqTime[li])} cy={chart.yRoc(roc)} r="3.5" className="liq-dot" />}
            {btc !== null && <circle cx={x(data.btcTime[bi])} cy={chart.yPrice(btc)} r="3.5" className="dot-price" />}
          </>
        )}
      </svg>
    </div>
  );
}
