import { useEffect, useMemo, useState } from "react";
import { CategoriesChart } from "./components/CategoriesChart";
import { bandColor } from "./components/Gauge";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { useRange } from "./components/RangeSelect";
import { lang, locale, t } from "./i18n";
import { SEO_CATEGORIES } from "./i18n/seo";
import { categoriesSeries, ROWS, type CategoriesJson } from "./lib/categories";
import { usd } from "./lib/chart";
import { getJson } from "./lib/data";
import { cycleTops, drawdownSeries, episodes } from "./lib/drawdown";
import { lastDays } from "./lib/series";
import type { CategoryId, History } from "./types";

const CATS = ROWS.filter((r): r is CategoryId => r !== "score");

const date = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Puntuación con el color de su tramo (el mismo que el medidor) */
function Chip({ v }: { v: number | null }) {
  if (v === null) return <span className="muted">—</span>;
  return (
    <span className="cat-chip num" style={{ background: bandColor(v) }}>
      {Math.round(v)}
    </span>
  );
}

/** Página del histórico de las categorías: qué empujaba el score en cada momento, y en los techos y suelos de ciclo. */
export function CategoriesApp() {
  const [history, setHistory] = useState<History | null>(null);
  const [cats, setCats] = useState<CategoriesJson | null>(null);
  const [error, setError] = useState(false);
  const range = useRange("isbtccheap:categories-range");

  useEffect(() => {
    getJson("history.json").then(setHistory, () => setError(true));
    getJson("categories.json").then(setCats, () => setError(true));
  }, []);

  const full = useMemo(() => (history && cats ? categoriesSeries(history, cats) : null), [history, cats]);
  const series = useMemo(() => (full ? lastDays(full, range.days) : null), [full, range.days]);

  // Techos de ciclo (y el suelo que siguió a cada uno) a partir de las caídas desde máximos del precio diario
  const events = useMemo(() => {
    if (!full) return [];
    const tops = cycleTops(episodes(drawdownSeries(full)));
    return tops.flatMap((e) => [
      { time: e.athTime, kind: "top" as const },
      { time: e.lowTime, kind: e.recovered === null ? ("lowSoFar" as const) : ("bottom" as const) },
    ]);
  }, [full]);

  const tx = t.catHistory;
  const seo = SEO_CATEGORIES[lang];
  const last = full ? full.time.length - 1 : -1;
  const ranked = full ? CATS.filter((c) => full[c][last] !== null).sort((a, b) => full[a][last]! - full[b][last]!) : [];
  const rows = full
    ? [{ i: last, kind: "today" as const }, ...events.map((e) => ({ i: full.time.indexOf(e.time), kind: e.kind })).filter((r) => r.i >= 0).reverse()]
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

        {full && ranked.length > 1 && (
          <p className="vol-stats">
            {tx.current(
              <strong className="num">{date(full.time[last])}</strong>,
              <Chip v={full.score[last]} />,
              t.categories[ranked[0]].name,
              <Chip v={full[ranked[0]][last]} />,
              t.categories[ranked.at(-1)!].name,
              <Chip v={full[ranked.at(-1)!][last]} />,
            )}
          </p>
        )}
        {series && series.time.length > 1 ? (
          <CategoriesChart data={series} marks={events.filter((e) => e.kind !== "lowSoFar").map((e) => ({ time: e.time, top: e.kind === "top" }))} />
        ) : (
          <p className="muted">{error || (history && cats && !full) ? t.charts.error : t.loading}</p>
        )}

        {full && rows.length > 1 && (
          <>
            <h3 className="dd-table-title">{tx.tableTitle}</h3>
            <div className="outlook-table-wrap">
              <table className="outlook-table cat-table">
                <thead>
                  <tr>
                    <th scope="col">{tx.cols.when}</th>
                    <th scope="col">{tx.cols.price}</th>
                    {ROWS.map((r) => (
                      <th key={r} scope="col">
                        {tx.short[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.kind}-${r.i}`} className={`ev-${r.kind}`}>
                      <th scope="row">
                        {tx.kinds[r.kind]}
                        <span className="muted small"> · {date(full.time[r.i])}</span>
                      </th>
                      <td className="num">{usd(full.price[r.i])}</td>
                      {ROWS.map((row) => (
                        <td key={row}>
                          <Chip v={full[row][r.i]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
