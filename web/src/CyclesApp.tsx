import { useEffect, useMemo, useState } from "react";
import { CyclesChart, fmtMult } from "./components/CyclesChart";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { lang, locale, t } from "./i18n";
import { SEO_CYCLES } from "./i18n/seo";
import { fetchCandles } from "./lib/binance";
import { cycles as splitCycles, LAST_HALVING, multAt, NEXT_HALVING } from "./lib/cycles";
import { getJson } from "./lib/data";
import { priceSeries } from "./lib/series";
import type { History } from "./types";

const HIDDEN_KEY = "isbtccheap:cycles-hidden";

const pct = (f: number) => t.percent((f * 100).toLocaleString(locale, { maximumFractionDigits: 0 }));
const usd = (p: number) => p.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: p < 100 ? 2 : 0 });
const date = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function loadHidden(): number[] {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Página de ciclos de halving: el precio de cada ciclo desde su halving, superpuestos para compararlos. */
export function CyclesApp() {
  const [history, setHistory] = useState<History | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [hidden, setHidden] = useState<number[]>(loadHidden);

  useEffect(() => {
    getJson("history.json").then(setHistory, () => setError(true));
    fetchCandles("1d", 1).then((c) => setLive(c.at(-1)?.close ?? null), () => {});
  }, []);

  const all = useMemo(() => (history ? splitCycles(priceSeries("1d", { history, live })) : []), [history, live]);
  const today = Math.floor((Date.now() - LAST_HALVING) / 86_400_000);
  const current = all.find((c) => c.current);
  const past = all.filter((c) => !c.current);

  const toggle = (year: number) => {
    const next = hidden.includes(year) ? hidden.filter((y) => y !== year) : [...hidden, year];
    // Siempre queda al menos un ciclo a la vista
    if (next.length >= all.length) return;
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      /* almacenamiento no disponible: no pasa nada */
    }
  };

  const tx = t.cycles;
  const seo = SEO_CYCLES[lang];

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
            <div className="segmented small" role="group" aria-label={tx.toggleAria}>
              {all.map((c) => (
                <button key={c.year} aria-pressed={!hidden.includes(c.year)} className={hidden.includes(c.year) ? "" : "active"} onClick={() => toggle(c.year)}>
                  <span className={`legend cycle-${c.year}`}>{c.year}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {current && past.length > 0 && (
          <p className="vol-stats">
            {tx.current(
              <strong className="num">{today}</strong>,
              <strong className="num">{pct(today / ((NEXT_HALVING - LAST_HALVING) / 86_400_000))}</strong>,
              <strong className="num">{fmtMult(current.mult.at(-1)!)}</strong>,
              new Intl.ListFormat(locale).format(
                past.flatMap((c) => {
                  const m = multAt(c, today);
                  return m === null ? [] : [`${fmtMult(m)} (${c.year})`];
                }),
              ),
            )}{" "}
            {current.peak.day < today &&
              tx.sincePeak(
                <strong className="num">{date(current.peak.time)}</strong>,
                current.peak.day,
                <strong className="num">{pct(1 - current.mult.at(-1)! / current.peak.mult)}</strong>,
              )}
          </p>
        )}
        {all.length ? (
          <CyclesChart cycles={all.filter((c) => !hidden.includes(c.year))} today={today} />
        ) : (
          <p className="muted">{error ? t.charts.error : t.loading}</p>
        )}

        {all.length > 0 && (
          <div className="outlook-table-wrap">
            <table className="outlook-table cycles-table">
              <thead>
                <tr>
                  <th scope="col">{tx.cols.cycle}</th>
                  <th scope="col">{tx.cols.halvingPrice}</th>
                  <th scope="col">{tx.cols.peak}</th>
                  <th scope="col">{tx.cols.peakDay}</th>
                  <th scope="col">{tx.cols.peakMult}</th>
                  <th scope="col">{tx.cols.drawdown}</th>
                  <th scope="col">{tx.cols.atToday(today)}</th>
                </tr>
              </thead>
              <tbody>
                {all.map((c) => {
                  const m = multAt(c, today);
                  return (
                    <tr key={c.year}>
                      <th scope="row">
                        <span className={`legend cycle-${c.year}`}>{c.year}</span>
                      </th>
                      <td className="num">{usd(c.startPrice)}</td>
                      <td className="num">{date(c.peak.time)}</td>
                      <td className="num">{c.peak.day}</td>
                      <td className="num">{fmtMult(c.peak.mult)}</td>
                      <td className="num down">
                        {pct(c.drawdown)}
                        {c.current && "*"}
                      </td>
                      <td className="num">{m === null ? "—" : fmtMult(m)}</td>
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
