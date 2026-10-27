import { useEffect, useMemo, useRef, useState } from "react";
import { Breakdown } from "./components/Breakdown";
import { Gauge } from "./components/Gauge";
import { HistoryChart } from "./components/HistoryChart";
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
  type ScoreResult,
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

const fmtInterval = (ms: number) => (ms < 60_000 ? `${ms / 1000} s` : ms < 3_600_000 ? `${ms / 60_000} min` : `${ms / 3_600_000} h`);

const TF_KEY = "isbtccheap:tf";
// Cada cuánto se refrescan las velas según la temporalidad
const REFRESH_MS: Record<Timeframe, number> = { "1h": 120_000, "4h": 300_000, "1d": 600_000, "1w": 1_800_000, "1M": 3_600_000 };
// El funding de Binance solo cambia cada 8 h: basta con pedirlo cada 5 min
const FUNDING_MS = 300_000;

interface LiveEntry {
  technical: Category;
  /** Sentimiento de derivados (solo en DERIVATIVES_TFS) */
  derivatives: MetricScore[] | null;
  price: number | null;
  at: number;
}

function loadTf(): Timeframe {
  try {
    const saved = localStorage.getItem(TF_KEY);
    // 15 min se quitó: quien la tenía guardada pasa a la más cercana
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
  // Datos en vivo y la temporalidad a la que pertenecen (null: Binance no respondió y se usa lo diario del pipeline)
  const [live, setLive] = useState<{ tf: Timeframe; technical: Category | null; derivatives: MetricScore[] | null } | null>(null);
  const [price, setPrice] = useState<number | null>(null);
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

  // Caché por temporalidad: al volver a una temporalidad ya cargada no se llama a la API
  // hasta que caduca su intervalo de refresco
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
        setLive({ tf, technical: cached.technical, derivatives: cached.derivatives });
        setPrice(cached.price);
        setLiveError(false);
        schedule(cached.at);
        return;
      }
      // Caché caducada: mientras se refresca se muestra la de esta temporalidad, no la de otra
      if (cached) setLive({ tf, technical: cached.technical, derivatives: cached.derivatives });
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
        const entry = { technical: technicalFromCandles(candles.value, tf), derivatives, price: candles.value.at(-1)?.close ?? null, at: now };
        cache.current.set(tf, entry);
        setLive({ tf, technical: entry.technical, derivatives });
        setPrice(entry.price);
      } else {
        setLive({ tf, technical: cached?.technical ?? null, derivatives });
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
    // En mensual el técnico usa también el histórico diario: se recalcula cuando llega
  }, [tf, tf === "1M" ? history : null]);

  const ready = live?.tf === tf;
  const computed = useMemo(
    () => (latest ? computeScore(latest, tf, ready ? live.technical : null, funding, ready ? live.derivatives : null) : null),
    [latest, tf, live, ready, funding],
  );
  // Hasta tener el técnico de la nueva temporalidad se mantiene el último score: si no, saltaría a un valor
  // calculado con el técnico de otra temporalidad o con el diario. En la primera carga no hay anterior: "—"
  const lastReady = useRef<ScoreResult | null>(null);
  if (ready && computed) lastReady.current = computed;
  const shown = ready ? computed : lastReady.current;

  if (error) return <main className="container"><p className="notice">{error}</p></main>;
  if (!latest || !computed) return <main className="container"><p className="muted">{t.loading}</p></main>;

  const result = shown ?? computed;
  const score = shown ? shown.score : null;
  const li = score === null ? -1 : labelIndex(score, latest.labels);
  const label = !shown ? t.loading : li === -1 ? t.noData : labelAt(li, latest.labels[li].label);
  const shownPrice = price ?? latest.price;

  return (
    <main className="container">
      <Header title={t.taglineTitle} rest={t.taglineRest} />

      <section className="dashboard">
        <article className="hero card">
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
          <Gauge
            score={score}
            label={label}
            info={
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
            }
          />
          {/* Precio y próxima actualización en una sola línea (en pantallas estrechas pasa a dos) */}
          <div className="hero-meta">
            <span className="price num">
              BTC {shownPrice.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
              <InfoTip label={t.priceInfo.label} title={t.priceInfo.title}>
                <p>{t.priceInfo.body}</p>
              </InfoTip>
            </span>
            <RefreshStatus
              nextAt={nextAt}
              loading={loading}
              info={
                <InfoTip label={t.refresh.infoLabel} title={t.refresh.infoTitle}>
                  <p>{t.refresh.info1(fmtInterval(REFRESH_MS[tf]))}</p>
                  <p>{t.refresh.info2}</p>
                </InfoTip>
              }
            />
          </div>
          {liveError && <p className="notice">{t.liveError}</p>}
        </article>

        <Breakdown categories={result.categories} weights={result.weights} live={!!shown} />

        {/* Columna de contexto: agenda y noticias. Si ninguna tiene datos queda vacía y no ocupa sitio (:empty) */}
        <div className="side">
          <News />
          <Calendar />
        </div>
      </section>

      {history && <HistoryChart history={history} />}

      {history && <Outlook history={history} labels={latest.labels} />}

      {/* Las caídas y subidas por tamaño están en la página de caídas, junto a la caída desde máximos */}
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
