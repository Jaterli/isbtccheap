import { useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { useRange } from "./components/RangeSelect";
import { ValuationChart } from "./components/ValuationChart";
import { lang, locale, t } from "./i18n";
import { SEO_VALUATION } from "./i18n/seo";
import { fetchCandles } from "./lib/binance";
import { usd } from "./lib/chart";
import { getJson } from "./lib/data";
import { lastDays } from "./lib/series";
import { valuationSeries, type BandsJson } from "./lib/valuation";

// Margen para decir que el precio está "cerca" del suelo o del techo del corredor (en múltiplo)
const NEAR = 1.25;

const pct = (f: number) => `${f > 0 ? "+" : ""}${t.percent(Math.round(f * 100).toLocaleString(locale))}`;
const mult = (m: number) => `×${m.toLocaleString(locale, { maximumFractionDigits: 2 })}`;

/** Posición del precio en el corredor de la power law, como múltiplo de la tendencia */
function corridorZone(m: number, low: number, high: number) {
  const z = t.valuation.zones;
  return m < low ? z.below : m < low * NEAR ? z.nearLow : m > high ? z.above : m > high / NEAR ? z.nearHigh : m < 1 ? z.underTrend : z.overTrend;
}

/** Página de bandas de valoración: el precio frente a sus niveles de referencia de largo plazo. */
export function ValuationApp() {
  const [bands, setBands] = useState<BandsJson | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const range = useRange("isbtccheap:valuation-range");

  useEffect(() => {
    getJson("bands.json").then(setBands, () => setError(true));
    fetchCandles("1d", 1).then((c) => setLive(c.at(-1)?.close ?? null), () => {});
  }, []);

  const full = useMemo(() => (bands ? valuationSeries(bands, live) : null), [bands, live]);
  const series = useMemo(() => (full ? lastDays(full, range.days) : null), [full, range.days]);

  const tx = t.valuation;
  const seo = SEO_VALUATION[lang];
  const now = full && {
    price: full.price.at(-1)!,
    realized: full.realized.at(-1)!,
    wma: full.wma200.at(-1)!,
    trend: full.trend.at(-1)!,
    low: full.low.at(-1)!,
    high: full.high.at(-1)!,
  };
  const levels = now && ([
    ["realized", now.realized],
    ["wma", now.wma],
    ["trend", now.trend],
    ["low", now.low],
    ["high", now.high],
  ] as const);

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

        {now && bands && (
          <p className="vol-stats">
            {tx.current(
              <strong className="num">{usd(now.price)}</strong>,
              <strong className="num">{pct(now.price / now.realized - 1)}</strong>,
              <strong className="num">{pct(now.price / now.wma - 1)}</strong>,
              <strong className="num">{mult(now.price / now.trend)}</strong>,
              corridorZone(now.price / now.trend, bands.power_law.low, bands.power_law.high),
            )}
          </p>
        )}
        {series && series.time.length > 1 ? <ValuationChart data={series} /> : <p className="muted">{error ? t.charts.error : t.loading}</p>}

        {now && levels && (
          <div className="outlook-table-wrap">
            <table className="outlook-table val-table">
              <thead>
                <tr>
                  <th scope="col">{tx.cols.level}</th>
                  <th scope="col">{tx.cols.value}</th>
                  <th scope="col">{tx.cols.distance}</th>
                </tr>
              </thead>
              <tbody>
                {levels.map(([k, v]) => {
                  const d = now.price / v - 1;
                  return (
                    <tr key={k}>
                      <th scope="row">
                        <span className={`legend val-${k}`}>{tx.levels[k]}</span>
                      </th>
                      <td className="num">{usd(v)}</td>
                      <td className="num">{pct(d)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small vol-note">{tx.note}</p>
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
