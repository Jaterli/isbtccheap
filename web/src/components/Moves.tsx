import { useMemo } from "react";
import { locale, t } from "../i18n";
import { computeMoves, type MoveStats } from "../lib/moves";
import type { History } from "../types";
import { InfoTip } from "./InfoTip";
import { PeriodSelector, periodStart, usePeriod } from "./PeriodSelector";

const sizeLabel = (size: number, down: boolean) => t.percent(`${down ? "−" : "+"}${Math.round(size * 100)}`);
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
// A partir de aquí se resalta: más tiempo sin producirse que en el 90 % de los días del periodo
const OVER_PERCENTILE = 90;
const over = (m: MoveStats) => m.percentile !== null && m.percentile >= OVER_PERCENTILE;

/** Une ["−10 %", "−15 %", "−20 %"] en "−10 %, −15 % y −20 %" (o "and" en inglés) */
const list = (items: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(items);

function TrendIcon({ down }: { down: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {down ? <path d="M1.5 4l4.5 4.5 3-3 5.5 5.5M10 11h4.5V6.5" /> : <path d="M1.5 12l4.5-4.5 3 3 5.5-5.5M10 5h4.5v4.5" />}
    </svg>
  );
}

/** Celda de un tamaño: días desde la última vez, lo habitual y la barra del percentil */
function MoveCell({ m }: { m: MoveStats }) {
  const tx = t.moves;
  const title = [m.last && fmtDate(m.last), m.percentile !== null && tx.percentile(Math.round(m.percentile)), tx.count(m.count)]
    .filter(Boolean)
    .join(" · ");
  return (
    <td className={over(m) ? "mv over" : "mv"} title={title}>
      {/* En pantallas anchas, en una línea: hace · barra · habitual; en estrechas, la barra debajo */}
      <div className="mv-in">
        <strong>{m.daysSince === null ? tx.none : tx.days(m.daysSince)}</strong>
        {m.percentile !== null && (
          // La barra es el percentil; la marca central, lo habitual (percentil 50)
          <div className="moves-bar" aria-hidden="true">
            <span style={{ width: `${m.percentile}%` }} />
            <i />
          </div>
        )}
        <span>{m.typical === null ? "—" : tx.days(m.typical)}</span>
      </div>
    </td>
  );
}

/** Caídas y subidas en la misma tabla, una fila por tamaño: la mitad de alto que dos tablas apiladas */
function MoveTable({ drops, rallies }: { drops: MoveStats[]; rallies: MoveStats[] }) {
  const tx = t.moves;
  const head = (down: boolean) => (
    <th scope="col">
      <span className={`mv-head ${down ? "down" : "up"}`}>
        <TrendIcon down={down} />
        {down ? tx.drops : tx.rallies}
      </span>
      <span className="mv-sub">
        <span>{tx.cols.since}</span>
        <span>{tx.cols.typical}</span>
      </span>
    </th>
  );
  return (
    <table className="moves-table num">
      <thead>
        <tr>
          <th scope="col">{tx.cols.size}</th>
          {head(true)}
          {head(false)}
        </tr>
      </thead>
      <tbody>
        {drops.map((d, i) => (
          <tr key={d.size}>
            <th scope="row">{t.percent(String(Math.round(d.size * 100)))}</th>
            <MoveCell m={d} />
            <MoveCell m={rallies[i]} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Días que lleva BTC sin una caída (desde máximo) o subida (desde mínimo) de cada tamaño, frente a la media. */
export function Moves({ history }: { history: History }) {
  const { period, days, select } = usePeriod("isbtccheap:moves-period");
  const m = useMemo(() => computeMoves(history, periodStart(history.price.length, days)), [history, days]);
  if (!m) return null;
  const tx = t.moves;

  const overDrops = m.drops.filter(over).map((x) => sizeLabel(x.size, true));
  const overRallies = m.rallies.filter(over).map((x) => sizeLabel(x.size, false));

  return (
    <section className="card moves">
      <header>
        <h3>
          {tx.title}
          <InfoTip label={tx.title} title={tx.title}>
            {tx.info.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="muted">{tx.infoNote}</p>
          </InfoTip>
        </h3>
        <PeriodSelector value={period} onChange={select} />
      </header>

      <p className="moves-lead">
        {overDrops.length === 0 && overRallies.length === 0
          ? tx.allNormal
          : [overDrops.length > 0 && tx.overDrops(list(overDrops)), overRallies.length > 0 && tx.overRallies(list(overRallies))]
              .filter(Boolean)
              .join(" ")}
      </p>

      <MoveTable drops={m.drops} rallies={m.rallies} />

      <p className="muted small moves-note">{tx.note}</p>
    </section>
  );
}
