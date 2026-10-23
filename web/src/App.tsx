import { useEffect, useMemo, useRef, useState } from "react";
import { Breakdown } from "./components/Breakdown";
import { Gauge } from "./components/Gauge";
import { HistoryChart } from "./components/HistoryChart";
import { RefreshStatus } from "./components/RefreshStatus";
import { TimeframeSelector } from "./components/TimeframeSelector";
import { fetchCandles, fetchFundingRate } from "./lib/binance";
import { computeScore, labelFor, technicalFromCandles, type ScoreResult } from "./lib/score";
import { Donate } from "./components/Donate";
import { InfoTip } from "./components/InfoTip";
import { Outlook } from "./components/Outlook";
import { TIMEFRAMES, type Category, type CategoryId, type History, type Latest, type Timeframe } from "./types";

const fmtInterval = (ms: number) => (ms < 60_000 ? `${ms / 1000} s` : `${ms / 60_000} min`);

const DATA = import.meta.env.VITE_DATA_URL ?? `${import.meta.env.BASE_URL}data`;
const TF_KEY = "isbtccheap:tf";
// Cada cuánto se refrescan las velas según la temporalidad
const REFRESH_MS: Record<Timeframe, number> = { "15m": 60_000, "1h": 120_000, "4h": 300_000, "1d": 600_000, "1w": 1_800_000 };
// El funding de Binance solo cambia cada 8 h: basta con pedirlo cada 5 min
const FUNDING_MS = 300_000;

interface LiveEntry {
  technical: Category;
  price: number | null;
  at: number;
}

function loadTf(): Timeframe {
  try {
    return (localStorage.getItem(TF_KEY) as Timeframe) || "1d";
  } catch {
    return "1d";
  }
}

const getJson = (path: string) => fetch(`${DATA}/${path}`, { cache: "no-cache" }).then((r) => r.json());

