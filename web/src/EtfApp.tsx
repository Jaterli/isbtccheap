import { useEffect, useMemo, useState } from "react";
import { EtfChart, flowUsd } from "./components/EtfChart";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { SHORT_RANGES, useRange } from "./components/RangeSelect";
import { lang, locale, t } from "./i18n";
import { SEO_ETF } from "./i18n/seo";
import { getJson } from "./lib/data";
import { ETF_WINDOW, etfSeries, windowStats, type EtfJson } from "./lib/etf";
import { lastDays } from "./lib/series";

const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const flowClass = (v: number) => (v > 0 ? "num up" : v < 0 ? "num down" : "num");

/** Página de flujos de los ETF de bitcoin al contado: flujo diario frente al precio, resumen y tabla por fondo. */
export function EtfApp() {
  const [etf, setEtf] = useState<EtfJson | null>(null);
  const [error, setError] = useState(false);
  const range = useRange("isbtccheap:etf-range", "1y", SHORT_RANGES);

  useEffect(() => {
    getJson("etf.json").then(setEtf, () => setError(true));
  }, []);

  const full = useMemo(() => (etf ? etfSeries(etf) : null), [etf]);
  const series = useMemo(() => (full ? lastDays(full, range.days) : null), [full, range.days]);
  const stats = useMemo(() => (etf ? windowStats(etf) : null), [etf]);

  const tx = t.etf;
  const seo = SEO_ETF[lang];

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

        {etf && full && stats && (
          <p className="vol-stats">
            {tx.current(
              <strong className="num">{date(etf.dates.at(-1)!)}</strong>,
              <strong className={flowClass(etf.flow.at(-1)!)}>{flowUsd(etf.flow.at(-1)!)}</strong>,
              ETF_WINDOW,
              <strong className={flowClass(stats.usd)}>{flowUsd(stats.usd)}</strong>,
              <strong className="num">{`${stats.btc > 0 ? "+" : stats.btc < 0 ? "−" : ""}${Math.abs(Math.round(stats.btc)).toLocaleString(locale)}\u00a0BTC`}</strong>,
              <strong className="num">{Math.round(stats.pct)}</strong>,
              <strong className={flowClass(full.cumulative.at(-1)!)}>{flowUsd(full.cumulative.at(-1)!)}</strong>,
            )}
          </p>
        )}
        {series && series.time.length > 1 ? <EtfChart data={series} /> : <p className="muted">{error ? t.charts.error : t.loading}</p>}

        {etf && (
          <>
            <h3 className="dd-table-title">{tx.tableTitle}</h3>
            <div className="outlook-table-wrap">
              <table className="outlook-table etf-table">
                <thead>
                  <tr>
                    <th scope="col">{tx.cols.fund}</th>
                    <th scope="col">{tx.cols.last(date(etf.dates.at(-1)!))}</th>
                    <th scope="col">{tx.cols.d20(ETF_WINDOW)}</th>
                    <th scope="col">{tx.cols.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {etf.funds.map((f) => (
                    <tr key={f.ticker}>
                      <th scope="row">{f.ticker}</th>
                      <td className={flowClass(f.last)}>{f.last === 0 ? "—" : flowUsd(f.last)}</td>
                      <td className={flowClass(f.d20)}>{f.d20 === 0 ? "—" : flowUsd(f.d20)}</td>
                      <td className={flowClass(f.total)}>{flowUsd(f.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {/* La licencia CC BY 4.0 de los datos exige citar la fuente y la fecha, visible junto a ellos */}
        {etf && (
          <p className="muted small vol-note">
            {tx.source}{" "}
            <a href="https://www.tftc.io/bitcoin-etf-flows" target="_blank" rel="noreferrer">
              {etf.credit}
            </a>{" "}
            (
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
            ). {tx.note}
          </p>
        )}
      </section>

      {/* Explicación visible: ayuda a quien llega desde un buscador y es el texto que Google indexa */}
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
