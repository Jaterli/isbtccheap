import { useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { PhaseChart } from "./components/PhaseChart";
import { useRange } from "./components/RangeSelect";
import { lang, locale, t } from "./i18n";
import { SEO_PHASE } from "./i18n/seo";
import { usd } from "./lib/chart";
import { getJson } from "./lib/data";
import { phaseSeries, phaseStats, type PhaseChange, type PhaseJson } from "./lib/phase";
import { lastDays } from "./lib/series";

const DAY = 86_400_000;
const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const pct = (v: number | null, signed = true) =>
  v === null ? "—" : `${signed && v > 0 ? "+" : v < 0 ? "−" : ""}${t.percent(Math.abs(Math.round(v * 100)).toLocaleString(locale))}`;
const daysSince = (d: string) => Math.round((Date.now() - Date.parse(`${d}T00:00:00Z`)) / DAY);

export function PhaseApp() {
  const [phase, setPhase] = useState<PhaseJson | null>(null);
  const [error, setError] = useState(false);
  const range = useRange("isbtccheap:phase-range", "4y");

  useEffect(() => {
    getJson("phase.json").then(setPhase, () => setError(true));
  }, []);

  const full = useMemo(() => (phase ? phaseSeries(phase) : null), [phase]);
  const series = useMemo(() => (full ? lastDays(full, range.days) : null), [full, range.days]);
  const stats = useMemo(
    () =>
      full && phase
        ? {
            trend: phaseStats(full, full.trend, phase.trend),
            liquidity: phase.liquidity ? phaseStats(full, full.liquidity, phase.liquidity) : null,
          }
        : null,
    [full, phase],
  );

  const tx = t.phase;
  const seo = SEO_PHASE[lang];
  const trendNow = phase?.trend.at(-1);
  const liqNow = phase?.liquidity?.at(-1);
  const price = full?.price.at(-1);
  const sth = full?.sth.at(-1);
  // Últimos cambios de tendencia (el primero de la lista es el estado inicial, no un cambio), con su duración
  const changes: (PhaseChange & { price: number | null; days: number })[] =
    phase && full
      ? phase.trend
          .slice(1)
          .map((c, i, all) => {
            const t0 = Date.parse(`${c[0]}T00:00:00Z`);
            const i0 = full.time.indexOf(t0);
            const next = all[i + 1] ? Date.parse(`${all[i + 1][0]}T00:00:00Z`) : Date.now();
            return Object.assign([...c] as PhaseChange, { price: i0 >= 0 ? full.price[i0] : null, days: Math.round((next - t0) / DAY) });
          })
          .slice(-8)
          .reverse()
      : [];

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

        {trendNow && price != null && (
          <p className="vol-stats">
            {tx.currentTrend(
              <strong className={trendNow[1] === 1 ? "up" : "down"}>{tx.names.trend[trendNow[1] === 1 ? "up" : "down"]}</strong>,
              <strong className="num">{date(trendNow[0])}</strong>,
              daysSince(trendNow[0]),
              sth ? <strong className="num">{pct(price / sth - 1)}</strong> : null,
              sth ? <strong className="num">{usd(sth)}</strong> : null,
            )}{" "}
            {liqNow &&
              tx.currentLiquidity(
                <strong className={liqNow[1] === 1 ? "up" : "down"}>{tx.names.liquidity[liqNow[1] === 1 ? "up" : "down"]}</strong>,
                <strong className="num">{date(liqNow[0])}</strong>,
                phase?.liquidity_roc != null ? <strong className="num">{pct(phase.liquidity_roc)}</strong> : null,
              )}
          </p>
        )}
        {series && series.time.length > 1 ? <PhaseChart data={series} /> : <p className="muted">{error ? t.charts.error : t.loading}</p>}

        {stats && (
          <>
            <h3 className="dd-table-title">{tx.statsTitle}</h3>
            <div className="outlook-table-wrap">
              <table className="outlook-table phase-table">
                <thead>
                  <tr>
                    <th scope="col">{tx.cols.indicator}</th>
                    <th scope="col">{tx.cols.bull90}</th>
                    <th scope="col">{tx.cols.bear90}</th>
                    <th scope="col">{tx.cols.bullShare}</th>
                    <th scope="col">{tx.cols.perYear}</th>
                    <th scope="col">{tx.cols.false}</th>
                  </tr>
                </thead>
                <tbody>
                  {(["trend", "liquidity"] as const).map((k) => {
                    const s = stats[k];
                    return (
                      s && (
                        <tr key={k}>
                          <th scope="row">{tx.indicators[k]}</th>
                          <td className="num up">{pct(s.bull90)}</td>
                          <td className={s.bear90 !== null && s.bear90 < 0 ? "num down" : "num"}>{pct(s.bear90)}</td>
                          <td className="num">{pct(s.bullShare, false)}</td>
                          <td className="num">{s.changesPerYear.toLocaleString(locale, { maximumFractionDigits: 1 })}</td>
                          <td className="num">{pct(s.falseShare, false)}</td>
                        </tr>
                      )
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h3 className="dd-table-title">{tx.changesTitle}</h3>
            <div className="outlook-table-wrap">
              <table className="outlook-table phase-table">
                <thead>
                  <tr>
                    <th scope="col">{tx.cols.date}</th>
                    <th scope="col">{tx.cols.phase}</th>
                    <th scope="col">{tx.cols.price}</th>
                    <th scope="col">{tx.cols.duration}</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c, i) => (
                    <tr key={c[0]}>
                      <th scope="row">{date(c[0])}</th>
                      <td className={c[1] === 1 ? "up" : "down"}>{tx.names.trend[c[1] === 1 ? "up" : "down"]}</td>
                      <td className="num">{c.price === null ? "—" : usd(c.price)}</td>
                      <td className="num">{i === 0 ? tx.ongoing(c.days) : tx.days(c.days)}</td>
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

      <footer className="muted small">
        <p>{t.footer.disclaimer}</p>
        <p className="credit">
          {t.footer.credit} <a href="https://jaterli.com" target="_blank" rel="noreferrer">Jaterli</a>
        </p>
      </footer>
    </main>
  );
}
