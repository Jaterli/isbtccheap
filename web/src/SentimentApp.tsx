import { useEffect, useMemo, useState } from "react";
import { bandColor } from "./components/Gauge";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { InfoTip } from "./components/InfoTip";
import { LIQUIDITY_RANGES, useRange } from "./components/RangeSelect";
import { SentimentChart } from "./components/SentimentChart";
import { lang, locale, t } from "./i18n";
import { SEO_SENTIMENT } from "./i18n/seo";
import { getJson } from "./lib/data";
import {
  DAILY_METRICS,
  SENTIMENT_TFS,
  TF_METRICS,
  fromFirstScore,
  indexAgo,
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
const pct = (v: number, d = 1) => `${v.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const FORMAT: Record<SentimentMetric, (v: number) => string> = {
  fear_greed: (v) => Math.round(v).toLocaleString(locale),
  sth_sopr: (v) => v.toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
  etf_flows: (v) => t.sentiment.btc(`${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v)).toLocaleString(locale)}`),
  open_interest: (v) => t.sentiment.btc(Math.round(v).toLocaleString(locale)),
  long_pct: (v) => pct(v),
  taker_pct: (v) => pct(v),
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

const KEYS: SentimentKey[] = ["sentimiento", "fear_greed", "sth_sopr", "etf_flows", "open_interest", "long_pct", "taker_pct"];

export function SentimentApp() {
  const [history, setHistory] = useState<History | null>(null);
  const [sent, setSent] = useState<SentimentJson | null>(null);
  // La última serie cargada, con su temporalidad: al cambiar de temporalidad se sigue viendo hasta que llega la nueva
  const [loaded, setLoaded] = useState<{ tf: SentimentTf; s: SentimentSeries } | null>(null);
  // La tabla, siempre en 1 h: el sentimiento pesa más en las temporalidades cortas
  const [hourly, setHourly] = useState<SentimentSeries | null>(null);
  const [error, setError] = useState(false);
  const [tf, setTf] = useStored<SentimentTf>("isbtccheap:sentiment-tf", "1h", SENTIMENT_TFS);
  const [stored, setKey] = useStored<SentimentKey>("isbtccheap:sentiment-key", "sentimiento", KEYS);
  const range = useRange("isbtccheap:sentiment-range", "1y", LIQUIDITY_RANGES);

  // Lo que se puede elegir en esta temporalidad: la categoría y las métricas que usa en ella el índice
  const optionsFor = (x: SentimentTf): SentimentKey[] => ["sentimiento", ...TF_METRICS[x]];
  const keyFor = (x: SentimentTf): SentimentKey => (optionsFor(x).includes(stored) ? stored : "sentimiento");
  const options = optionsFor(tf);
  const k = keyFor(tf);
  const series = loaded?.s ?? null;
  // Lo que se dibuja: la serie cargada, con su temporalidad y su elección, aunque ya se haya pedido otra
  const shownTf = loaded?.tf ?? tf;
  const shownK = keyFor(shownTf);
  const updating = loaded !== null && loaded.tf !== tf;

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
        if (tf === "1h") setHourly(s);
      },
      () => alive && setError(true),
    );
    return () => {
      alive = false;
    };
  }, [tf, history, sent]);

  // La tabla necesita la serie de 1 h aunque se esté viendo otra temporalidad
  useEffect(() => {
    if (!history || !sent || hourly || tf === "1h") return;
    loadSentiment("1h", history, sent).then(setHourly, () => {});
  }, [history, sent, hourly, tf]);

  // En 1D, el periodo elegido; desde la primera puntuación de lo elegido
  const shown = useMemo(() => {
    if (!series) return null;
    const cut = fromFirstScore(shownTf === "1d" ? lastDaysOf(series, range.days) : series, shownK);
    return cut.scores[shownK].some((v) => v !== null) ? cut : null;
  }, [series, shownTf, shownK, range.days]);

  const table = useMemo(() => {
    if (!hourly || !hourly.time.length) return null;
    const cols = [0, 4, 24].map((hours) => indexAgo(hourly, hours * HOUR));
    const row = (key: SentimentKey) => ({ key, scores: cols.map((i) => (i >= 0 ? hourly.scores[key][i] : null)) });
    return { now: hourly.time.at(-1)!, hourlyRows: ["sentimiento" as const, ...TF_METRICS["1h"]].map(row), dailyRows: DAILY_METRICS.map(row) };
  }, [hourly]);

  const tx = t.sentiment;
  const seo = SEO_SENTIMENT[lang];
  const label = (key: SentimentKey) => tx.short[key];
  const lastScore = shown ? [...shown.scores.sentimiento].reverse().find((v) => v !== null) : undefined;

  return (
    <main className="container">
      <Header title={tx.title} rest={tx.rest} />

      <section className="card chart vol">
        <header>
          <h2>
            {tx.card}
            <InfoTip label={tx.card} title={tx.card}>
              {tx.info.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </InfoTip>
          </h2>
          <div className="segmented small sent-tfs" role="radiogroup" aria-label={tx.tfAria}>
            {SENTIMENT_TFS.map((x) => (
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
        </header>

        {/* Segunda fila: las métricas y, en 1D, el periodo */}
        <div className="sent-controls">
          <div className="segmented small" role="radiogroup" aria-label={tx.metricAria}>
            {options.map((o) => (
              <button key={o} role="radio" aria-checked={k === o} className={k === o ? "active" : ""} onClick={() => setKey(o)}>
                {label(o)}
              </button>
            ))}
          </div>
          {/* Los periodos son de velas diarias: con el color del botón 1D */}
          {tf === "1d" && <div className="sent-daily">{range.control}</div>}
        </div>

        {series && (
          <p className="vol-stats">
            {tx.current(t.timeframes[shownTf].label, <Chip v={lastScore} />, TF_METRICS[shownTf].map((m) => tx.short[m]).join(", "))}
          </p>
        )}
        {shown && shown.time.length > 1 ? (
          <div className={updating ? "chart-wrap updating" : "chart-wrap"} aria-busy={updating}>
            <SentimentChart
              data={shown}
              k={shownK}
              tf={shownTf}
              label={label(shownK)}
              detail={(i) => {
                if (shownK === "sentimiento") return null;
                const v = shown.values[shownK][i];
                return v === null ? null : FORMAT[shownK](v);
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
          <p className="muted">{error ? t.charts.error : series && !updating ? tx.noData : t.loading}</p>
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
                  {table.hourlyRows.map((r) => (
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
                      {tx.dailyGroup}
                    </th>
                  </tr>
                  {table.dailyRows.map((r) => (
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
