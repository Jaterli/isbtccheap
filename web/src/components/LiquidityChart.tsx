import { useMemo, useState, type PointerEvent } from "react";
import { locale, t } from "../i18n";
import { dateTickIndexes, fmtTime, linePath, logPriceScale, niceTicks, shortUsd, usd, useWidth } from "../lib/chart";
import type { LiquiditySeries } from "../lib/liquidity";

const PAD_L = 44;
const PAD_R = 56;
const PAD_T = 10;
const AXIS_H = 22;

export const rocPct = (r: number, digits = 2) =>
  `${r > 0 ? "+" : r < 0 ? "−" : ""}${t.percent(Math.abs(r * 100).toLocaleString(locale, { maximumFractionDigits: digits }))}`;

const date = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Precio de BTC (eje derecho, logarítmico) y variación de la liquidez de 13 semanas antes (eje izquierdo). */
export function LiquidityChart({ data, showFed }: { data: LiquiditySeries; showFed: boolean }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const plotH = width < 600 ? 260 : 340;
  const plotW = width - PAD_L - PAD_R;
  const H = PAD_T + plotH + AXIS_H;
  const N = data.time.length;
  const x = (i: number) => PAD_L + (N > 1 ? (i / (N - 1)) * plotW : 0);

  const chart = useMemo(() => {
    const rocs = [...data.roc, ...(showFed ? data.fedRoc : [])].filter((v): v is number => v !== null);
    const lo = Math.min(0, ...rocs);
    const hi = Math.max(0, ...rocs);
    const pad = (hi - lo || 0.01) * 0.06;
    const yRoc = (v: number) => PAD_T + plotH - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * plotH;
    const rocTicks = niceTicks(lo, hi, 4);
    const prices = data.btc.filter((v): v is number => v !== null);
    const { y: yPrice, ticks: priceTicks } = logPriceScale(prices.length ? prices : [1, 2], PAD_T, plotH);
    let lastPrice = data.btc.length - 1;
    while (lastPrice >= 0 && data.btc[lastPrice] === null) lastPrice--;
    return {
      yRoc,
      rocTicks,
      yPrice,
      priceTicks,
      lastPrice,
      roc: linePath(data.roc, x, yRoc),
      fed: showFed ? linePath(data.fedRoc, x, yRoc) : "",
      btc: linePath(data.btc, x, yPrice),
    };
  }, [data, plotW, plotH, showFed]);

  const dateTicks = useMemo(() => dateTickIndexes(N, plotW), [N, plotW]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(N - 1, Math.max(0, Math.round(((e.clientX - r.left - PAD_L) / plotW) * (N - 1)))));
  };

  const h = hover ?? N - 1;
  const tx = t.liquidity;
  const roc = data.roc[h];
  const fed = data.fedRoc[h];
  const btc = data.btc[h];

  return (
    <div className="vol-chart" ref={ref}>
      <p className="chart-readout">
        <span className="muted num">{fmtTime(data.time[h], "1d", true)}</span>
        <span className="legend legend-price num">
          {tx.legend.price} <strong>{btc === null ? tx.legend.pending : usd(btc)}</strong>
        </span>
        <span className="legend liq-roc num">
          {tx.legend.roc(date(data.liqTime[h]))} <strong>{roc === null ? "—" : rocPct(roc)}</strong>
        </span>
        {showFed && (
          <span className="legend liq-fed num">
            {tx.legend.fed} <strong>{fed === null ? "—" : rocPct(fed)}</strong>
          </span>
        )}
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
        {chart.lastPrice >= 0 && chart.lastPrice < N - 1 && (
          <>
            <rect x={x(chart.lastPrice)} y={PAD_T} width={x(N - 1) - x(chart.lastPrice)} height={plotH} className="liq-ahead" />
            {/* Solo si cabe en el tramo (en periodos largos es estrecho) */}
            {x(N - 1) - x(chart.lastPrice) > 130 && (
              <text x={x(chart.lastPrice) + 6} y={PAD_T + 14} className="axis">
                {tx.ahead}
              </text>
            )}
          </>
        )}
        <path d={chart.btc} className="line-price" />
        {showFed && <path d={chart.fed} className="liq-fed-line" />}
        <path d={chart.roc} className="liq-line" />
        {chart.lastPrice >= 0 && (
          <text x={x(chart.lastPrice) - 4} y={chart.yPrice(data.btc[chart.lastPrice]!) - 8} className="axis liq-today" textAnchor="end">
            {tx.today}
          </text>
        )}

        {dateTicks.map((i, k) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={k === 0 ? "start" : k === dateTicks.length - 1 ? "end" : "middle"}>
            {/* En periodos cortos, con día: si no, se repetiría el mes */}
            {fmtTime(data.time[i], N < 60 ? "1h" : "1d", false)}
          </text>
        ))}
        {hover !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} className="crosshair" />
            {roc !== null && <circle cx={x(h)} cy={chart.yRoc(roc)} r="3.5" className="liq-dot" />}
            {btc !== null && <circle cx={x(h)} cy={chart.yPrice(btc)} r="3.5" className="dot-price" />}
          </>
        )}
      </svg>
    </div>
  );
}
