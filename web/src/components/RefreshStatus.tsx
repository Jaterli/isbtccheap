import { useEffect, useState } from "react";

interface Props {
  nextAt: number;
  intervalMs: number;
  updatedAt: number | null;
  loading: boolean;
  onRefresh: () => void;
}

function fmtInterval(ms: number) {
  const s = ms / 1000;
  return s < 60 ? `${s} s` : `${s / 60} min`;
}

function fmtCountdown(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Contador hasta la próxima actualización + botón de actualizar ahora.
 * Lleva su propio reloj para no re-renderizar toda la app cada segundo. */
export function RefreshStatus({ nextAt, intervalMs, updatedAt, loading, onRefresh }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.ceil((nextAt - now) / 1000));
  const progress = loading ? 0 : Math.min(1, (left * 1000) / intervalMs);

  return (
    <div className="refresh">
      <div className="refresh-row">
        <span className="muted">
          Se actualiza cada {fmtInterval(intervalMs)}
          {updatedAt && ` · última ${new Date(updatedAt).toLocaleTimeString("es-ES")}`}
        </span>
        <span className="num refresh-count" aria-live="polite">
          {loading ? "Actualizando…" : `Próxima en ${fmtCountdown(left)}`}
        </span>
        <button className="btn" onClick={onRefresh} disabled={loading}>
          <span aria-hidden="true">↻</span> Actualizar
        </button>
      </div>
      <div className="refresh-bar" aria-hidden="true">
        <div style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  );
}
