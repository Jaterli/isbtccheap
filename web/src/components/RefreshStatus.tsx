import { useEffect, useState } from "react";
import { t } from "../i18n";

interface Props {
  nextAt: number;
  loading: boolean;
}

function fmtCountdown(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Lleva su propio reloj para no repintar toda la app cada segundo. */
export function RefreshStatus({ nextAt, loading }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.ceil((nextAt - now) / 1000));

  // El texto completo ("Se actualiza en 9:47") queda para lectores de pantalla y como tooltip
  const label = loading ? t.refresh.updating : t.refresh.next(fmtCountdown(left));
  return (
    <span className="refresh num muted" role="timer" aria-label={label} title={label}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className={loading ? "spin" : undefined}>
        <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.6h-2.6" />
      </svg>
      <span aria-hidden="true">{loading ? "…" : fmtCountdown(left)}</span>
    </span>
  );
}
