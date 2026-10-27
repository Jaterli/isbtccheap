import { useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { VolChart } from "./components/VolChart";
import { lang, locale, t } from "./i18n";
import { SEO_VOL } from "./i18n/seo";
import { fetchCandles } from "./lib/binance";
import { getJson } from "./lib/data";
import { VOL_TFS, volSeries, type VolSeries, type VolTf } from "./lib/volatility";
import type { Candle, History } from "./types";

const TF_KEY = "isbtccheap:vol-tf";
// Periodo mostrado en 1 día y 1 semana (en 1 h y 4 h se muestran todas las velas: las 1000 últimas de Binance)
const RANGES = [
  { id: "1y", days: 365 },
  { id: "4y", days: 1461 },
  { id: "all", days: Infinity },
];
const RANGE_KEY = "isbtccheap:vol-range";
// En 1 h y 4 h, cada cuánto se vuelven a pedir las velas
const REFRESH_MS = 5 * 60_000;

function load<T extends string>(key: string, valid: readonly string[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v && valid.includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible: no pasa nada */
  }
}

/** Recorta la serie a los últimos `days` días (la volatilidad ya está calculada con las velas anteriores). */
function slice(s: VolSeries, days: number): VolSeries {
  if (!Number.isFinite(days)) return s;
  const from = s.time.at(-1)! - days * 86_400_000;
  const i = Math.max(0, s.time.findIndex((x) => x >= from));
  return { time: s.time.slice(i), price: s.price.slice(i), vol: s.vol.slice(i) };
}

const pct = (v: number) => t.percent(Math.round(v * 100).toLocaleString(locale));

/** Página de volatilidad: volatilidad realizada por tamaño de vela, con el precio de BTC superpuesto. */
export function VolatilityApp() {
  const [tf, setTf] = useState<VolTf>(() => load(TF_KEY, VOL_TFS, "1d"));
  const [range, setRange] = useState<string>(() => load(RANGE_KEY, RANGES.map((r) => r.id), "4y"));
  const [history, setHistory] = useState<History | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [candles, setCandles] = useState<{ tf: VolTf; data: Candle[] } | null>(null);
  const [error, setError] = useState(false);
  const intraday = tf === "1h" || tf === "4h";

  // Histórico diario (1 día y 1 semana) y precio actual, una vez
  useEffect(() => {
    getJson("history.json").then(setHistory, () => setError(true));
    fetchCandles("1d", 1).then((c) => setLive(c.at(-1)?.close ?? null), () => {});
  }, []);

  // Velas de Binance en 1 h y 4 h, renovadas cada pocos minutos
  useEffect(() => {
    save(TF_KEY, tf);
    if (!intraday) return;
    let cancelled = false;
    const get = () =>
      fetchCandles(tf).then(
        (data) => !cancelled && (setCandles({ tf, data }), setError(false)),
        () => !cancelled && setError(true),
      );
    get();
    const id = setInterval(get, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tf, intraday]);

  const series = useMemo(() => {
    if (intraday) return candles?.tf === tf ? volSeries(tf, { candles: candles.data }) : null;
    if (!history) return null;
    return slice(volSeries(tf, { history, live }), RANGES.find((r) => r.id === range)!.days);
  }, [tf, intraday, candles, history, live, range]);

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
          <div className="chart-controls">
            <div className="segmented small" role="radiogroup" aria-label={tx.tfAria}>
              {VOL_TFS.map((x) => (
                <button key={x} role="radio" aria-checked={x === tf} className={x === tf ? "active" : ""} onClick={() => setTf(x)}>
                  {t.timeframes[x].short}
                </button>
              ))}
            </div>
            {!intraday && (
              <div className="segmented small" role="group" aria-label={tx.rangeAria}>
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    className={r.id === range ? "active" : ""}
                    onClick={() => {
                      setRange(r.id);
                      save(RANGE_KEY, r.id);
                    }}
                  >
                    {tx.ranges[r.id]}
                  </button>
                ))}
              </div>
            )}
          </div>
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
          <p className="muted">{error ? tx.error : t.loading}</p>
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
