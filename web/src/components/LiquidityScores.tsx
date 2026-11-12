import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n";
import { getJson } from "../lib/data";
import type { History } from "../types";
import { bandColor } from "./Gauge";
import { InfoTip } from "./InfoTip";
import { rocPct } from "./LiquidityChart";
import { LIQUIDITY_RANGES, useRange } from "./RangeSelect";
import { ScoreChart } from "./ScoreChart";

/** Métricas de la categoría de liquidez del índice, en el orden de su tarjeta, y al final las informativas */
const METRICS = ["global_liquidity_roc", "dxy_roc", "m2_yoy", "stablecoin_roc"] as const;
// Se puntúan igual, pero el índice no las usa: no anticipaban de forma fiable (ver pipeline/config.py)
const INFO: readonly Metric[] = ["m2_yoy", "stablecoin_roc"];
type Metric = (typeof METRICS)[number];
type Key = "liquidez" | Metric;
const KEYS: Key[] = ["liquidez", ...METRICS];
const isInfo = (k: Key) => (INFO as readonly string[]).includes(k);
const DAY = 86_400_000;

/** liquidity_scores.json del pipeline: mismas fechas que history.json */
interface LiquidityScoresJson {
  start: string;
  category: (number | null)[];
  metrics: Partial<Record<Metric, { value: (number | null)[]; score: (number | null)[] }>>;
}

interface Series {
  time: number[];
  price: number[];
  scores: Record<Key, (number | null)[]>;
  values: Record<Metric, (number | null)[]>;
}

function build(h: History, s: LiquidityScoresJson): Series | null {
  if (h.dates[0] !== s.start) return null;
  const n = Math.min(h.dates.length, s.category.length);
  const cut = (a: (number | null)[] | undefined) => (a ?? []).slice(0, n).concat(Array(Math.max(0, n - (a?.length ?? 0))).fill(null));
  return {
    time: h.dates.slice(0, n).map((d) => Date.parse(`${d}T00:00:00Z`)),
    price: h.price.slice(0, n),
    scores: { liquidez: cut(s.category), ...(Object.fromEntries(METRICS.map((m) => [m, cut(s.metrics[m]?.score)])) as Record<Metric, (number | null)[]>) },
    values: Object.fromEntries(METRICS.map((m) => [m, cut(s.metrics[m]?.value)])) as Record<Metric, (number | null)[]>,
  };
}

function slice(s: Series, i: number): Series {
  const cut = <K extends string>(r: Record<K, (number | null)[]>) => Object.fromEntries(Object.entries<(number | null)[]>(r).map(([k, v]) => [k, v.slice(i)])) as Record<K, (number | null)[]>;
  return { time: s.time.slice(i), price: s.price.slice(i), scores: cut(s.scores), values: cut(s.values) };
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
 * Tarjeta de la página de liquidez: el precio de BTC con la puntuación de 0 a 100 de la categoría o de una de sus métricas
 * superpuesta, como en la página de sentimiento. Se llega a ella desde el icono de la tarjeta de Liquidez (#metricas).
 */
export function LiquidityScores({ history }: { history: History | null }) {
  const [data, setData] = useState<LiquidityScoresJson | null>(null);
  const [error, setError] = useState(false);
  const [k, setK] = useState<Key>("liquidez");
  const range = useRange("isbtccheap:liquidity-scores-range", "4y", LIQUIDITY_RANGES);

  useEffect(() => {
    getJson("liquidity_scores.json").then(setData, () => setError(true));
  }, []);

  const full = useMemo(() => (history && data ? build(history, data) : null), [history, data]);
  const shown = useMemo(() => {
    if (!full) return null;
    const from = Number.isFinite(range.days) ? full.time.at(-1)! - range.days * DAY : -Infinity;
    // Desde el periodo elegido y la primera puntuación de lo elegido (las stablecoins empiezan en 2019)
    const i = Math.max(full.time.findIndex((x) => x >= from), full.scores[k].findIndex((v) => v !== null), 0);
    return slice(full, i);
  }, [full, range.days, k]);

  const tx = t.liquidity.scores;
  const label = (x: Key) => (x === "liquidez" ? tx.category : t.metrics[x]?.name ?? x);
  // Hoy, hace 1 mes y hace 3 meses: la liquidez cambia despacio
  const table = useMemo(() => {
    if (!full) return null;
    const last = full.time.length - 1;
    const ago = (days: number) => full.time.findIndex((x) => x >= full.time[last] - days * DAY);
    const cols = [last, ago(30), ago(91)];
    const row = (key: Key) => ({ key, scores: cols.map((i) => (i >= 0 ? full.scores[key][i] : null)), value: key === "liquidez" ? null : full.values[key][last] });
    return { indexRows: KEYS.filter((x) => !isInfo(x)).map(row), infoRows: KEYS.filter(isInfo).map(row) };
  }, [full]);

  const rowCells = (r: { key: Key; scores: (number | null)[]; value: number | null }) => (
    <tr key={r.key}>
      <th scope="row">{label(r.key)}</th>
      <td className="num">{r.value === null ? "—" : rocPct(r.value, 1)}</td>
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
          {KEYS.map((o) => (
            <button
              key={o}
              role="radio"
              aria-checked={k === o}
              className={[isInfo(o) && "info-metric", k === o && "active"].filter(Boolean).join(" ")}
              title={isInfo(o) ? tx.infoMetric : undefined}
              onClick={() => setK(o)}
            >
              {o === "liquidez" ? tx.category : tx.short[o]}
            </button>
          ))}
        </div>
      </div>

      {shown && shown.time.length > 1 ? (
        <ScoreChart
          data={shown}
          scores={shown.scores[k]}
          tf="1d"
          label={k === "liquidez" ? tx.category : tx.short[k]}
          detail={(i) => {
            if (k === "liquidez") return null;
            const v = shown.values[k][i];
            return v === null ? null : rocPct(v, 1);
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
              <tr>
                <th scope="rowgroup" colSpan={5} className="muted small">
                  {tx.infoGroup}
                </th>
              </tr>
              {table.infoRows.map(rowCells)}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small vol-note">{tx.note}</p>
    </section>
  );
}
