import { useEffect, useState, type ReactNode } from "react";

interface Props {
  nextAt: number;
  loading: boolean;
  onRefresh: () => void;
  info?: ReactNode;
}

function fmtCountdown(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Contador hasta la próxima actualización + botón de actualizar ahora.
 * Lleva su propio reloj para no re-renderizar toda la app cada segundo. */
export function RefreshStatus({ nextAt, loading, onRefresh, info }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.ceil((nextAt - now) / 1000));

  return (
    <div className="refresh">
      <span className="num muted">
        {loading ? "Actualizando…" : `Próxima actualización en ${fmtCountdown(left)}`}
        {info}
      </span>
      <button className="btn btn-icon" onClick={onRefresh} disabled={loading} aria-label="Actualizar ahora" title="Actualizar ahora">
        <span aria-hidden="true" className={loading ? "spin" : ""}>↻</span>
      </button>
    </div>
  );
}
