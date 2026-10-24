import { useState } from "react";
import { t } from "../i18n";

// Periodo de la muestra de las tarjetas de estadística histórica. Los nombres están en i18n (t.periods)
const PERIODS = [
  { id: "2y", days: 730 },
  { id: "4y", days: 1461 },
  { id: "8y", days: 2922 },
  { id: "all", days: Infinity },
];
const DEFAULT_PERIOD = "8y";

/** Periodo elegido (recordado en `storageKey`) y su duración en días. */
export function usePeriod(storageKey: string) {
  const [period, setPeriod] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? DEFAULT_PERIOD;
    } catch {
      return DEFAULT_PERIOD;
    }
  });
  const days = (PERIODS.find((p) => p.id === period) ?? PERIODS.find((p) => p.id === DEFAULT_PERIOD)!).days;
  const select = (id: string) => {
    setPeriod(id);
    try {
      localStorage.setItem(storageKey, id);
    } catch {
      /* almacenamiento no disponible: no pasa nada */
    }
  };
  return { period, days, select };
}

/** Primer índice del histórico dentro del periodo. */
export const periodStart = (length: number, days: number) => Math.max(0, length - days);

export function PeriodSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="segmented small" role="group" aria-label={t.periodAria}>
      {PERIODS.map((p) => (
        <button key={p.id} className={value === p.id ? "active" : ""} onClick={() => onChange(p.id)}>
          {t.periods[p.id]}
        </button>
      ))}
    </div>
  );
}
