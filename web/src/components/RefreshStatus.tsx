import { useEffect, useState, type ReactNode } from "react";
import { t } from "../i18n";

interface Props {
  nextAt: number;
  loading: boolean;
  info?: ReactNode;
}

function fmtCountdown(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Contador hasta la próxima actualización.
 * Lleva su propio reloj para no re-renderizar toda la app cada segundo. */
export function RefreshStatus({ nextAt, loading, info }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.ceil((nextAt - now) / 1000));

  return (
    <div className="refresh">
      <span className="num muted">
        {loading ? t.refresh.updating : t.refresh.next(fmtCountdown(left))}
        {info}
      </span>
    </div>
  );
}
