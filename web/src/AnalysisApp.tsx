import { useEffect, useState } from "react";
import { AnalysisChart } from "./components/AnalysisChart";
import { TrendChart } from "./components/TrendChart";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { InfoTip } from "./components/InfoTip";
import { lang, locale, t } from "./i18n";
import { SEO_ANALYSIS } from "./i18n/seo";
import { ANALYSIS_URL, type Analysis, type ChartTf, TREND_URL, type Trend } from "./lib/analysis";
import { fetchCandles } from "./lib/binance";
import { usd } from "./lib/chart";
import type { Candle } from "./types";
import { modelName } from "./lib/models";
import { keepUnits } from "./lib/text";

const H4 = 4 * 3_600_000;
const DAY = 86_400_000;

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

/** Velas diarias hasta el análisis (unos 6 meses): la del día, a medias entonces, rehecha con las de 4 h ya congeladas */
async function dailyAt(at: number, h4: Candle[]): Promise<Candle[]> {
  const candles = await fetchCandles("1d", 180, at);
  const last = candles.at(-1);
  const day = Math.floor(at / DAY) * DAY;
  const inside = h4.filter((c) => c.time >= day);
  if (!last || last.time !== day || !inside.length) return candles;
  const partial = {
    time: day,
    open: last.open,
    high: Math.max(...inside.map((c) => c.high)),
    low: Math.min(...inside.map((c) => c.low)),
    close: inside.at(-1)!.close,
  };
  return [...candles.slice(0, -1), partial];
}

const WEEK = 7 * DAY;

/** Velas semanales hasta la revisión de la tendencia (unos 2 años): la de esa semana, a medias entonces, rehecha con las
 * de 1 h hasta ese momento */
async function weeklyAt(at: number): Promise<Candle[]> {
  const candles = await fetchCandles("1w", 104, at);
  const last = candles.at(-1);
  if (!last || at >= last.time + WEEK) return candles;
  const inside = (await fetchCandles("1h", 200, at)).filter((c) => c.time >= last.time);
  if (!inside.length) return candles;
  const partial = {
    time: last.time,
    open: last.open,
    high: Math.max(...inside.map((c) => c.high)),
    low: Math.min(...inside.map((c) => c.low)),
    close: inside.at(-1)!.close,
  };
  return [...candles.slice(0, -1), partial];
}

const signedPct = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${t.percent(Math.abs(v).toLocaleString(locale, { maximumFractionDigits: 1 }))}`;

export function AnalysisApp() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  // La tendencia de fondo, aparte: se revisa cada lunes (sin ella, la del análisis, en los anteriores)
  const [trend, setTrend] = useState<Trend | null>(null);
  const [weekly, setWeekly] = useState<Candle[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [candles, setCandles] = useState<Record<ChartTf, Candle[]> | null>(null);
  // 4 h: las próximas horas y días, con los escenarios · 1D: unos 6 meses, para ver qué niveles se han superado o perdido
  const [chartTf, setChartTf] = useState<ChartTf>("4h");
  const [candleError, setCandleError] = useState(false);

  // El análisis se lee al cargar (cambia una vez al día) y las velas, las de su momento: no se refrescan
  useEffect(() => {
    fetch(ANALYSIS_URL, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((a: Analysis) => {
        setAnalysis(a);
        const at = Date.parse(a.generated_at);
        candlesAt(at)
          .then(async (h4) => ({ "4h": h4, "1d": await dailyAt(at, h4) }))
          .then(setCandles, () => setCandleError(true));
      }, () => setMissing(true));
    fetch(TREND_URL, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((tr: Trend) => {
        setTrend(tr);
        weeklyAt(Date.parse(tr.generated_at)).then(setWeekly, () => {});
      }, () => {});
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
          <>
            <div className="segmented small an-tf" role="radiogroup" aria-label={t.timeframeAria}>
              {(["4h", "1d"] as const).map((v) => (
                <button key={v} role="radio" aria-checked={chartTf === v} className={chartTf === v ? "active" : ""} onClick={() => setChartTf(v)}>
                  {t.timeframes[v].short}
                </button>
              ))}
            </div>
            <AnalysisChart analysis={analysis} candles={candles[chartTf]} tf={chartTf} />
          </>
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
          <h2>{keepUnits(text.headline)}</h2>
          <p>{keepUnits(text.summary)}</p>
          {/* La tendencia de fondo va en su tarjeta; en los análisis anteriores a ella, aquí */}
          {!trend && text.trend && (
            <p className="an-outlook">
              <strong>{tx.trend}</strong> {keepUnits(text.trend)}
            </p>
          )}
          <p className="an-outlook">
            <strong>{tx.nextHours}</strong> {keepUnits(text.outlook)}
          </p>
          {text.outlook_days && (
            <p className="an-outlook">
              <strong>{tx.nextDays}</strong> {keepUnits(text.outlook_days)}
            </p>
          )}
          {!!text.points?.length && (
            <>
              <h3>{tx.points}</h3>
              <ul className="an-points">
                {text.points.map((s) => (
                  <li key={s}>{keepUnits(s)}</li>
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

      {trend && (
        <section className="card an-trend">
          <header>
            <h2>{tx.trendTitle}</h2>
            <span className={`an-bias ${trend.direction === "lateral" ? "neutral" : trend.direction}`}>
              {tx.trendDirection[trend.direction]} · {tx.confidence[trend.confidence - 1]}
            </span>
          </header>
          <p className="muted small an-updated">
            {tx.trendReviewed(
              new Date(trend.generated_at).toLocaleString(locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Madrid",
                timeZoneName: "short",
              }),
              trend.review.reason === "close_above" || trend.review.reason === "close_below"
                ? tx.trendEarly(trend.review.reason === "close_above", usd(trend.review.level ?? 0))
                : null,
            )}
          </p>
          {weekly && weekly.length > 1 && <TrendChart trend={trend} candles={weekly} />}
          {trend.outlook && trend.alternative && (
            <ul className="an-scenarios">
              <li className={`an-scenario primary ${trend.outlook.direction}`}>
                <strong>{tx.trendMostLikely}</strong>
                <span>{tx.move(trend.outlook.direction, usd(trend.outlook.target))}</span>
              </li>
              <li className={`an-scenario ${trend.alternative.direction}`}>
                <strong>{tx.trendAlternative}</strong>
                <span>{tx.move(trend.alternative.direction, usd(trend.alternative.target))}</span>
              </li>
            </ul>
          )}
          {/* Como en el análisis diario: el gráfico y los escenarios y, después, los textos: la situación y su porqué (en las
              revisiones anteriores, su único texto), lo más probable y las claves */}
          <p className="an-trend-summary">{keepUnits(trend[lang].summary ?? trend[lang].trend ?? "")}</p>
          {trend[lang].outlook && (
            <p className="an-outlook">
              <strong>{tx.trendMostLikely}:</strong> {keepUnits(trend[lang].outlook!)}
            </p>
          )}
          {!!trend[lang].points?.length && (
            <>
              <h3>{tx.points}</h3>
              <ul className="an-points">
                {trend[lang].points!.map((s) => (
                  <li key={s}>{keepUnits(s)}</li>
                ))}
              </ul>
            </>
          )}
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
