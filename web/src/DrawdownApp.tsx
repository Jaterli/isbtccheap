import { useEffect, useMemo, useState } from "react";
import { ddPct, DrawdownChart } from "./components/DrawdownChart";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { Moves } from "./components/Moves";
import { useRange } from "./components/RangeSelect";
import { lang, locale, t } from "./i18n";
import { SEO_DRAWDOWN } from "./i18n/seo";
import { fetchCandles } from "./lib/binance";
import { usd } from "./lib/chart";
import { getJson } from "./lib/data";
import { daysBetween, drawdownSeries, episodes } from "./lib/drawdown";
import { lastDays } from "./lib/series";
import { bandsPrice, type BandsJson } from "./lib/valuation";
import type { History } from "./types";

// Grandes mercados bajistas, para comparar con el actual
const BEAR = -0.7;

const date = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function DrawdownApp() {
  const [bands, setBands] = useState<BandsJson | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState(false);
  const range = useRange("isbtccheap:drawdown-range");

  // bands.json empieza en 2010; history.json, en julio de 2011, después del máximo de junio
  useEffect(() => {
    getJson("bands.json").then(setBands, () => setError(true));
    // Caídas y subidas por tamaño: mismo histórico que usaba en la portada
    getJson("history.json").then(setHistory, () => {});
    fetchCandles("1d", 1).then((c) => setLive(c.at(-1)?.close ?? null), () => {});
  }, []);

  const full = useMemo(() => (bands ? drawdownSeries(bandsPrice(bands, live)) : null), [bands, live]);
  const series = useMemo(() => (full ? lastDays(full, range.days) : null), [full, range.days]);
  const eps = useMemo(() => (full ? episodes(full) : []), [full]);

  const tx = t.drawdown;
  const seo = SEO_DRAWDOWN[lang];
  const cur = eps.at(-1);
  const bears = eps.filter((e) => e.recovered !== null && e.dd <= BEAR);
  const today = full?.time.at(-1);

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

        {full && cur && today !== undefined && (
          <p className="vol-stats">
            {cur.dd === 0 || cur.athTime === today
              ? tx.atAth(<strong className="num">{usd(cur.ath)}</strong>)
              : tx.current(
                  <strong className="num">{ddPct(-full.dd.at(-1)!)}</strong>,
                  <strong className="num">{usd(cur.ath)}</strong>,
                  <strong className="num">{date(cur.athTime)}</strong>,
                  <strong className="num">{daysBetween(cur.athTime, today)}</strong>,
                  <strong className="num">{ddPct(-cur.dd)}</strong>,
                  <strong className="num">{date(cur.lowTime)}</strong>,
                )}{" "}
            {bears.length > 0 &&
              tx.bears(
                bears.length,
                <strong className="num">{ddPct(-Math.max(...bears.map((e) => e.dd)))}</strong>,
                <strong className="num">{ddPct(-Math.min(...bears.map((e) => e.dd)))}</strong>,
              )}
          </p>
        )}
        {series && series.time.length > 1 ? <DrawdownChart data={series} /> : <p className="muted">{error ? t.charts.error : t.loading}</p>}

        {eps.length > 0 && today !== undefined && (
          <>
            <h3 className="dd-table-title">{tx.tableTitle}</h3>
            <div className="outlook-table-wrap">
              <table className="outlook-table dd-table">
                <thead>
                  <tr>
                    <th scope="col">{tx.cols.ath}</th>
                    <th scope="col">{tx.cols.dd}</th>
                    <th scope="col">{tx.cols.low}</th>
                    <th scope="col">{tx.cols.toLow}</th>
                    <th scope="col">{tx.cols.toRecover}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...eps].reverse().map((e) => (
                    <tr key={e.athTime} className={e.recovered === null ? "current" : undefined}>
                      <th scope="row">
                        {date(e.athTime)}
                        <span className="muted small"> · {usd(e.ath)}</span>
                      </th>
                      <td className="num down">{e.dd === 0 ? "—" : ddPct(e.dd)}</td>
                      <td className="num">
                        {e.dd === 0 ? "—" : date(e.lowTime)}
                        {e.dd !== 0 && <span className="muted small"> · {usd(e.low)}</span>}
                      </td>
                      <td className="num">{e.dd === 0 ? "—" : daysBetween(e.athTime, e.lowTime)}</td>
                      <td className="num">{e.recovered === null ? tx.ongoing : daysBetween(e.athTime, e.recovered)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="muted small vol-note">{tx.note}</p>
      </section>

      {history && <Moves history={history} livePrice={live} />}

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
