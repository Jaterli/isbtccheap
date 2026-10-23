import type { ReactNode } from "react";
import { t } from "../i18n";

const BANDS =["var(--band-1)", "var(--band-2)", "var(--band-3)", "var(--band-4)", "var(--band-5)"];
const CX = 120;
const CY = 120;
const R = 100;

// 0 -> izquierda (barato), 100 -> derecha (caro)
function point(score: number, r = R) {
  const a = Math.PI * (1 - score / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}

/** Color del tramo del medidor en el que cae el score (mismos cortes que las etiquetas: ≤20, ≤40…) */
export function bandColor(score: number) {
  return BANDS[Math.min(4, Math.max(0, Math.ceil(score / 20) - 1))];
}

function arc(from: number, to: number) {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
}

interface Props {
  score: number | null;
  label: string;
  /** Icono de información junto a la etiqueta */
  info?: ReactNode;
}

export function Gauge({ score, label, info }: Props) {
  const [nx, ny] = point(score ?? 50, R - 28);
  return (
    <figure className="gauge" aria-label={score === null ? t.noData : `Score ${Math.round(score)}: ${label}`}>
      <svg viewBox="0 0 240 140" role="img">
        {BANDS.map((c, i) => (
          <path key={i} d={arc(i * 20 + 0.8, (i + 1) * 20 - 0.8)} stroke={c} strokeWidth="18" fill="none" />
        ))}
        {score !== null && (
          <>
            <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="var(--fg)" strokeWidth="3" strokeLinecap="round" />
            <circle cx={CX} cy={CY} r="6" fill="var(--fg)" />
          </>
        )}
        <text x="14" y="138" className="gauge-end">{t.gauge.cheap}</text>
        <text x="226" y="138" className="gauge-end" textAnchor="end">{t.gauge.expensive}</text>
      </svg>
      <figcaption>
        <span className="gauge-value" style={score === null ? undefined : { color: bandColor(score) }}>
          {score === null ? "—" : Math.round(score)}
        </span>
        <span className="gauge-label">
          {label}
          {info}
        </span>
      </figcaption>
    </figure>
  );
}
