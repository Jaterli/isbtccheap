import { useMemo, useState } from "react";
import { labelAt, locale, t } from "../i18n";
import { computeOutlook, type Band } from "../lib/outlook";
import type { History, Latest } from "../types";
import { bandColor } from "./Gauge";
import { InfoTip } from "./InfoTip";

// Los nombres están en i18n (t.outlook.periods)
const PERIODS = [
  { id: "4y", days: 1461 },
  { id: "8y", days: 2922 },
  { id: "all", days: Infinity },
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
  const s = Math.abs(v).toLocaleString(locale, { maximumFractionDigits: Math.abs(v) >= 10 ? 0 : 1 });
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${t.percent(s)}`;
}

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

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
  const one = (n: number) => Math.round(n).toLocaleString(locale);
  const name = (b: Band) => labelAt(b.index, b.label);
  const tx = t.outlook;

  return (
    <section className="card outlook">
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
        <div className="segmented small" role="group" aria-label={tx.periodAria}>
          {PERIODS.map((p) => (
            <button key={p.id} className={period === p.id ? "active" : ""} onClick={() => selectPeriod(p.id)}>
              {tx.periods[p.id]}
            </button>
          ))}
        </div>
      </header>

      <div className="outlook-lead">
        <p>
          {tx.today(
            <strong className="num" style={{ color: bandColor(o.score) }}>{one(o.score)}</strong>,
            name(o.band),
            zone(o.band),
            o.recentDays,
            <strong className="num">{t.percent(String(Math.round(o.recentShare * 100)))}</strong>,
          )}
        </p>
        <p>
          {tx.smooth(
            sm.days,
            <strong className="num" style={{ color: bandColor(sm.value) }}>{one(sm.value)}</strong>,
            name(sm.band),
            <strong className="num">{sm.streakDays}</strong>,
            sm.streakDays,
            zone(sm.band),
            fmtDate(sm.since),
          )}
          {sm.pastDurations.length > 0 && tx.past(sm.pastDurations.length, longer, one(median(sm.pastDurations)))}
        </p>
      </div>

      <p className="outlook-sample muted">
        {tx.sample(one(o.similar.lo), one(o.similar.hi))}
      </p>

      <div className="outlook-table-wrap">
        <table className="outlook-table num">
          <thead>
            <tr>
              <th scope="col">{tx.cols.horizon}</th>
              <th scope="col">{tx.cols.median}</th>
              <th scope="col">{tx.cols.rose}</th>
              <th scope="col">{tx.cols.range}</th>
              <th scope="col">{tx.cols.sample}</th>
            </tr>
          </thead>
          <tbody>
            {o.forward.map((f) => (
              <tr key={f.days}>
                <th scope="row">{tx.horizons[f.days]}</th>
                {f.median === null ? (
                  <td colSpan={4} className="muted">{tx.notEnough}</td>
                ) : (
                  <>
                    <td className={f.median >= 0 ? "up" : "down"}>{pct(f.median)}</td>
                    <td>{t.percent(String(Math.round(f.positive! * 100)))}</td>
                    <td>{pct(f.min!)} / {pct(f.max!)}</td>
                    <td title={tx.days(f.n)}>{tx.episodes(f.episodes)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {o.vol && (
        <p className="outlook-vol">
          {tx.vol(
            <strong className="num">{t.percent(String(Math.round(o.vol.current * 100)))}</strong>,
            <strong className="num">{Math.round(o.vol.percentile)}</strong>,
          )}
          {o.vol.percentile <= 20 && tx.volLow}
          {o.vol.percentile >= 80 && tx.volHigh}
        </p>
      )}
      <p className="muted small outlook-note">{tx.note}</p>
    </section>
  );
}
