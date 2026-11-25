import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n";
import { getJson } from "../lib/data";
import { smaNullable } from "../lib/indicators";
import type { CategoryId, History } from "../types";
import { bandColor } from "./Gauge";
import { InfoTip } from "./InfoTip";
import { Rich } from "./Rich";
import { MetricHelp } from "./MetricHelp";
import { MetricSelect } from "./MetricSelect";
import { LIQUIDITY_RANGES, useRange } from "./RangeSelect";
import { ScoreChart } from "./ScoreChart";

const DAY = 86_400_000;
const CAT = "__category";
/** Clave de la categoría en `smooth` */
export const CATEGORY_KEY = CAT;
// Suavizado: media de los últimos 7 o 30 días, como en las páginas de sentimiento y técnico
const SMOOTH = ["0", "7", "30"] as const;
type Smooth = (typeof SMOOTH)[number];

/** Archivo de puntuaciones de una categoría del pipeline (CATEGORY_FILES): mismas fechas que history.json */
export interface ScoresJson {
  start: string;
  category: (number | null)[];
  metrics: Record<string, { value: (number | null)[]; score: (number | null)[] }>;
  /** Solo en liquidity_scores.json: el rendimiento del bono a 2 y a 10 años (en %), para la curva de tipos */
  yields?: { y2: (number | null)[]; y10: (number | null)[] };
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
  /** La categoría del índice: su nombre y su ayuda en la frase sobre la gráfica */
  category: CategoryId;
  /** Métricas en el orden de la tarjeta; las informativas (el índice no las usa) al final */
  metrics: readonly string[];
  info?: readonly string[];
  tx: ScoresText;
  /** Valor real de las métricas cuyo valor del pipeline no es el real (p. ej., la fase del halving, que guarda su
   * puntuación), calculado con el día */
  valueAt?: Record<string, (time: number) => number | null>;
  /** Valor real de una métrica, con su formato (`time`: el día del dato, en ms; `axis`: marca del eje, más corta) */
  format: (id: string, v: number, time: number, axis?: boolean) => string;
  /** Datos del último día que acompañan al valor de una métrica en la frase sobre el gráfico (no en la gráfica ni en la tabla) */
  detail?: (id: string, time: number, data: ScoresJson) => string | null;
  storageKey: string;
  /** Periodos del selector (por defecto, de 6 meses a todo) */
  ranges?: { id: string; days: number }[];
  /** Lo que se puede suavizar (CATEGORY_KEY para la categoría): solo lo que zigzaguea de un día a otro */
  smooth?: readonly string[];
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
export function CategoryScores({ history, file, category, metrics, info = [], tx, format, detail, storageKey, valueAt, smooth = [], ranges = LIQUIDITY_RANGES }: Props) {
  const [data, setData] = useState<ScoresJson | null>(null);
  const [error, setError] = useState(false);
  const [k, setK] = useState<string>(CAT);
  const range = useRange(storageKey, "4y", ranges);
  const keys = [CAT, ...metrics];
  const isInfo = (x: string) => info.includes(x);
  const smoothKey = `${storageKey}-smooth`;
  const [sm, setSmState] = useState<Smooth>(() => {
    try {
      const v = localStorage.getItem(smoothKey) as Smooth | null;
      return v && SMOOTH.includes(v) ? v : "0";
    } catch {
      return "0";
    }
  });
  const setSm = (v: Smooth) => {
    setSmState(v);
    try {
      localStorage.setItem(smoothKey, v);
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  };
  const smoothable = smooth.includes(k);
  const smoothN = smoothable ? Number(sm) : 0;

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
      values: Object.fromEntries(
        metrics.map((m) => {
          const real = valueAt?.[m];
          const days = history.dates.slice(0, n).map((d) => Date.parse(`${d}T00:00:00Z`));
          return [m, real ? days.map(real) : fit(data.metrics[m]?.value)];
        }),
      ),
    };
  }, [history, data, metrics, valueAt]);

  const shown = useMemo(() => {
    if (!full) return null;
    // La media antes de recortar el periodo, para que sus primeros días también la tengan
    const sc = smoothN ? smaNullable(full.scores[k], smoothN) : full.scores[k];
    const vals = k === CAT ? null : smoothN ? smaNullable(full.values[k], smoothN) : full.values[k];
    const from = Number.isFinite(range.days) ? full.time.at(-1)! - range.days * DAY : -Infinity;
    // Desde el periodo elegido y la primera puntuación de lo elegido (no todas las métricas empiezan a la vez)
    const i = Math.max(full.time.findIndex((x) => x >= from), sc.findIndex((v) => v !== null), 0);
    return { time: full.time.slice(i), price: full.price.slice(i), scores: sc.slice(i), values: vals ? vals.slice(i) : null };
  }, [full, range.days, k, smoothN]);

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

  // El último dato de lo elegido, para la frase sobre la gráfica
  const now = useMemo(() => {
    if (!full) return null;
    let i = full.scores[k].length - 1;
    while (i >= 0 && full.scores[k][i] === null) i--;
    if (i < 0) return null;
    return { score: full.scores[k][i], value: k === CAT ? null : full.values[k][i], time: full.time[i] };
  }, [full, k]);

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
              <p key={p}>
                <Rich text={p} />
              </p>
            ))}
          </InfoTip>
        </h2>
      </header>
      {/* Como en las páginas de sentimiento y técnico: la métrica y el periodo en una línea bajo el título */}
      <div className="sent-controls">
        <MetricSelect
          value={k}
          onChange={setK}
          options={keys.map((o) => ({ id: o, label: label(o), info: isInfo(o) }))}
          aria={tx.metricAria}
          infoGroup={tx.infoGroup}
        />
        {smoothable && (
          <>
            <div className="segmented small smooth-buttons" role="radiogroup" aria-label={t.technical.smoothAria}>
              {SMOOTH.map((n) => (
                <button key={n} role="radio" aria-checked={sm === n} className={sm === n ? "active" : ""} onClick={() => setSm(n)}>
                  {n === "0" ? t.technical.smoothNone : t.technical.smoothLabel(Number(n), "1d")}
                </button>
              ))}
            </div>
            {/* En pantallas estrechas, un desplegable en su lugar: cabe en la fila de la temporalidad */}
            <MetricSelect
              className="smooth-select"
              value={sm}
              onChange={(v) => setSm(v as Smooth)}
              options={SMOOTH.map((n) => ({ id: n, label: n === "0" ? t.technical.smoothNone : t.technical.smoothLabel(Number(n), "1d") }))}
              aria={t.technical.smoothAria}
            />
          </>
        )}
        {range.control}
      </div>

      {/* Como en sentimiento y técnico: lo elegido en el desplegable, con su último dato (sin suavizar) y su ayuda */}
      {now && (
        <p className="vol-stats">
          {k === CAT
            ? t.scoresNow.category(
                <>
                  {t.categories[category].name}
                  <MetricHelp id={category} kind="category" />
                </>,
                <Chip v={now.score} />,
              )
            : t.scoresNow.metric(
                <>
                  {name(k)}
                  <MetricHelp id={k} />
                </>,
                <strong className="num">
                  {now.value == null ? "—" : format(k, now.value, now.time)}
                  {now.value != null && data && detail?.(k, now.time, data) ? ` · ${detail(k, now.time, data)}` : ""}
                </strong>,
                <Chip v={now.score} />,
                isInfo(k),
              )}
        </p>
      )}
      {shown && shown.time.length > 1 ? (
        <ScoreChart
          data={shown}
          scores={shown.scores}
          tf="1d"
          label={smoothN ? t.technical.smoothed(label(k), t.technical.smoothLabel(smoothN, "1d")) : label(k)}
          // La categoría, su puntuación; las informativas (el índice no las usa), su valor; las del índice, las dos
          mode={k === CAT ? "score" : isInfo(k) ? "value" : "both"}
          values={shown.values ?? undefined}
          format={(v, i) => format(k, v, i >= 0 ? shown.time[i] : shown.time.at(-1)!, i < 0)}
          aria={tx.chartAria}
        />
      ) : (
        <p className="muted chart-placeholder" role="status">{error || (history && data && !full) ? t.charts.error : t.loading}</p>
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
