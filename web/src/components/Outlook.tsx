import { useMemo, useState } from "react";
import { computeOutlook, type Band } from "../lib/outlook";
import type { History, Latest } from "../types";
import { bandColor } from "./Gauge";
import { InfoTip } from "./InfoTip";

const PERIODS = [
  { id: "4y", label: "Últimos 4 años", days: 1461 },
  { id: "8y", label: "Últimos 8 años", days: 2922 },
  { id: "all", label: "Desde 2011", days: Infinity },
];
const DEFAULT_PERIOD = "8y";
const PERIOD_KEY = "isbtccheap:outlook-period";

function loadPeriod() {
  try {
    return localStorage.getItem(PERIOD_KEY) ?? DEFAULT_PERIOD;
  } catch {
    return DEFAULT_PERIOD;
  }
}

function pct(r: number) {
  const v = r * 100;
  const s = Math.abs(v).toLocaleString("es-ES", { maximumFractionDigits: Math.abs(v) >= 10 ? 0 : 1 });
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s} %`;
}

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

interface Props {
  history: History;
  labels: Latest["labels"];
}

/** Qué hizo el precio después de los días en que el score diario estaba en la misma zona que hoy. */
export function Outlook({ history, labels }: Props) {
  const [period, setPeriod] = useState(loadPeriod);
  const days = (PERIODS.find((p) => p.id === period) ?? PERIODS.find((p) => p.id === DEFAULT_PERIOD)!).days;
  const o = useMemo(
    () => computeOutlook(history, labels, Math.max(0, history.score.length - days)),
    [history, labels, days],
  );
  if (!o) return null;

  const selectPeriod = (id: string) => {
    setPeriod(id);
    try {
      localStorage.setItem(PERIOD_KEY, id);
    } catch {
      /* almacenamiento no disponible: no pasa nada */
    }
  };

  const zone = (b: Band) => `${b.lo === 0 ? 1 : b.lo + 1}–${b.hi}`;
  const sm = o.smooth;
  const longer = sm.pastDurations.filter((d) => d > sm.streakDays).length;
  const one = (n: number) => Math.round(n).toLocaleString("es-ES");

  return (
    <section className="card outlook">
      <header>
        <h3>
          Qué hizo el precio después
          <InfoTip label="qué hizo el precio después" title="Qué hizo el precio después">
            <p>La tabla toma los días del histórico con un score diario parecido al de hoy (±7,5 puntos) y mide cuánto había cambiado el precio al cabo de cada plazo.</p>
            <p>Los días cercanos se parecen mucho entre sí, así que se agrupan en episodios: días de la muestra separados por menos de un mes son el mismo episodio. El tamaño real de la muestra es el número de episodios, no el de días.</p>
            <p>El tiempo en una zona se mide con la media de 30 días del score, porque el valor diario es demasiado ruidoso: en pocas semanas puede cruzar varias zonas.</p>
            <p>"Últimos 4 años" (un ciclo) es lo más parecido al mercado actual, pero tiene pocos episodios; "Últimos 8 años" (unos dos ciclos) equilibra parecido y tamaño de la muestra; "Desde 2011" tiene más episodios, pero incluye las subidas extremas de los primeros años.</p>
            <p className="muted">El score histórico usa una regresión power law ajustada con todos los datos, así que los resultados pasados salen algo mejores de lo que habría marcado en su momento. Describe el pasado, no predice el futuro.</p>
          </InfoTip>
        </h3>
        <div className="segmented small" role="group" aria-label="Periodo de la muestra">
          {PERIODS.map((p) => (
            <button key={p.id} className={period === p.id ? "active" : ""} onClick={() => selectPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="outlook-lead">
        <p>
          El score diario está en{" "}
          <strong className="num" style={{ color: bandColor(o.score) }}>{one(o.score)}</strong> ({o.band.label}, zona {zone(o.band)}).
          En los últimos {o.recentDays} días ha estado en esa zona el <strong className="num">{Math.round(o.recentShare * 100)} %</strong> del tiempo.
        </p>
        <p>
          Su media de {sm.days} días está en{" "}
          <strong className="num" style={{ color: bandColor(sm.value) }}>{one(sm.value)}</strong> ({sm.band.label}) y lleva{" "}
          <strong className="num">{sm.streakDays}</strong> {sm.streakDays === 1 ? "día seguido" : "días seguidos"} en la zona {zone(sm.band)}, desde el {fmtDate(sm.since)}.
          {sm.pastDurations.length > 0 && (
            <>
              {" "}De {sm.pastDurations.length} {sm.pastDurations.length === 1 ? "racha anterior" : "rachas anteriores"} en esa zona,{" "}
              {longer === 0 ? "ninguna duró más" : `${longer} ${longer === 1 ? "duró" : "duraron"} más`} (mediana {one(median(sm.pastDurations))} días).
            </>
          )}
        </p>
      </div>

      <p className="outlook-sample muted">
        Días con un score diario entre {one(o.similar.lo)} y {one(o.similar.hi)}: qué hizo el precio después.
      </p>

      <div className="outlook-table-wrap">
        <table className="outlook-table num">
          <thead>
            <tr>
              <th scope="col">Plazo</th>
              <th scope="col">Mediana</th>
              <th scope="col">Subió</th>
              <th scope="col">Peor / mejor</th>
              <th scope="col">Muestra</th>
            </tr>
          </thead>
          <tbody>
            {o.forward.map((f) => (
              <tr key={f.days}>
                <th scope="row">{f.label}</th>
                {f.median === null ? (
                  <td colSpan={4} className="muted">Sin datos suficientes</td>
                ) : (
                  <>
                    <td className={f.median >= 0 ? "up" : "down"}>{pct(f.median)}</td>
                    <td>{Math.round(f.positive! * 100)} %</td>
                    <td>{pct(f.min!)} / {pct(f.max!)}</td>
                    <td title={`${f.n} días`}>
                      {f.episodes} {f.episodes === 1 ? "episodio" : "episodios"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {o.vol && (
        <p className="outlook-vol">
          Volatilidad de los últimos 30 días: <strong className="num">{Math.round(o.vol.current * 100)} %</strong> anualizada,
          percentil <strong className="num">{Math.round(o.vol.percentile)}</strong> de los últimos 4 años.
          {o.vol.percentile <= 20 && " Una volatilidad tan baja suele anticipar un movimiento fuerte, pero no indica en qué dirección."}
          {o.vol.percentile >= 80 && " Una volatilidad tan alta suele darse en caídas bruscas o subidas verticales."}
        </p>
      )}
      <p className="muted small outlook-note">Datos históricos, no una predicción ni una recomendación de inversión.</p>
    </section>
  );
}
