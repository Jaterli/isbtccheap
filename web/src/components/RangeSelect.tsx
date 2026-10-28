import { useState } from "react";
import { t } from "../i18n";

// Periodo mostrado en las gráficas de histórico diario (valoración, caídas, categorías)
export const RANGES = [
  { id: "1y", days: 365 },
  { id: "4y", days: 1461 },
  { id: "all", days: Infinity },
];
// Para series cortas, como los flujos de ETF (desde 2024)
export const SHORT_RANGES = [
  { id: "3m", days: 91 },
  { id: "1y", days: 365 },
  { id: "all", days: Infinity },
];

/** Periodo elegido, recordado con `key`. Devuelve sus días (Infinity en "Todo") y el selector. */
export function useRange(key: string, fallback = "all", ranges = RANGES) {
  const [range, setRange] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return ranges.some((r) => r.id === v) ? v! : fallback;
    } catch {
      return fallback;
    }
  });
  const select = (r: string) => {
    setRange(r);
    try {
      localStorage.setItem(key, r);
    } catch {
      /* almacenamiento no disponible: no pasa nada */
    }
  };
  const control = (
    <div className="chart-controls">
      <div className="segmented small" role="group" aria-label={t.charts.rangeAria}>
        {ranges.map((r) => (
          <button key={r.id} className={r.id === range ? "active" : ""} onClick={() => select(r.id)}>
            {t.charts.ranges[r.id]}
          </button>
        ))}
      </div>
    </div>
  );
  return { days: ranges.find((r) => r.id === range)!.days, control };
}
