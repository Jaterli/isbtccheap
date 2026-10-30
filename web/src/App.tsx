import { useEffect, useMemo, useRef, useState } from "react";
import { Breakdown } from "./components/Breakdown";
import { bandColor, Gauge } from "./components/Gauge";
import { HistoryChart } from "./components/HistoryChart";
import { PriceCard, type Closes } from "./components/PriceCard";
import { RefreshStatus } from "./components/RefreshStatus";
import { TimeframeSelector } from "./components/TimeframeSelector";
import { fetchCandles, fetchDerivatives, fetchFundingRate } from "./lib/binance";
import {
  computeScore,
  DERIVATIVES_TFS,
  derivativesMetrics,
  labelIndex,
  technicalFromCandles,
  withMonthlyHistory,
} from "./lib/score";
import { labelAt, lang, locale, PAGE_PATH, t } from "./i18n";
import { Header } from "./components/Header";
import { getJson } from "./lib/data";
import { Donate } from "./components/Donate";
import { InfoTip } from "./components/InfoTip";
import { Faq } from "./components/Faq";
import { News } from "./components/News";
import { Calendar } from "./components/Calendar";
import { Outlook } from "./components/Outlook";
import { TIMEFRAMES, type Category, type CategoryId, type History, type Latest, type MetricScore, type Timeframe } from "./types";


const TF_KEY = "isbtccheap:tf";
const REFRESH_MS: Record<Timeframe, number> = { "1h": 120_000, "4h": 300_000, "1d": 600_000, "1w": 1_800_000, "1M": 3_600_000 };
// El funding solo cambia cada 8 h
const FUNDING_MS = 300_000;

interface LiveEntry {
  technical: Category;
  derivatives: MetricScore[] | null;
  price: number | null;
  /** Cierre de la vela anterior: la variación se mide desde ahí */
  prevClose: number | null;
  closes: Closes;
  at: number;
}

function loadTf(): Timeframe {
  try {
    const saved = localStorage.getItem(TF_KEY);
    // Temporalidad retirada que pudiera estar guardada: pasa a la más cercana
    if (saved === "15m") return "1h";
    return TIMEFRAMES.includes(saved as Timeframe) ? (saved as Timeframe) : "1d";
  } catch {
    return "1d";
  }
}


