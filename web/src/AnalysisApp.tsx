import { useEffect, useState } from "react";
import { AnalysisChart } from "./components/AnalysisChart";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { InfoTip } from "./components/InfoTip";
import { lang, locale, t } from "./i18n";
import { SEO_ANALYSIS } from "./i18n/seo";
import { ANALYSIS_URL, type Analysis } from "./lib/analysis";
import { fetchCandles } from "./lib/binance";
import { usd } from "./lib/chart";
import type { Candle } from "./types";
import { modelName } from "./lib/models";

const H4 = 4 * 3_600_000;

/**
 * Velas de 4 h tal como estaban al hacerse el análisis: hasta esa hora, y la última (a medias entonces) rehecha con las
 * de 1 minuto desde su apertura, sin lo que pasó después. Así el gráfico no cambia hasta el siguiente análisis.
 */
async function candlesAt(at: number): Promise<Candle[]> {
  const candles = await fetchCandles("4h", 120, at);
  const last = candles.at(-1);
  if (!last || at >= last.time + H4) return candles;
  const minutes = await fetchCandles("1m", 240, at);
  const inside = minutes.filter((m) => m.time >= last.time);
  if (!inside.length) return candles;
  const partial = {
    time: last.time,
    open: last.open,
    high: Math.max(...inside.map((m) => m.high)),
    low: Math.min(...inside.map((m) => m.low)),
    close: inside.at(-1)!.close,
  };
  return [...candles.slice(0, -1), partial];
}

const signedPct = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${t.percent(Math.abs(v).toLocaleString(locale, { maximumFractionDigits: 1 }))}`;

export function AnalysisApp() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [missing, setMissing] = useState(false);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [candleError, setCandleError] = useState(false);

  // El análisis se lee al cargar (cambia dos veces al día) y las velas, las de su momento: no se refrescan
  useEffect(() => {
    fetch(ANALYSIS_URL, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((a: Analysis) => {
        setAnalysis(a);
        candlesAt(Date.parse(a.generated_at)).then(setCandles, () => setCandleError(true));
      }, () => setMissing(true));
  }, []);

  const tx = t.analysis;
  const seo = SEO_ANALYSIS[lang];
  const text = analysis?.[lang];
  // Distancias a las zonas desde el precio del análisis, el mismo que cierra el gráfico
  const price = analysis?.price ?? null;

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
            {tx.updated(new Date(analysis.generated_at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }), usd(analysis.price))}
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
            {analysis.outlook_days && (
              <li className={`an-scenario primary ${analysis.outlook_days.direction}`}>
                <strong>{tx.days}</strong>
                <span>
                  {tx.move(analysis.outlook_days.direction, usd(analysis.outlook_days.target))}
                  {analysis.outlook_days.invalidation !== null && ` ${tx.invalidatedAt(usd(analysis.outlook_days.invalidation))}`}
                </span>
              </li>
            )}
            <li className={`an-scenario ${analysis.alternative.direction}`}>
              <strong>{tx.alternative(analysis.outlook.horizon_hours)}</strong>
              <span>{tx.move(analysis.alternative.direction, usd(analysis.alternative.target))}</span>
            </li>
          </ul>
        )}
      </section>

      {analysis && text && (
        <section className="card an-text">
          <h2>{text.headline}</h2>
          <p>{text.summary}</p>
          {text.trend && (
            <p className="an-outlook">
              <strong>{tx.trend}</strong> {text.trend}
            </p>
          )}
          <p className="an-outlook">
            <strong>{tx.nextHours}</strong> {text.outlook}
          </p>
          {text.outlook_days && (
            <p className="an-outlook">
              <strong>{tx.nextDays}</strong> {text.outlook_days}
            </p>
          )}
          {!!text.points?.length && (
            <>
              <h3>{tx.points}</h3>
              <ul className="an-points">
                {text.points.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
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
          <p className="muted small vol-note">{tx.note(modelName(analysis.model))}</p>
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

      <Footer />
    </main>
  );
}
