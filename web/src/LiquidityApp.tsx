import { useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { InfoTip } from "./components/InfoTip";
import { Rich } from "./components/Rich";
import { LiquidityChart, rocPct } from "./components/LiquidityChart";
import { LiquidityScores } from "./components/LiquidityScores";
import { LIQUIDITY_RANGES, useRange } from "./components/RangeSelect";
import { lang, locale, t } from "./i18n";
import { SEO_LIQUIDITY } from "./i18n/seo";
import { getJson } from "./lib/data";
import { lastDaysOf, leadCorrelation, liquiditySeries, type LiquidityJson } from "./lib/liquidity";
import type { History } from "./types";

const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function LiquidityApp() {
  const [liq, setLiq] = useState<LiquidityJson | null>(null);
  // Precio para la tarjeta de las métricas de liquidez
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState(false);
  const range = useRange("isbtccheap:liquidity-range", "4y", LIQUIDITY_RANGES);

  useEffect(() => {
    getJson("liquidity.json").then(setLiq, () => setError(true));
    getJson("history.json").then(setHistory, () => {});
  }, []);

  const full = useMemo(() => (liq ? liquiditySeries(liq) : null), [liq]);
  const series = useMemo(() => (full ? lastDaysOf(full, range.days) : null), [full, range.days]);
  const corr = useMemo(() => (series ? leadCorrelation(series) : null), [series]);

  const tx = t.liquidity;
  const seo = SEO_LIQUIDITY[lang];
  const lastOf = (v: (number | null)[]) => [...v].reverse().find((x) => x !== null);
  const net = liq && lastOf(liq.global_net ?? liq.net);
  const roc = liq && lastOf(liq.global_roc ?? liq.roc);

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
        {/* El periodo en su propia línea, bajo el título, como en el resto de gráficas de la página */}
        <div className="sent-controls">{range.control}</div>

        {liq && net != null && roc != null && (
          <p className="vol-stats">
            {tx.current(
              <strong className="num">{date(liq.through)}</strong>,
              <strong className="num">{tx.money(net)}</strong>,
              <strong className={roc > 0 ? "num up" : roc < 0 ? "num down" : "num"}>{rocPct(roc)}</strong>,
              <strong className="num">{full ? date(new Date(full.end).toISOString().slice(0, 10)) : "—"}</strong>,
            )}{" "}
            {corr !== null && tx.correlation(<strong className="num">{`${corr > 0 ? "+" : corr < 0 ? "−" : ""}${Math.abs(corr).toLocaleString(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`}</strong>)}
          </p>
        )}
        {series && series.liqTime.length > 1 ? <LiquidityChart data={series} /> : <p className="muted">{error ? t.charts.error : t.loading}</p>}
        <p className="muted small vol-note">{tx.note}</p>
      </section>

      <LiquidityScores history={history} />

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
