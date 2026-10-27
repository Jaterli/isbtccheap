import { useMemo } from "react";
import { BollingerChart } from "./components/BollingerChart";
import { CandleSeriesControls, useCandleSeries } from "./components/CandleSeries";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { lang, locale, t } from "./i18n";
import { SEO_BB } from "./i18n/seo";
import { bollingerSeries } from "./lib/bollinger";
import { lastDays } from "./lib/series";

// Por debajo de este percentil del periodo, las bandas se consideran muy estrechas ("squeeze")
const SQUEEZE_PCT = 10;

/** Dónde está el precio respecto a las bandas, según el %B */
function zone(b: number) {
  const z = t.bb.zones;
  return b > 100 ? z.above : b >= 80 ? z.nearUpper : b > 20 ? z.inside : b >= 0 ? z.nearLower : z.below;
}

/** Página de Bollinger %B: precio con sus bandas y %B, por tamaño de vela. */
export function BollingerApp() {
  const cs = useCandleSeries("isbtccheap:bb");
  const { tf, base, days } = cs;
  const series = useMemo(() => (base ? lastDays(bollingerSeries(base), days) : null), [base, days]);

  const stats = useMemo(() => {
    const b = series?.pctB.at(-1);
    const widths = series?.width.filter((v): v is number => v !== null) ?? [];
    if (b == null || !widths.length) return null;
    const w = widths.at(-1)!;
    return { b, w, wPct: (widths.filter((v) => v <= w).length / widths.length) * 100 };
  }, [series]);

  const tx = t.bb;
  const seo = SEO_BB[lang];

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
              <strong className="num">{Math.round(stats.b)}</strong>,
              zone(stats.b),
              <strong className="num">{t.percent((stats.w * 100).toLocaleString(locale, { maximumFractionDigits: 1 }))}</strong>,
              <strong className="num">{Math.round(stats.wPct)}</strong>,
            )}
            {stats.wPct <= SQUEEZE_PCT && tx.squeeze}
          </p>
        )}
        {series && series.time.length > 1 ? (
          <BollingerChart data={series} tf={tf} />
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
