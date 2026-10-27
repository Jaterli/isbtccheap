import { useMemo } from "react";
import { CandleSeriesControls, useCandleSeries } from "./components/CandleSeries";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { VolChart } from "./components/VolChart";
import { lang, locale, t } from "./i18n";
import { SEO_VOL } from "./i18n/seo";
import { lastDays } from "./lib/series";
import { volSeries } from "./lib/volatility";

const pct = (v: number) => t.percent(Math.round(v * 100).toLocaleString(locale));

/** Página de volatilidad: volatilidad realizada por tamaño de vela, con el precio de BTC superpuesto. */
export function VolatilityApp() {
  const cs = useCandleSeries("isbtccheap:vol");
  const { tf, base, days } = cs;
  const series = useMemo(() => (base ? lastDays(volSeries(tf, base), days) : null), [tf, base, days]);

  const stats = useMemo(() => {
    const vols = series?.vol.filter((v): v is number => v !== null) ?? [];
    if (!vols.length) return null;
    const current = vols.at(-1)!;
    return {
      current,
      percentile: (vols.filter((v) => v <= current).length / vols.length) * 100,
      mean: vols.reduce((a, b) => a + b, 0) / vols.length,
    };
  }, [series]);

  const tx = t.vol;
  const seo = SEO_VOL[lang];

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
          <CandleSeriesControls state={cs} />
        </header>

        {stats && (
          <p className="vol-stats">
            {tx.current(
              <strong className="num">{pct(stats.current)}</strong>,
              <strong className="num">{Math.round(stats.percentile)}</strong>,
              <span className="num">{pct(stats.mean)}</span>,
            )}
          </p>
        )}
        {series && series.time.length > 1 ? (
          <VolChart data={series} tf={tf} />
        ) : (
          <p className="muted">{cs.error ? t.charts.error : t.loading}</p>
        )}
        <p className="muted small vol-note">{t.charts.note}</p>
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
