import { useEffect, useMemo, useState } from "react";
import { Breakdown } from "./components/Breakdown";
import { Gauge } from "./components/Gauge";
import { HistoryChart } from "./components/HistoryChart";
import { RefreshStatus } from "./components/RefreshStatus";
import { TimeframeSelector } from "./components/TimeframeSelector";
import { fetchCandles, fetchFundingRate } from "./lib/binance";
import { computeScore, labelFor, technicalFromCandles } from "./lib/score";
import type { Category, History, Latest, Timeframe } from "./types";

const DATA = `${import.meta.env.BASE_URL}data`;
const TF_KEY = "satoshi-score:tf";
// Cada cuánto se refrescan las velas según la temporalidad
const REFRESH_MS: Record<Timeframe, number> = { "15m": 30_000, "1h": 60_000, "4h": 120_000, "1d": 300_000, "1w": 600_000 };

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
  const [technical, setTechnical] = useState<Category | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [funding, setFunding] = useState<number | null>(null);
  const [liveError, setLiveError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // refreshKey cambia al pulsar "Actualizar": relanza la carga y reinicia el contador
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [nextAt, setNextAt] = useState(0);
  const [liveAt, setLiveAt] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getJson("latest.json"), getJson("history.json")])
      .then(([l, h]) => {
        setLatest(l);
        setHistory(h);
      })
      .catch(() => setError("No se pudieron cargar los datos diarios. Ejecuta el pipeline (python pipeline/build.py)."));
  }, [refreshKey]);

  // Al cambiar de temporalidad, el técnico anterior ya no vale
  useEffect(() => setTechnical(null), [tf]);

  useEffect(() => {
    try {
      localStorage.setItem(TF_KEY, tf);
    } catch {
      /* almacenamiento no disponible: no pasa nada */
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      setLoading(true);
      const [candles, fr] = await Promise.allSettled([fetchCandles(tf), fetchFundingRate()]);
      if (cancelled) return;
      if (candles.status === "fulfilled") {
        setTechnical(technicalFromCandles(candles.value));
        setPrice(candles.value.at(-1)?.close ?? null);
      }
      if (fr.status === "fulfilled") setFunding(fr.value);
      setLiveError(candles.status === "rejected");
      setLoading(false);
      setLiveAt(Date.now());
      setNextAt(Date.now() + REFRESH_MS[tf]);
      timer = setTimeout(load, REFRESH_MS[tf]);
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tf, refreshKey]);

  const result = useMemo(() => (latest ? computeScore(latest, tf, technical, funding) : null), [latest, tf, technical, funding]);

  if (error) return <main className="container"><p className="notice">{error}</p></main>;
  if (!latest || !result) return <main className="container"><p className="muted">Cargando…</p></main>;

  const label = result.score === null ? "Sin datos" : labelFor(result.score, latest.labels);
  const shownPrice = price ?? latest.price;

  return (
    <main className="container">
      <header className="top">
        <h1>Satoshi Score</h1>
        <p className="muted">¿Está Bitcoin barato o caro? Un índice de 1 a 100 que combina valoración on-chain, ciclos, liquidez, sentimiento y análisis técnico.</p>
      </header>

      <section className="dashboard">
        <article className="hero card">
          <TimeframeSelector value={tf} onChange={setTf} />
          <Gauge score={result.score} label={label} />
          <p className="price num">
            BTC {shownPrice.toLocaleString("es-ES", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
          </p>
          <RefreshStatus
            nextAt={nextAt}
            intervalMs={REFRESH_MS[tf]}
            updatedAt={liveAt}
            loading={loading}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />
          {liveError && <p className="notice">Sin conexión con Binance: se usan los datos técnicos diarios.</p>}
        </article>

        <Breakdown categories={result.categories} weights={result.weights} />
      </section>

      {history && <HistoryChart history={history} />}

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
          Desarrollado por <a href="https://jaterli.com" target="_blank" rel="noreferrer">Jaterli (jaterli.com)</a>
        </p>
      </footer>
    </main>
  );
}
