import { useEffect, useMemo, useState } from "react";
import { CapitulationCard } from "./components/CapitulationCard";
import { LiquidationsCard } from "./components/LiquidationsCard";
import { bandColor } from "./components/Gauge";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { InfoTip } from "./components/InfoTip";
import { Rich } from "./components/Rich";
import { MetricHelp } from "./components/MetricHelp";
import { MetricSelect } from "./components/MetricSelect";
import { SENTIMENT_RANGES, useRange } from "./components/RangeSelect";
import { ScoreChart } from "./components/ScoreChart";
import { lang, locale, t } from "./i18n";
import { SEO_SENTIMENT } from "./i18n/seo";
import { compactNum } from "./lib/chart";
import { getJson } from "./lib/data";
import { smaNullable } from "./lib/indicators";
import {
  INFO_METRICS,
  TF_METRICS,
  fromFirstScore,
  indexAgo,
  lastCandles,
  lastDaysOf,
  loadSentiment,
  type SentimentJson,
  type SentimentKey,
  type SentimentMetric,
  type SentimentSeries,
  type SentimentTf,
} from "./lib/sentiment";
import type { History } from "./types";

const HOUR = 3_600_000;

// Valor real de cada métrica, con su formato
const pct = (v: number, d = 2) => `${v.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const FORMAT: Record<SentimentMetric, (v: number) => string> = {
  fear_greed: (v) => Math.round(v).toLocaleString(locale),
  sth_sopr: (v) => v.toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
  etf_flows: (v) => t.sentiment.btc(`${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v)).toLocaleString(locale)}`),
  open_interest: (v) => t.sentiment.btc(Math.round(v).toLocaleString(locale)),
  long_pct: (v) => pct(v),
  taker_pct: (v) => pct(v),
  spot_buy_pct: (v) => pct(v),
  sth_loss_pct: (v) => pct(v),
  realized_loss_ratio: (v) => `×${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  sth_mvrv_adj: (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`,
};

// En las marcas del eje, más cortas: miles abreviados y porcentajes sin decimales (la lectura lleva la cifra completa)
const AXIS_FORMAT: Partial<Record<SentimentMetric, (v: number) => string>> = {
  etf_flows: (v) => t.sentiment.btc(compactNum(v, true)),
  open_interest: (v) => t.sentiment.btc(compactNum(v)),
  long_pct: (v) => pct(v, 0),
  taker_pct: (v) => pct(v, 0),
  spot_buy_pct: (v) => pct(v, 0),
  sth_loss_pct: (v) => pct(v, 0),
};

// Métricas que cambian mucho de una vela a otra: con menos velas se ven más estiradas (en 1D, las de periodo a elegir,
// las que este diga)
const MAX_CANDLES: Partial<Record<SentimentKey, Partial<Record<SentimentTf, number>>>> = {
  taker_pct: { "1h": 120, "4h": 60 },
  spot_buy_pct: { "1h": 120, "4h": 60, "1d": 90 },
};
// En 1D, sin periodo a elegir: las compras al contado (sus últimos 90 días). Los derivados sí lo tienen desde que llegan
// con el histórico de Coinalyze (desde 2020)
const NO_RANGE: SentimentKey[] = ["spot_buy_pct"];

// Suavizado: media de las últimas N velas (en 1D, 7 y 30 días; en 1 h y 4 h, las mismas velas), como en la página técnica.
// Solo donde cambia algo: en 1 h y 4 h las métricas diarias repiten el dato del día en todas sus velas, así que allí solo
// se suavizan las que cambian de vela a vela. Fuera quedan los ETF (ya son la suma de 20 sesiones) y el interés abierto
// (es un nivel, no oscila)
const SMOOTH = ["0", "7", "30"] as const;
type Smooth = (typeof SMOOTH)[number];
const SMOOTHABLE: Record<SentimentTf, SentimentKey[]> = {
  "1h": ["long_pct", "taker_pct", "spot_buy_pct"],
  "4h": ["long_pct", "taker_pct", "spot_buy_pct"],
  "1d": ["sentimiento", "fear_greed", "sth_sopr", "long_pct", "taker_pct", "spot_buy_pct", "sth_loss_pct", "realized_loss_ratio", "sth_mvrv_adj"],
};

/** La elección guardada en el navegador (si se puede) */
function useStored<T extends string>(key: string, fallback: T, valid: readonly T[]) {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key) as T | null;
      return s && valid.includes(s) ? s : fallback;
    } catch {
      return fallback;
    }
  });
  const set = (x: T) => {
    setV(x);
    try {
      localStorage.setItem(key, x);
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  };
  return [v, set] as const;
}

function Chip({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="muted">—</span>;
  return (
    <span className="cat-chip num" style={{ background: bandColor(v) }}>
      {Math.round(v)}
    </span>
  );
}

// Descripción de cada métrica (t.metrics): los derivados se llaman distinto en la tarjeta del índice
const HELP_ID: Partial<Record<SentimentKey, string>> = { long_pct: "long_short", taker_pct: "taker_ratio" };

// Temporalidades del gráfico: sin 1 h (el sentimiento es diario: en 1 h solo repetía el dato del día en más velas)
const SHOWN_TFS: readonly SentimentTf[] = ["4h", "1d"];

const KEYS: SentimentKey[] = ["sentimiento", "fear_greed", "sth_sopr", "etf_flows", "open_interest", "long_pct", "taker_pct", "spot_buy_pct", "sth_loss_pct", "realized_loss_ratio", "sth_mvrv_adj"];
const isInfo = (k: SentimentKey) => (INFO_METRICS as readonly string[]).includes(k);

export function SentimentApp() {
  const [history, setHistory] = useState<History | null>(null);
  const [sent, setSent] = useState<SentimentJson | null>(null);
  // La última serie cargada, con su temporalidad: al cambiar de temporalidad se sigue viendo hasta que llega la nueva
  const [loaded, setLoaded] = useState<{ tf: SentimentTf; s: SentimentSeries } | null>(null);
  // La tabla, siempre en 4 h: el sentimiento pesa más en las temporalidades cortas
  const [hourly, setHourly] = useState<SentimentSeries | null>(null);
  const [error, setError] = useState(false);
  const [tf, setTf] = useStored<SentimentTf>("isbtccheap:sentiment-tf", "4h", SHOWN_TFS);
  const [stored, setKey] = useStored<SentimentKey>("isbtccheap:sentiment-key", "sentimiento", KEYS);
  const range = useRange("isbtccheap:sentiment-range", "1y", SENTIMENT_RANGES);
  const [smooth, setSmooth] = useStored<Smooth>("isbtccheap:sentiment-smooth", "0", SMOOTH);

  // Lo que se puede elegir en esta temporalidad: la categoría y las métricas que usa en ella el índice
  // y, al final, las informativas (el índice no las usa)
  const optionsFor = (x: SentimentTf): SentimentKey[] => ["sentimiento", ...TF_METRICS[x], ...INFO_METRICS];
  const keyFor = (x: SentimentTf): SentimentKey => (optionsFor(x).includes(stored) ? stored : "sentimiento");
  const options = optionsFor(tf);
  const k = keyFor(tf);
  const series = loaded?.s ?? null;
  // Lo que se dibuja: la serie cargada, con su temporalidad y su elección, aunque ya se haya pedido otra
  const shownTf = loaded?.tf ?? tf;
  const shownK = keyFor(shownTf);
  const updating = loaded !== null && loaded.tf !== tf;
  const smoothable = SMOOTHABLE[tf].includes(k);
  const smoothN = SMOOTHABLE[shownTf].includes(shownK) ? Number(smooth) : 0;

  useEffect(() => {
    getJson("history.json").then(setHistory, () => setError(true));
    getJson("sentiment.json").then(setSent, () => setError(true));
  }, []);

  useEffect(() => {
    if (!history || !sent) return;
    let alive = true;
    loadSentiment(tf, history, sent).then(
      (s) => {
        if (!alive) return;
        setLoaded({ tf, s });
        if (tf === "4h") setHourly(s);
      },
      () => alive && setError(true),
    );
    return () => {
      alive = false;
    };
  }, [tf, history, sent]);

  // La tabla necesita la serie de 4 h aunque se esté viendo otra temporalidad
  useEffect(() => {
    if (!history || !sent || hourly || tf === "4h") return;
    loadSentiment("4h", history, sent).then(setHourly, () => {});
  }, [history, sent, hourly, tf]);

  // En 1D, el periodo elegido; desde la primera puntuación de lo elegido
  const shown = useMemo(() => {
    if (!series) return null;
    // Antes de recortar, para que la media tenga sus velas anteriores: la media del valor y la de la puntuación
    const src = !smoothN
      ? series
      : {
          ...series,
          values: { ...series.values, ...(shownK === "sentimiento" ? {} : { [shownK]: smaNullable(series.values[shownK], smoothN) }) },
          scores: { ...series.scores, [shownK]: smaNullable(series.scores[shownK], smoothN) },
        };
    const ranged = shownTf === "1d" && !NO_RANGE.includes(shownK) ? lastDaysOf(src, range.days) : src;
    const max = MAX_CANDLES[shownK]?.[shownTf];
    const cut = fromFirstScore(max ? lastCandles(ranged, max) : ranged, shownK);
    return cut.scores[shownK].some((v) => v !== null) ? cut : null;
  }, [series, shownTf, shownK, range.days, smoothN]);

  const table = useMemo(() => {
    if (!hourly || !hourly.time.length) return null;
    const cols = [0, 4, 24].map((hours) => indexAgo(hourly, hours * HOUR));
    const row = (key: SentimentKey) => ({ key, scores: cols.map((i) => (i >= 0 ? hourly.scores[key][i] : null)) });
    return { now: hourly.time.at(-1)!, indexRows: ["sentimiento" as const, ...TF_METRICS["4h"]].map(row), infoRows: INFO_METRICS.map(row) };
  }, [hourly]);

  const tx = t.sentiment;
  const seo = SEO_SENTIMENT[lang];
  const label = (key: SentimentKey) => tx.short[key];
  // El de la serie sin suavizar: el suavizado solo cambia la gráfica
  const lastScore = series ? [...series.scores.sentimiento].reverse().find((v) => v !== null) : undefined;
  // La métrica elegida: su último valor y su puntuación, sin suavizar (como la tabla)
  const lastOf = (xs: (number | null)[] | undefined) => (xs ? [...xs].reverse().find((v) => v !== null) : undefined);
  const metricNow =
    series && shownK !== "sentimiento"
      ? { value: lastOf(series.values[shownK]), score: lastOf(series.scores[shownK]) }
      : null;
  // En 1 h y 4 h, las métricas diarias (del pipeline y de Bitview) repiten el dato del día
  const dailyMetric = shownTf !== "1d" && !(["open_interest", "long_pct", "taker_pct", "spot_buy_pct"] as SentimentKey[]).includes(shownK);

  return (
    <main className="container">
      <Header title={tx.title} rest={tx.rest} />

      <section className="card chart vol">
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

        {/* Una línea: la métrica, la temporalidad y, en 1D, el periodo (en pantallas estrechas los botones bajan a otra) */}
        <div className="sent-controls">
          <MetricSelect
            value={k}
            onChange={(o) => setKey(o as SentimentKey)}
            options={options.map((o) => ({ id: o, label: label(o), info: isInfo(o) }))}
            aria={tx.metricAria}
            infoGroup={tx.infoGroup}
          />
          <div className="segmented small sent-tfs" role="radiogroup" aria-label={tx.tfAria}>
            {SHOWN_TFS.map((x) => (
              <button
                key={x}
                role="radio"
                aria-checked={tf === x}
                className={[x === "1d" && "daily", tf === x && "active"].filter(Boolean).join(" ")}
                onClick={() => setTf(x)}
              >
                {t.timeframes[x].short}
              </button>
            ))}
          </div>
          {/* Los periodos son de velas diarias: con el color del botón 1D */}
          {smoothable && (
            <>
              <div className="segmented small smooth-buttons" role="radiogroup" aria-label={t.technical.smoothAria}>
                {SMOOTH.map((n) => (
                  <button key={n} role="radio" aria-checked={smooth === n} className={smooth === n ? "active" : ""} onClick={() => setSmooth(n)}>
                    {n === "0" ? t.technical.smoothNone : t.technical.smoothLabel(Number(n), tf)}
                  </button>
                ))}
              </div>
              {/* En pantallas estrechas, un desplegable en su lugar: cabe en la fila de la temporalidad */}
              <MetricSelect
                className="smooth-select"
                value={smooth}
                onChange={(v) => setSmooth(v as Smooth)}
                options={SMOOTH.map((n) => ({ id: n, label: n === "0" ? t.technical.smoothNone : t.technical.smoothLabel(Number(n), tf) }))}
                aria={t.technical.smoothAria}
              />
            </>
          )}
          {tf === "1d" && !NO_RANGE.includes(k) && <div className="sent-daily">{range.control}</div>}
        </div>

        {series && (
          <p className="vol-stats">
            {metricNow && shownK !== "sentimiento"
              ? tx.currentMetric(
                  t.timeframes[shownTf].label,
                  <>
                    {tx.names[shownK]}
                    <MetricHelp id={HELP_ID[shownK] ?? shownK} />
                  </>,
                  <strong className="num">{metricNow.value == null ? "—" : FORMAT[shownK](metricNow.value)}</strong>,
                  <Chip v={metricNow.score} />,
                  dailyMetric,
                  isInfo(shownK),
                )
              : tx.current(
                  t.timeframes[shownTf].label,
                  <Chip v={lastScore} />,
                  TF_METRICS[shownTf].map((m) => tx.short[m]).join(", "),
                  <MetricHelp id="sentimiento" kind="category" />,
                )}
          </p>
        )}
        {shown && shown.time.length > 1 ? (
          <div className={updating ? "chart-wrap updating" : "chart-wrap"} aria-busy={updating}>
            <ScoreChart
              data={shown}
              scores={shown.scores[shownK]}
              tf={shownTf}
              aria={tx.chartAria}
              label={smoothN ? t.technical.smoothed(label(shownK), t.technical.smoothLabel(smoothN, shownTf)) : label(shownK)}
              // La categoría, su puntuación; las informativas (el índice no las usa), su valor; las del índice, las dos
              mode={shownK === "sentimiento" ? "score" : isInfo(shownK) ? "value" : "both"}
              values={shownK === "sentimiento" ? undefined : shown.values[shownK]}
              format={(v, i) => {
                if (shownK === "sentimiento") return "";
                // i = -1: marca del eje
                if (i < 0 && AXIS_FORMAT[shownK]) return AXIS_FORMAT[shownK]!(v);
                const sc = i >= 0 ? shown.scores[shownK][i] : null;
                // Puntuación 50 + 25·σ (recortada en ±2σ): a cuántas desviaciones está de su media del último año
                const sigma = shownK === "sth_mvrv_adj" && sc !== null ? ` · ${tx.sigma((sc - 50) / 25)}` : "";
                return FORMAT[shownK](v) + sigma;
              }}
            />
            {updating && (
              <div className="chart-updating" role="status">
                <span className="chart-spinner" aria-hidden="true" />
                {t.refresh.updating}
              </div>
            )}
          </div>
        ) : (
          <p className="muted chart-placeholder" role="status">{error ? t.charts.error : series && !updating ? tx.noData : t.loading}</p>
        )}

        {table && (
          <>
            <h3 className="dd-table-title">{tx.tableTitle}</h3>
            <div className="outlook-table-wrap">
              <table className="outlook-table cat-table">
                <thead>
                  <tr>
                    <th scope="col">{tx.cols.metric}</th>
                    <th scope="col">{tx.cols.now}</th>
                    <th scope="col">{tx.cols.h4}</th>
                    <th scope="col">{tx.cols.d1}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.indexRows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row">{tx.names[r.key]}</th>
                      {r.scores.map((v, i) => (
                        <td key={i}>
                          <Chip v={v} />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="rowgroup" colSpan={4} className="muted small">
                      {tx.infoGroup}
                    </th>
                  </tr>
                  {table.infoRows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row">{tx.names[r.key]}</th>
                      {r.scores.map((v, i) => (
                        <td key={i}>
                          <Chip v={v} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">{tx.scoreNote}</p>
          </>
        )}
        <p className="muted small vol-note">{tx.note}</p>
      </section>

      <LiquidationsCard />

      <CapitulationCard />

      <section className="card faq">
        <h2>{seo.sections[0].h}</h2>
        {seo.sections.map((s, i) => (
          <div key={s.h}>
            {i > 0 && <h3>{s.h}</h3>}
            <p className="muted">{s.p}</p>
          </div>
        ))}
      </section>

      <Footer />
    </main>
  );
}
