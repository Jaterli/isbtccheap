import { useEffect, useState } from "react";
import { AnalysisChart } from "./components/AnalysisChart";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { lang, locale, t } from "./i18n";
import { SEO_ANALYSIS } from "./i18n/seo";
import { ANALYSIS_URL, type Analysis } from "./lib/analysis";
import { fetchCandles } from "./lib/binance";
import { usd } from "./lib/chart";
import type { Candle } from "./types";

// Las velas se refrescan; el análisis cambia dos veces al día, basta con leerlo al cargar
const CANDLES_MS = 5 * 60_000;

const signedPct = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${t.percent(Math.abs(v).toLocaleString(locale, { maximumFractionDigits: 1 }))}`;

export function AnalysisApp() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [missing, setMissing] = useState(false);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [candleError, setCandleError] = useState(false);

  useEffect(() => {
    fetch(ANALYSIS_URL, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setAnalysis, () => setMissing(true));
    const load = () =>
      fetchCandles("4h", 120).then(
        (c) => {
          setCandles(c);
          setCandleError(false);
        },
        () => setCandleError(true),
      );
    load();
    const id = setInterval(load, CANDLES_MS);
    return () => clearInterval(id);
  }, []);

  const tx = t.analysis;
  const seo = SEO_ANALYSIS[lang];
  const text = analysis?.[lang];
  const price = candles?.at(-1)?.close ?? analysis?.price ?? null;

  return (
    <main className="container">
      <Header title={tx.title} rest={tx.rest} />

      <section className="card chart">
        <header>
          <h2>
            {tx.card}
            <InfoTip label={tx.card} title={tx.card}>
              {tx.info.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </InfoTip>
          </h2>
          {analysis && (
            <span className={`an-bias ${analysis.bias}`}>
              {tx.bias[analysis.bias]} · {tx.confidence[analysis.confidence - 1]}
            </span>
          )}
        </header>

        {analysis && (
          <p className="muted small an-updated">
            {tx.updated(new Date(analysis.generated_at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), usd(analysis.price))}
          </p>
        )}

        {analysis && candles ? (
          <AnalysisChart analysis={analysis} candles={candles} />
        ) : (
          <p className="muted">{missing ? tx.unavailable : candleError ? t.charts.error : t.loading}</p>
        )}

        {analysis && (
          <ul className="an-scenarios">
            <li className={`an-scenario primary ${analysis.outlook.direction}`}>
              <strong>{tx.mostLikely(analysis.outlook.horizon_hours)}</strong>
              <span>
                {tx.move(analysis.outlook.direction, usd(analysis.outlook.target))}
                {analysis.outlook.invalidation !== null && ` ${tx.invalidatedAt(usd(analysis.outlook.invalidation))}`}
              </span>
            </li>
            <li className={`an-scenario ${analysis.alternative.direction}`}>
              <strong>{tx.alternative}</strong>
              <span>{tx.move(analysis.alternative.direction, usd(analysis.alternative.target))}</span>
            </li>
          </ul>
        )}
      </section>

      {analysis && text && (
        <section className="card an-text">
          <h2>{text.headline}</h2>
          <p>{text.summary}</p>
          <p className="an-outlook">
            <strong>{tx.nextHours}</strong> {text.outlook}
          </p>
          <div className="an-columns">
            <div>
              <h3>{tx.technical}</h3>
              <ul>
                {text.technical.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>{tx.sentiment}</h3>
              <ul>
                {text.sentiment.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {analysis && (
        <section className="card">
          <h2>{tx.levelsTitle}</h2>
          <div className="outlook-table-wrap">
            <table className="outlook-table an-table">
              <thead>
                <tr>
                  <th scope="col">{tx.cols.zone}</th>
                  <th scope="col">{tx.cols.range}</th>
                  <th scope="col">{tx.cols.distance}</th>
                  <th scope="col">{tx.cols.strength}</th>
                </tr>
              </thead>
              <tbody>
                {[...analysis.levels]
                  .sort((p, q) => q.mid - p.mid)
                  .map((l) => (
                    <tr key={l.id}>
                      <th scope="row">
                        <span className={`an-id ${l.kind}`}>{l.id}</span>
                      </th>
                      <td className="num">
                        {usd(l.low)} – {usd(l.high)}
                      </td>
                      <td className="num">{price ? signedPct((l.mid / price - 1) * 100) : "—"}</td>
                      <td>
                        <span className="an-strength" title={tx.strength[l.strength - 1]}>
                          {[1, 2, 3].map((k) => (
                            <i key={k} className={l.strength >= k ? "on" : undefined} />
                          ))}
                          <span className="visually-hidden">{tx.strength[l.strength - 1]}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="muted small vol-note">{tx.note(analysis.model)}</p>
        </section>
      )}

      <section className="card faq">
        <h2>{seo.sections[0].h}</h2>
        {seo.sections.map((s, i) => (
          <div key={s.h}>
            {i > 0 && <h3>{s.h}</h3>}
            <p className="muted">{s.p}</p>
          </div>
        ))}
      </section>

      <footer className="muted small">
        <p>{t.footer.disclaimer}</p>
        <p className="credit">
          {t.footer.credit} <a href="https://jaterli.com" target="_blank" rel="noreferrer">Jaterli</a>
        </p>
      </footer>
    </main>
  );
}
