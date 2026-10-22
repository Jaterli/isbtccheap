import { useEffect, useMemo, useRef, useState } from "react";
import type { History } from "../types";

const RANGES = [
  { id: "1m", label: "1 mes", days: 30 },
  { id: "1y", label: "1 año", days: 365 },
  { id: "4y", label: "4 años", days: 1461 },
  { id: "all", label: "Todo", days: Infinity },
];

const GAP = 16;
const PAD_L = 8;
const PAD_R = 44;

export function HistoryChart({ history }: { history: History }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [range, setRange] = useState("4y");
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)!.days;
    const start = Math.max(0, history.dates.length - days);
    return {
      dates: history.dates.slice(start),
      price: history.price.slice(start),
      score: history.score.slice(start),
    };
  }, [history, range]);

  // En pantallas estrechas el gráfico es más bajo para no ocupar toda la vista
  const PRICE_H = width < 520 ? 140 : width < 900 ? 170 : 220;
  const SCORE_H = width < 520 ? 80 : 100;
  const H = PRICE_H + GAP + SCORE_H + 8;

  const n = data.dates.length;
  const plotW = width - PAD_L - PAD_R;
  const x = (i: number) => PAD_L + (i / Math.max(1, n - 1)) * plotW;
  const logs = data.price.map(Math.log10);
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  const yPrice = (p: number) => PRICE_H - ((Math.log10(p) - lo) / (hi - lo || 1)) * (PRICE_H - 8) - 4;
  const yScore = (s: number) => PRICE_H + GAP + SCORE_H - (s / 100) * SCORE_H;

  const pricePath = data.price.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yPrice(p).toFixed(1)}`).join("");
  const scorePath = data.score.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yScore(s).toFixed(1)}`).join("");

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - PAD_L) / plotW) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  const h = hover ?? n - 1;

  return (
    <section className="card chart">
      <header>
        <h3>Histórico del score diario frente al precio</h3>
        <div className="segmented small" role="group" aria-label="Rango del histórico">
          {RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? "active" : ""} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </header>
      <p className="chart-readout">
        <span className="muted">{data.dates[h]}</span>
        <span>{data.price[h]?.toLocaleString("es-ES", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
        <span>
          Score <strong>{data.score[h]?.toFixed(0)}</strong>
        </span>
      </p>
      <div ref={ref}>
        <svg width={width} height={H} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Gráfico histórico del precio de Bitcoin y del Satoshi Score">
          {[20, 40, 60, 80].map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={PAD_L + plotW} y1={yScore(t)} y2={yScore(t)} className="grid" />
              <text x={PAD_L + plotW + 6} y={yScore(t) + 4} className="axis">{t}</text>
            </g>
          ))}
          <rect x={PAD_L} width={plotW} y={yScore(100)} height={yScore(80) - yScore(100)} className="zone-hot" />
          <rect x={PAD_L} width={plotW} y={yScore(20)} height={yScore(0) - yScore(20)} className="zone-cold" />
          <path d={pricePath} className="line-price" />
          <path d={scorePath} className="line-score" />
          <text x={PAD_L + plotW + 6} y={12} className="axis">precio</text>
          <text x={PAD_L + plotW + 6} y={PRICE_H + GAP + 10} className="axis">score</text>
          {hover !== null && (
            <>
              <line x1={x(h)} x2={x(h)} y1={0} y2={PRICE_H + GAP + SCORE_H} className="crosshair" />
              <circle cx={x(h)} cy={yPrice(data.price[h])} r="3.5" className="dot-price" />
              <circle cx={x(h)} cy={yScore(data.score[h])} r="3.5" className="dot-score" />
            </>
          )}
        </svg>
      </div>
    </section>
  );
}
