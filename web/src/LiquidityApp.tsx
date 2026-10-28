import { useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { LiquidityChart, rocPct } from "./components/LiquidityChart";
import { LIQUIDITY_RANGES, useRange } from "./components/RangeSelect";
import { lang, locale, t } from "./i18n";
import { SEO_LIQUIDITY } from "./i18n/seo";
import { getJson } from "./lib/data";
import { leadCorrelation, liquiditySeries, type LiquidityJson } from "./lib/liquidity";
import { lastDays } from "./lib/series";

const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function LiquidityApp() {
  const [liq, setLiq] = useState<LiquidityJson | null>(null);
  const [error, setError] = useState(false);
  const range = useRange("isbtccheap:liquidity-range", "4y", LIQUIDITY_RANGES);
  const [showFed, setShowFed] = useState(false);

  useEffect(() => {
    getJson("liquidity.json").then(setLiq, () => setError(true));
  }, []);

  const full = useMemo(() => (liq ? liquiditySeries(liq) : null), [liq]);
  const series = useMemo(() => (full ? lastDays(full, range.days) : null), [full, range.days]);
  const corr = useMemo(() => (series ? leadCorrelation(series) : null), [series]);

  const tx = t.liquidity;
  const seo = SEO_LIQUIDITY[lang];
  const lastOf = (v: (number | null)[]) => [...v].reverse().find((x) => x !== null);
  const net = liq && lastOf(liq.global_net ?? liq.net);
  const roc = liq && lastOf(liq.global_roc ?? liq.roc);
  const fedNet = liq && lastOf(liq.net);
  const fedRoc = liq && lastOf(liq.roc);

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
          <div className="chart-controls">
            <button className={showFed ? "btn small active" : "btn small"} aria-pressed={showFed} onClick={() => setShowFed(!showFed)}>
              <span className="legend liq-fed">{tx.fedToggle}</span>
            </button>
            {range.control}
          </div>
        </header>

        {liq && net != null && roc != null && (
          <p className="vol-stats">
            {tx.current(
              <strong className="num">{date(liq.through)}</strong>,
              <strong className="num">{tx.money(net)}</strong>,
              <strong className={roc > 0 ? "num up" : roc < 0 ? "num down" : "num"}>{rocPct(roc)}</strong>,
            )}{" "}
            {fedNet != null && fedRoc != null && tx.fed(<strong className="num">{tx.money(fedNet)}</strong>, <strong className="num">{rocPct(fedRoc)}</strong>)}{" "}
            {corr !== null && tx.correlation(<strong className="num">{`${corr > 0 ? "+" : corr < 0 ? "−" : ""}${Math.abs(corr).toLocaleString(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`}</strong>)}
          </p>
        )}
        {series && series.time.length > 1 ? <LiquidityChart data={series} showFed={showFed} /> : <p className="muted">{error ? t.charts.error : t.loading}</p>}
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
