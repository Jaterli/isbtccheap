import { t } from "../i18n";

const BANDS = ["var(--band-1)", "var(--band-2)", "var(--band-3)", "var(--band-4)", "var(--band-5)"];

/** Mismos cortes que las etiquetas: ≤20, ≤40… */
export function bandColor(score: number) {
  return BANDS[Math.min(4, Math.max(0, Math.ceil(score / 20) - 1))];
}

interface Props {
  score: number | null;
  /** Para lectores de pantalla: la etiqueta visible va junto al número */
  label: string;
}

/** Barra horizontal de 1 a 100 con las cinco zonas y una marca en el score. */
export function Gauge({ score, label }: Props) {
  return (
    <div className="gauge">
      <div
        className="gauge-bar"
        role="meter"
        aria-valuemin={1}
        aria-valuemax={100}
        aria-valuenow={score === null ? undefined : Math.round(score)}
        aria-valuetext={score === null ? t.noData : `${Math.round(score)}: ${label}`}
      >
        {BANDS.map((c) => (
          <span key={c} style={{ background: c }} />
        ))}
        {score !== null && <i className="gauge-marker" style={{ left: `${Math.min(100, Math.max(0, score))}%` }} />}
      </div>
      <div className="gauge-ends" aria-hidden="true">
        <span>{t.gauge.cheap}</span>
        <span>{t.gauge.expensive}</span>
      </div>
    </div>
  );
}
