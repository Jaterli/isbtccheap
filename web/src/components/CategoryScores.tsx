import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n";
import { getJson } from "../lib/data";
import type { History } from "../types";
import { bandColor } from "./Gauge";
import { InfoTip } from "./InfoTip";
import { LIQUIDITY_RANGES, useRange } from "./RangeSelect";
import { ScoreChart } from "./ScoreChart";

const DAY = 86_400_000;
const CAT = "__category";

/** Archivo de puntuaciones de una categoría del pipeline (CATEGORY_FILES): mismas fechas que history.json */
interface ScoresJson {
  start: string;
  category: (number | null)[];
  metrics: Record<string, { value: (number | null)[]; score: (number | null)[] }>;
}

export interface ScoresText {
  card: string;
  info: string[];
  category: string;
  short: Record<string, string>;
  metricAria: string;
  infoMetric?: string;
  infoGroup?: string;
  cols: { metric: string; value: string; now: string; m1: string; m3: string };
  note: string;
  chartAria: string;
}

interface Props {
  history: History | null;
  /** p. ej. "liquidity_scores.json" */
  file: string;
  /** Métricas en el orden de la tarjeta; las informativas (el índice no las usa) al final */
  metrics: readonly string[];
  info?: readonly string[];
  tx: ScoresText;
  /** Valor real de una métrica, con su formato (`time`: el día del dato, en ms) */
  format: (id: string, v: number, time: number) => string;
  storageKey: string;
}

interface Series {
  time: number[];
  price: number[];
  scores: Record<string, (number | null)[]>;
  values: Record<string, (number | null)[]>;
}

function Chip({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="muted">—</span>;
  return (
    <span className="cat-chip num" style={{ background: bandColor(v) }}>
      {Math.round(v)}
    </span>
  );
}

/**
 * Tarjeta con el precio de BTC y, superpuesta, la puntuación de 0 a 100 de una categoría diaria del índice o de una de sus
 * métricas, como en la página de sentimiento; con la tabla de hoy, hace 1 mes y hace 3 meses. Se llega a ella desde el
 * icono de la tarjeta de la categoría (#metricas).
 */
export function CategoryScores({ history, file, metrics, info = [], tx, format, storageKey }: Props) {
  const [data, setData] = useState<ScoresJson | null>(null);
  const [error, setError] = useState(false);
  const [k, setK] = useState<string>(CAT);
  const range = useRange(storageKey, "4y", LIQUIDITY_RANGES);
  const keys = [CAT, ...metrics];
  const isInfo = (x: string) => info.includes(x);

  useEffect(() => {
    getJson(file).then(setData, () => setError(true));
  }, [file]);

  const full = useMemo((): Series | null => {
    if (!history || !data || history.dates[0] !== data.start) return null;
    const n = Math.min(history.dates.length, data.category.length);
    const fit = (a: (number | null)[] | undefined) => (a ?? []).slice(0, n).concat(Array(Math.max(0, n - (a?.length ?? 0))).fill(null));
    return {
      time: history.dates.slice(0, n).map((d) => Date.parse(`${d}T00:00:00Z`)),
      price: history.price.slice(0, n),
      scores: Object.fromEntries([[CAT, fit(data.category)], ...metrics.map((m) => [m, fit(data.metrics[m]?.score)])]),
      values: Object.fromEntries(metrics.map((m) => [m, fit(data.metrics[m]?.value)])),
    };
  }, [history, data, metrics]);

  const shown = useMemo(() => {
    if (!full) return null;
    const from = Number.isFinite(range.days) ? full.time.at(-1)! - range.days * DAY : -Infinity;
    // Desde el periodo elegido y la primera puntuación de lo elegido (no todas las métricas empiezan a la vez)
    const i = Math.max(full.time.findIndex((x) => x >= from), full.scores[k].findIndex((v) => v !== null), 0);
    return { time: full.time.slice(i), price: full.price.slice(i), scores: full.scores[k].slice(i), values: k === CAT ? null : full.values[k].slice(i) };
  }, [full, range.days, k]);

  const label = (x: string) => (x === CAT ? tx.category : tx.short[x] ?? x);
  const name = (x: string) => (x === CAT ? tx.category : t.metrics[x]?.name ?? x);
  // Hoy, hace 1 mes y hace 3 meses: son categorías diarias que cambian despacio
  const table = useMemo(() => {
    if (!full) return null;
    const last = full.time.length - 1;
    const ago = (days: number) => full.time.findIndex((x) => x >= full.time[last] - days * DAY);
    const cols = [last, ago(30), ago(91)];
    const row = (key: string) => ({ key, scores: cols.map((i) => (i >= 0 ? full.scores[key][i] : null)), value: key === CAT ? null : full.values[key][last] });
    return { indexRows: keys.filter((x) => !isInfo(x)).map(row), infoRows: keys.filter(isInfo).map(row) };
  }, [full]);

  const rowCells = (r: { key: string; scores: (number | null)[]; value: number | null }) => (
    <tr key={r.key}>
      <th scope="row">{name(r.key)}</th>
      <td className="num">{r.value === null || !full ? "—" : format(r.key, r.value, full.time.at(-1)!)}</td>
      {r.scores.map((v, i) => (
        <td key={i}>
          <Chip v={v} />
        </td>
      ))}
    </tr>
  );

  return (
    <section className="card chart vol" id="metricas">
      <header>
        <h2>
          {tx.card}
          <InfoTip label={tx.card} title={tx.card}>
            {tx.info.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </InfoTip>
        </h2>
      </header>
      {/* Como en las páginas de sentimiento y técnico: el periodo en una línea bajo el título y las métricas en otra */}
      <div className="sent-controls">{range.control}</div>
      <div className="sent-controls">
        <div className="segmented small" role="radiogroup" aria-label={tx.metricAria}>
          {keys.map((o) => (
            <button
              key={o}
              role="radio"
              aria-checked={k === o}
              className={[isInfo(o) && "info-metric", k === o && "active"].filter(Boolean).join(" ")}
              title={isInfo(o) ? tx.infoMetric : undefined}
              onClick={() => setK(o)}
            >
              {label(o)}
            </button>
          ))}
        </div>
      </div>

      {shown && shown.time.length > 1 ? (
        <ScoreChart
          data={shown}
          scores={shown.scores}
          tf="1d"
          label={label(k)}
          detail={(i) => {
            const v = shown.values?.[i];
            return v == null ? null : format(k, v, shown.time[i]);
          }}
          aria={tx.chartAria}
        />
      ) : (
        <p className="muted">{error || (history && data && !full) ? t.charts.error : t.loading}</p>
      )}

      {table && (
        <div className="outlook-table-wrap">
          <table className="outlook-table cat-table">
            <thead>
              <tr>
                <th scope="col">{tx.cols.metric}</th>
                <th scope="col">{tx.cols.value}</th>
                <th scope="col">{tx.cols.now}</th>
                <th scope="col">{tx.cols.m1}</th>
                <th scope="col">{tx.cols.m3}</th>
              </tr>
            </thead>
            <tbody>
              {table.indexRows.map(rowCells)}
              {table.infoRows.length > 0 && (
                <>
                  <tr>
                    <th scope="rowgroup" colSpan={5} className="muted small">
                      {tx.infoGroup}
                    </th>
                  </tr>
                  {table.infoRows.map(rowCells)}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small vol-note">{tx.note}</p>
    </section>
  );
}
