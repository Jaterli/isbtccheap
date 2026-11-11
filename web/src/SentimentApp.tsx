import { useEffect, useMemo, useState } from "react";
import { HeatmapChart } from "./components/CategoriesChart";
import { bandColor } from "./components/Gauge";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { InfoTip } from "./components/InfoTip";
import { LIQUIDITY_RANGES, useRange } from "./components/RangeSelect";
import { lang, locale, t } from "./i18n";
import { SEO_SENTIMENT } from "./i18n/seo";
import { getJson } from "./lib/data";
import { SENTIMENT_METRICS, SENTIMENT_ROWS, sentimentSeries, type SentimentJson, type SentimentMetric } from "./lib/sentiment";
import { lastDays } from "./lib/series";
import type { History } from "./types";

const DAY = 86_400_000;

const date = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Valor de una métrica con su formato: Fear & Greed entero, SOPR con 3 decimales y flujos en BTC con signo */
function fmtValue(m: SentimentMetric, v: number | null): string | null {
  if (v === null) return null;
  if (m === "sth_sopr") return v.toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  if (m === "etf_flows") return t.sentiment.btc(`${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v)).toLocaleString(locale)}`);
  return Math.round(v).toLocaleString(locale);
}

function Chip({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="muted">—</span>;
  return (
    <span className="cat-chip num" style={{ background: bandColor(v) }}>
      {Math.round(v)}
    </span>
  );
}

export function SentimentApp() {
  const [history, setHistory] = useState<History | null>(null);
  const [sent, setSent] = useState<SentimentJson | null>(null);
  const [error, setError] = useState(false);
  const range = useRange("isbtccheap:sentiment-range", "1y", LIQUIDITY_RANGES);

  useEffect(() => {
    getJson("history.json").then(setHistory, () => setError(true));
    getJson("sentiment.json").then(setSent, () => setError(true));
  }, []);

  const full = useMemo(() => (history && sent ? sentimentSeries(history, sent) : null), [history, sent]);
  const series = useMemo(() => {
    if (!full) return null;
    const cut = lastDays(full, range.days);
    // lastDays recorta las filas del mapa; los valores, con el mismo número de días
    const n = cut.time.length;
    return { ...cut, values: Object.fromEntries(SENTIMENT_METRICS.map((m) => [m, full.values[m].slice(-n)])) as typeof full.values };
  }, [full, range.days]);

  const tx = t.sentiment;
  const seo = SEO_SENTIMENT[lang];
  const last = full ? full.time.length - 1 : -1;
  // Índice del último día con dato a `days` días de hoy
  const ago = (days: number) => (full ? full.time.findIndex((x) => x >= full.time[last] - days * DAY) : -1);
  const cols = full ? [last, ago(30), ago(365)] : [];

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
          {range.control}
        </header>

        {full && last >= 0 && (
          <p className="vol-stats">
            {tx.current(
              <strong className="num">{date(full.time[last])}</strong>,
              <Chip v={full.sentimiento[last]} />,
              <strong className="num">{fmtValue("fear_greed", full.values.fear_greed[last]) ?? "—"}</strong>,
              <strong className="num">{fmtValue("sth_sopr", full.values.sth_sopr[last]) ?? "—"}</strong>,
              <strong className="num">{fmtValue("etf_flows", full.values.etf_flows[last]) ?? "—"}</strong>,
            )}
          </p>
        )}
        {series && series.time.length > 1 ? (
          <HeatmapChart
            data={series}
            rows={SENTIMENT_ROWS}
            labels={tx.short}
            bold="sentimiento"
            detail={(row, i) => (row === "sentimiento" ? null : fmtValue(row as SentimentMetric, series.values[row as SentimentMetric][i]))}
            aria={tx.chartAria}
          />
        ) : (
          <p className="muted">{error || (history && sent && !full) ? t.charts.error : t.loading}</p>
        )}

        {full && (
          <>
            <h3 className="dd-table-title">{tx.tableTitle}</h3>
            <div className="outlook-table-wrap">
              <table className="outlook-table cat-table">
                <thead>
                  <tr>
                    <th scope="col">{tx.cols.metric}</th>
                    <th scope="col">{tx.cols.value}</th>
                    <th scope="col">{tx.cols.now}</th>
                    <th scope="col">{tx.cols.d30}</th>
                    <th scope="col">{tx.cols.y1}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{tx.short.sentimiento}</th>
                    <td className="num muted">—</td>
                    {cols.map((i, k) => (
                      <td key={k}>
                        <Chip v={i >= 0 ? full.sentimiento[i] : null} />
                      </td>
                    ))}
                  </tr>
                  {SENTIMENT_METRICS.map((m) => (
                    <tr key={m}>
                      <th scope="row">{tx.names[m]}</th>
                      <td className="num">{fmtValue(m, full.values[m][last]) ?? "—"}</td>
                      {cols.map((i, k) => (
                        <td key={k}>
                          <Chip v={i >= 0 ? full[m][i] : null} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
