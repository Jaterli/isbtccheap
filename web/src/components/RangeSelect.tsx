import { useState } from "react";
import { t } from "../i18n";

// Periodo mostrado en las gráficas de histórico diario (valoración, caídas)
const RANGES = [
  { id: "1y", days: 365 },
  { id: "4y", days: 1461 },
  { id: "all", days: Infinity },
];

/** Periodo elegido, recordado con `key`. Devuelve sus días (Infinity en "Todo") y el selector. */
export function useRange(key: string, fallback = "all") {
  const [range, setRange] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return RANGES.some((r) => r.id === v) ? v! : fallback;
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
        {RANGES.map((r) => (
          <button key={r.id} className={r.id === range ? "active" : ""} onClick={() => select(r.id)}>
            {t.charts.ranges[r.id]}
          </button>
        ))}
      </div>
    </div>
  );
  return { days: RANGES.find((r) => r.id === range)!.days, control };
}
