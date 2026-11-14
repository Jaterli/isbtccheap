import { useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { CategoryScores } from "./components/CategoryScores";
import { InfoTip } from "./components/InfoTip";
import { Rich } from "./components/Rich";
import { useRange } from "./components/RangeSelect";
import { ValuationChart } from "./components/ValuationChart";
import { lang, locale, t } from "./i18n";
import { SEO_VALUATION } from "./i18n/seo";
import { fetchCandles } from "./lib/binance";
import { usd } from "./lib/chart";
import { getJson } from "./lib/data";
import { lastDays } from "./lib/series";
import type { History } from "./types";
import { valuationSeries, type BandsJson } from "./lib/valuation";

// Métricas de la categoría de valoración on-chain del índice, en el orden de su tarjeta
const METRICS = ["mvrv", "puell", "mayer"] as const;

// Margen (en múltiplo) para decir que el precio está "cerca" del suelo o del techo del corredor
const NEAR = 1.25;

const pct = (f: number) => `${f > 0 ? "+" : ""}${t.percent(Math.round(f * 100).toLocaleString(locale))}`;
const mult = (m: number) => `×${m.toLocaleString(locale, { maximumFractionDigits: 2 })}`;

function corridorZone(m: number, low: number, high: number) {
  const z = t.valuation.zones;
  return m < low ? z.below : m < low * NEAR ? z.nearLow : m > high ? z.above : m > high / NEAR ? z.nearHigh : m < 1 ? z.underTrend : z.overTrend;
}

export function ValuationApp() {
  const [bands, setBands] = useState<BandsJson | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [error, setError] = useState(false);
  // Precio para la tarjeta de las métricas de valoración
  const [history, setHistory] = useState<History | null>(null);
  const range = useRange("isbtccheap:valuation-range");

  useEffect(() => {
    getJson("bands.json").then(setBands, () => setError(true));
    getJson("history.json").then(setHistory, () => {});
    fetchCandles("1d", 1).then((c) => setLive(c.at(-1)?.close ?? null), () => {});
  }, []);

  const full = useMemo(() => (bands ? valuationSeries(bands, live) : null), [bands, live]);
  const series = useMemo(() => (full ? lastDays(full, range.days) : null), [full, range.days]);

  const tx = t.valuation;
  const seo = SEO_VALUATION[lang];
  const now = full && {
    price: full.price.at(-1)!,
    realized: full.realized.at(-1)!,
    sth: full.sth.at(-1) ?? null,
    wma: full.wma200.at(-1)!,
    trend: full.trend.at(-1)!,
    low: full.low.at(-1)!,
    high: full.high.at(-1)!,
  };
  const levels =
    now &&
    (
      [
        ["realized", now.realized],
        ["sth", now.sth],
        ["wma", now.wma],
        ["trend", now.trend],
        ["low", now.low],
        ["high", now.high],
      ] as const
    ).filter((l): l is [typeof l[0], number] => l[1] !== null);

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
        <div className="sent-controls">{range.control}</div>

        {now && bands && (
          <p className="vol-stats">
            {tx.current(
              <strong className="num">{usd(now.price)}</strong>,
              <strong className="num">{pct(now.price / now.realized - 1)}</strong>,
              <strong className="num">{pct(now.price / now.wma - 1)}</strong>,
              <strong className="num">{mult(now.price / now.trend)}</strong>,
              corridorZone(now.price / now.trend, bands.power_law.low, bands.power_law.high),
            )}
          </p>
        )}
        {series && series.time.length > 1 ? <ValuationChart data={series} /> : <p className="muted">{error ? t.charts.error : t.loading}</p>}

        {now && levels && (
          <div className="outlook-table-wrap">
            <table className="outlook-table val-table">
              <thead>
                <tr>
                  <th scope="col">{tx.cols.level}</th>
                  <th scope="col">{tx.cols.value}</th>
                  <th scope="col">{tx.cols.distance}</th>
                </tr>
              </thead>
              <tbody>
                {levels.map(([k, v]) => {
                  const d = now.price / v - 1;
                  return (
                    <tr key={k}>
                      <th scope="row">
                        <span className={`legend val-${k}`}>{tx.levels[k]}</span>
                      </th>
                      <td className="num">{usd(v)}</td>
                      <td className="num">{pct(d)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small vol-note">{tx.note}</p>
      </section>

      <CategoryScores
        history={history}
        file="valuation_scores.json"
        metrics={METRICS}
        tx={tx.scores}
        format={(_, v) => v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        storageKey="isbtccheap:valuation-scores-range"
      />

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