export function App() {
  const [tf, setTf] = useState<Timeframe>(loadTf);
  const [latest, setLatest] = useState<Latest | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  // null: Binance no respondió y se usa lo diario del pipeline
  const [live, setLive] = useState<{ tf: Timeframe; technical: Category | null; derivatives: MetricScore[] | null; closes: Closes | null } | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [prevClose, setPrevClose] = useState<number | null>(null);
  const [funding, setFunding] = useState<number | null>(null);
  const [liveError, setLiveError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextAt, setNextAt] = useState(0);

  useEffect(() => {
    Promise.all([getJson("latest.json"), getJson("history.json")])
      .then(([l, h]) => {
        setLatest(l);
        setHistory(h);
      })
      .catch(() => setError(t.dataError));
  }, []);

  // Caché por temporalidad: no se vuelve a llamar a la API hasta que caduca su intervalo de refresco
  const cache = useRef(new Map<Timeframe, LiveEntry>());
  const fundingCache = useRef<{ value: number; at: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(TF_KEY, tf);
    } catch {
      /* almacenamiento no disponible: no pasa nada */
    }
    const ms = REFRESH_MS[tf];
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = (fetchedAt: number) => {
      setNextAt(fetchedAt + ms);
      timer = setTimeout(load, Math.max(0, fetchedAt + ms - Date.now()));
    };

    const load = async () => {
      const cached = cache.current.get(tf);
      if (cached && Date.now() - cached.at < ms) {
        setLive({ tf, technical: cached.technical, derivatives: cached.derivatives, closes: cached.closes });
        setPrice(cached.price);
        setPrevClose(cached.prevClose);
        setLiveError(false);
        schedule(cached.at);
        return;
      }
      // Mientras se refresca se muestra la caché de esta temporalidad, no la de otra
      if (cached) setLive({ tf, technical: cached.technical, derivatives: cached.derivatives, closes: cached.closes });
      // Hasta tener velas de esta temporalidad no se muestra la variación de otra
      else setPrevClose(null);
      setLoading(true);
      const f = fundingCache.current;
      const needFunding = !f || Date.now() - f.at > FUNDING_MS;
      const [candles, fr, derivs] = await Promise.allSettled([
        tf === "1M" ? fetchCandles(tf).then((c) => withMonthlyHistory(c, history)) : fetchCandles(tf),
        needFunding ? fetchFundingRate() : Promise.resolve(f!.value),
        DERIVATIVES_TFS.includes(tf) ? fetchDerivatives(tf).then(derivativesMetrics) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      const now = Date.now();
      const derivatives = derivs.status === "fulfilled" ? derivs.value : (cached?.derivatives ?? null);
      if (candles.status === "fulfilled") {
        const entry = {
          technical: technicalFromCandles(candles.value, tf),
          derivatives,
          price: candles.value.at(-1)?.close ?? null,
          prevClose: candles.value.at(-2)?.close ?? null,
          closes: { time: candles.value.map((c) => c.time), close: candles.value.map((c) => c.close) },
          at: now,
        };
        cache.current.set(tf, entry);
        setLive({ tf, technical: entry.technical, derivatives, closes: entry.closes });
        setPrice(entry.price);
        setPrevClose(entry.prevClose);
      } else {
        setLive({ tf, technical: cached?.technical ?? null, derivatives, closes: cached?.closes ?? null });
      }
      if (fr.status === "fulfilled") {
        if (needFunding) fundingCache.current = { value: fr.value, at: now };
        setFunding(fr.value);
      }
      setLiveError(candles.status === "rejected");
      setLoading(false);
      schedule(now);
    };

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tf, tf === "1M" ? history : null]);

  // Datos en vivo de esta temporalidad: los ya aplicados o, recién seleccionada, los de la caché. Sin ninguno, el score
  // muestra "—" hasta que lleguen (con los de otra temporalidad o los diarios daría un valor que luego salta)
  const cachedTf = cache.current.get(tf);
  const liveTf = live?.tf === tf ? live : cachedTf ?? null;
  const ready = liveTf !== null;
  const computed = useMemo(
    () => (latest ? computeScore(latest, tf, liveTf?.technical ?? null, funding, liveTf?.derivatives ?? null) : null),
    [latest, tf, liveTf, funding],
  );
  const shown = ready ? computed : null;

  if (error) return <main className="container"><p className="notice">{error}</p></main>;
  if (!latest || !computed) return <main className="container"><p className="muted">{t.loading}</p></main>;

  const result = shown ?? computed;
  const score = shown ? shown.score : null;
  const li = score === null ? -1 : labelIndex(score, latest.labels);
  const label = !shown ? t.loading : li === -1 ? t.noData : labelAt(li, latest.labels[li].label);
  const shownPrice = price ?? latest.price;
  const change = price !== null && prevClose ? price / prevClose - 1 : null;

  return (
    <main className="container">
      <Header title={t.taglineTitle} rest={t.taglineRest} />

      <section className="dashboard">
        <article className="hero card">
          {/* En la esquina: no suma alto a la tarjeta */}
          <RefreshStatus nextAt={nextAt} loading={loading} />
          <Gauge score={score} label={label} />
        </article>

        <article className="card status">
          <div className="hero-top">
            <TimeframeSelector value={tf} onChange={setTf} />
            <InfoTip label={t.timeframeInfo.label} title={t.timeframeInfo.title}>
              <p>{t.timeframeInfo.body}</p>
              <p className="muted">
                {t.timeframeInfo.weightsIn(t.timeframes[tf].label)}{" "}
                {Object.entries(latest.weights[tf] ?? latest.weights["1w"]).map(([id, w]) => `${t.categories[id as CategoryId].name} ${t.percent(String(w))}`).join(" · ")}
              </p>
            </InfoTip>
          </div>
          <div className="status-block">
            <span className="status-caption">{t.status.now}</span>
            <div className="status-label" style={score === null ? undefined : { color: bandColor(score) }}>
              {label}
              <InfoTip label={t.scoreInfo.label} title={t.scoreInfo.title}>
                <p>{t.scoreInfo.body}</p>
                <ul className="info-list">
                  {latest.labels.map((l, i) => (
                    <li key={l.label}>
                      <span className="swatch" style={{ background: `var(--band-${i + 1})` }} />
                      {i === 0 ? 1 : latest.labels[i - 1].max + 1}–{l.max}: {labelAt(i, l.label)}
                    </li>
                  ))}
                </ul>
                <p className="muted">{t.scoreInfo.disclaimer}</p>
              </InfoTip>
            </div>
          </div>
          <div className="status-block">
            <span className="status-caption">
              {t.status.price}
              <InfoTip label={t.priceInfo.label} title={t.priceInfo.title}>
                <p>{t.priceInfo.body}</p>
                <p>{t.priceInfo.changeInfo}</p>
              </InfoTip>
            </span>
            <div className="status-price num">
              {shownPrice.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
              {change !== null && (
                <span className={change > 0 ? "status-change up" : change < 0 ? "status-change down" : "status-change"}>
                  {change > 0 ? "+" : change < 0 ? "−" : ""}
                  {t.percent(Math.abs(change * 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                </span>
              )}
              {change !== null && <span className="status-sub muted">{t.status.candle(t.timeframes[tf].label)}</span>}
            </div>
          </div>
          {liveError && <p className="notice">{t.liveError}</p>}
        </article>

        <PriceCard tf={tf} data={liveTf?.closes ?? null} />

        <Breakdown categories={result.categories} weights={result.weights} live={!!shown} />

        {/* Si ni noticias ni agenda tienen datos queda vacía y no ocupa sitio (:empty) */}
        <div className="side">
          <News />
          <Calendar />
        </div>
      </section>

      {history && <HistoryChart history={history} latest={latest} />}

      {history && <Outlook history={history} labels={latest.labels} />}

      <a className="card page-link" href={PAGE_PATH.drawdown[lang]}>
        <span>{t.movesLink.text}</span>
        <strong>{t.movesLink.cta} →</strong>
      </a>

      <Faq />

      <Donate />

      <footer className="muted small">
        <p>
          {t.footer.dataAsOf(latest.as_of, new Date(latest.updated_at).toLocaleString(locale))}
          {latest.missing_sources.length > 0 && t.footer.missing(latest.missing_sources.join(", "))}
        </p>
        <p>
          {t.footer.sources}{" "}
          {latest.attribution.map((a, i) => (
            <span key={a.name}>
              {i > 0 && " · "}
              <a href={a.url} target="_blank" rel="noreferrer">{t.footer.attribution[a.url] ?? a.name}</a>
              {a.license && ` (${a.license})`}
            </span>
          ))}
        </p>
        <p>{t.footer.disclaimer}</p>
        <p className="credit">
          {t.footer.credit} <a href="https://jaterli.com" target="_blank" rel="noreferrer">Jaterli</a>
        </p>
      </footer>
    </main>
  );
}