export function App() {
  const [tf, setTf] = useState<Timeframe>(loadTf);
  const [latest, setLatest] = useState<Latest | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  // Técnico en vivo y la temporalidad a la que pertenece (technical null: Binance no respondió y se usa el diario)
  const [live, setLive] = useState<{ tf: Timeframe; technical: Category | null } | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [funding, setFunding] = useState<number | null>(null);
  const [liveError, setLiveError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // refreshKey cambia al pulsar "Actualizar": relanza la carga y reinicia el contador
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [nextAt, setNextAt] = useState(0);

  useEffect(() => {
    Promise.all([getJson("latest.json"), getJson("history.json")])
      .then(([l, h]) => {
        setLatest(l);
        setHistory(h);
      })
      .catch(() => setError("No se pudieron cargar los datos diarios. Ejecuta el pipeline (python pipeline/build.py)."));
  }, [refreshKey]);

  // Caché por temporalidad: al volver a una temporalidad ya cargada no se llama a la API
  // hasta que caduca su intervalo de refresco
  const cache = useRef(new Map<Timeframe, LiveEntry>());
  const fundingCache = useRef<{ value: number; at: number } | null>(null);
  const lastRefreshKey = useRef(refreshKey);

  useEffect(() => {
    try {
      localStorage.setItem(TF_KEY, tf);
    } catch {
      /* almacenamiento no disponible: no pasa nada */
    }
    const ms = REFRESH_MS[tf];
    const forced = lastRefreshKey.current !== refreshKey; // botón de actualizar
    lastRefreshKey.current = refreshKey;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = (fetchedAt: number) => {
      setNextAt(fetchedAt + ms);
      timer = setTimeout(() => load(false), Math.max(0, fetchedAt + ms - Date.now()));
    };

    const load = async (force: boolean) => {
      const cached = cache.current.get(tf);
      if (!force && cached && Date.now() - cached.at < ms) {
        setLive({ tf, technical: cached.technical });
        setPrice(cached.price);
        setLiveError(false);
        schedule(cached.at);
        return;
      }
      // Caché caducada: mientras se refresca se muestra la de esta temporalidad, no la de otra
      if (cached) setLive({ tf, technical: cached.technical });
      setLoading(true);
      const f = fundingCache.current;
      const needFunding = force || !f || Date.now() - f.at > FUNDING_MS;
      const [candles, fr] = await Promise.allSettled([
        fetchCandles(tf),
        needFunding ? fetchFundingRate() : Promise.resolve(f!.value),
      ]);
      if (cancelled) return;
      const now = Date.now();
      if (candles.status === "fulfilled") {
        const entry = { technical: technicalFromCandles(candles.value), price: candles.value.at(-1)?.close ?? null, at: now };
        cache.current.set(tf, entry);
        setLive({ tf, technical: entry.technical });
        setPrice(entry.price);
      } else {
        setLive({ tf, technical: cached?.technical ?? null });
      }
      if (fr.status === "fulfilled") {
        if (needFunding) fundingCache.current = { value: fr.value, at: now };
        setFunding(fr.value);
      }
      setLiveError(candles.status === "rejected");
      setLoading(false);
      schedule(now);
    };

    load(forced);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tf, refreshKey]);

  const ready = live?.tf === tf;
  const computed = useMemo(
    () => (latest ? computeScore(latest, tf, ready ? live.technical : null, funding) : null),
    [latest, tf, live, ready, funding],
  );
  // Hasta tener el técnico de la nueva temporalidad se mantiene el último score: si no, saltaría a un valor
  // calculado con el técnico de otra temporalidad o con el diario. En la primera carga no hay anterior: "—"
  const lastReady = useRef<ScoreResult | null>(null);
  if (ready && computed) lastReady.current = computed;
  const shown = ready ? computed : lastReady.current;

  if (error) return <main className="container"><p className="notice">{error}</p></main>;
  if (!latest || !computed) return <main className="container"><p className="muted">Cargando…</p></main>;

  const result = shown ?? computed;
  const score = shown ? shown.score : null;
  const label = !shown ? "Cargando…" : score === null ? "Sin datos" : labelFor(score, latest.labels);
  const shownPrice = price ?? latest.price;

  return (
    <main className="container">
      <header className="top">
        <h1 className="brand">
          <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Is BTC Cheap?" width="320" height="320" />
        </h1>
        <p className="muted">¿Está Bitcoin barato o caro? Un índice de 1 a 100 que combina valoración on-chain, ciclos, liquidez, sentimiento y análisis técnico.</p>
      </header>

      <section className="dashboard">
        <article className="hero card">
          <div className="hero-top">
            <TimeframeSelector value={tf} onChange={setTf} />
            <InfoTip label="la temporalidad" title="Temporalidad">
              <p>Elige el horizonte del análisis. El técnico se calcula con velas de esa temporalidad y los pesos de cada categoría cambian: en las cortas pesa más el técnico y el sentimiento; en las largas, la valoración y el ciclo.</p>
              <p className="muted">
                Pesos en {TIMEFRAMES.find((t) => t.id === tf)?.label}:{" "}
                {Object.entries(latest.weights[tf]).map(([id, w]) => `${latest.categories[id as CategoryId].name} ${w} %`).join(" · ")}
              </p>
            </InfoTip>
          </div>
          <Gauge
            score={score}
            label={label}
            info={
              <InfoTip label="el score" title="Score">
                <p>Índice de 1 a 100 que estima si Bitcoin está barato o caro. Es la media ponderada de las cinco categorías de abajo, estirada para que los extremos sean alcanzables; cada métrica se puntúa según su percentil histórico.</p>
                <ul className="info-list">
                  {latest.labels.map((l, i) => (
                    <li key={l.label}>
                      <span className="swatch" style={{ background: `var(--band-${i + 1})` }} />
                      {i === 0 ? 1 : latest.labels[i - 1].max + 1}–{l.max}: {l.label}
                    </li>
                  ))}
                </ul>
                <p className="muted">Es una referencia informativa, no una recomendación de inversión.</p>
              </InfoTip>
            }
          />
          <p className="price num">
            BTC {shownPrice.toLocaleString("es-ES", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
            <InfoTip label="el precio" title="Precio">
              <p>Último precio de BTC/USDT en Binance, tomado del cierre de la vela más reciente. Si Binance no está disponible, se muestra el precio diario de Coin Metrics.</p>
            </InfoTip>
          </p>
          <RefreshStatus
            nextAt={nextAt}
            loading={loading}
            onRefresh={() => setRefreshKey((k) => k + 1)}
            info={
              <InfoTip label="la actualización" title="Actualización">
                <p>El técnico y el funding se actualizan solos cada {fmtInterval(REFRESH_MS[tf])} en esta temporalidad. Al cambiar de temporalidad se reutilizan los datos ya descargados mientras sigan vigentes.</p>
                <p>Las métricas on-chain, de ciclo y de liquidez se recalculan una vez al día. El botón ↻ fuerza la recarga de todo.</p>
              </InfoTip>
            }
          />
          {liveError && <p className="notice">Sin conexión con Binance: se usan los datos técnicos diarios.</p>}
        </article>

        <Breakdown categories={result.categories} weights={result.weights} />
      </section>

      {history && <HistoryChart history={history} />}

      {history && <Outlook history={history} labels={latest.labels} />}

      <Donate />

      <footer className="muted small">
        <p>
          Datos on-chain, de ciclo y de liquidez a {latest.as_of} (se recalculan una vez al día; última ejecución{" "}
          {new Date(latest.updated_at).toLocaleString("es-ES")}).
          {latest.missing_sources.length > 0 && ` Fuentes no disponibles hoy: ${latest.missing_sources.join(", ")}.`}
        </p>
        <p>
          Fuentes:{" "}
          {latest.attribution.map((a, i) => (
            <span key={a.name}>
              {i > 0 && " · "}
              <a href={a.url} target="_blank" rel="noreferrer">{a.name}</a>
              {a.license && ` (${a.license})`}
            </span>
          ))}
        </p>
        <p>Este indicador es informativo y no constituye asesoramiento financiero.</p>
        <p className="credit">
          Desarrollado por <a href="https://jaterli.com" target="_blank" rel="noreferrer">Jaterli</a>
        </p>
      </footer>
    </main>
  );
}
