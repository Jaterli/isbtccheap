import { useEffect, useMemo, useState } from "react";
import { Footer } from "./components/Footer";
import { bandColor } from "./components/Gauge";
import { Header } from "./components/Header";
import { InfoTip } from "./components/InfoTip";
import { Rich } from "./components/Rich";
import { MetricSelect } from "./components/MetricSelect";
import { Momentum } from "./components/Momentum";
import { ScoreChart } from "./components/ScoreChart";
import { lang, locale, t } from "./i18n";
import { SEO_TECHNICAL } from "./i18n/seo";
import { getJson } from "./lib/data";
import { TECH_METRICS, TECH_TFS, loadTechnical, type TechKey, type TechMetric, type TechSeries, type TechTf } from "./lib/technical";
import type { Category, History } from "./types";

const KEYS: TechKey[] = ["tecnico", ...TECH_METRICS];
// Suavizado del técnico, del RSI y del %B: media de las últimas N velas (en 1D, 7 y 30 días; en el resto, las mismas velas)
const SMOOTH = ["0", "7", "30"] as const;
type Smooth = (typeof SMOOTH)[number];
const smaOf = (xs: (number | null)[], n: number) =>
  xs.map((_, i) => {
    if (i < n - 1) return null;
    const w = xs.slice(i - n + 1, i + 1);
    return w.some((v) => v === null) ? null : (w as number[]).reduce((a, b) => a + b, 0) / n;
  });
// La misma puntuación que el índice: RSI 30 o menos → 0 y 70 o más → 100; %B recortado entre 0 y 100
const clamp100 = (x: number) => Math.min(100, Math.max(0, x));
const SMOOTH_SCORE: Partial<Record<TechKey, (v: number) => number>> = { rsi_14: (v) => clamp100(((v - 30) / 40) * 100), bollinger: clamp100 };
// Columnas de la tabla: ahora, la vela anterior y 6 velas antes
const AGO = [0, 1, 6];

/** La elección guardada en el navegador (si se puede) */
function useStored<T extends string>(key: string, fallback: T, valid: readonly T[]) {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key) as T | null;
      return s && valid.includes(s) ? s : fallback;
    } catch {
      return fallback;
    }
  });
  const set = (x: T) => {
    setV(x);
    try {
      localStorage.setItem(key, x);
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  };
  return [v, set] as const;
}

function Chip({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="muted">—</span>;
  return (
    <span className="cat-chip num" style={{ background: bandColor(v) }}>
      {Math.round(v)}
    </span>
  );
}

const num = (v: number, d: number) => v.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
// Valor real de cada métrica
const FORMAT: Record<TechMetric, (v: number) => string> = {
  rsi_14: (v) => num(v, 1),
  bollinger: (v) => num(v, 0),
  ma200_ratio: (v) => {
    const p = (v - 1) * 100;
    return t.percent(`${p > 0 ? "+" : p < 0 ? "−" : ""}${num(Math.abs(p), 1)}`);
  },
};

export function TechnicalApp() {
  const [history, setHistory] = useState<History | null>(null);
  // La última serie cargada, con su temporalidad: al cambiar se sigue viendo hasta que llega la nueva
  const [loaded, setLoaded] = useState<{ tf: TechTf; s: TechSeries } | null>(null);
  const [error, setError] = useState(false);
  const [tf, setTf] = useStored<TechTf>("isbtccheap:technical-tf", "4h", TECH_TFS);
  const [k, setK] = useStored<TechKey>("isbtccheap:technical-key", "tecnico", KEYS);
  const [smooth, setSmooth] = useStored<Smooth>("isbtccheap:technical-smooth", "0", SMOOTH);
  const smoothScore = SMOOTH_SCORE[k];
  // El técnico no tiene valor propio: se suaviza su puntuación
  const smoothable = k === "tecnico" || smoothScore !== undefined;
  const smoothN = smoothable ? Number(smooth) : 0;
  const updating = loaded !== null && loaded.tf !== tf;

  useEffect(() => {
    getJson("history.json").then(setHistory, () => {});
  }, []);

  useEffect(() => {
    // El semanal se completa con el histórico diario: lo espera
    if (tf === "1w" && !history) return;
    let alive = true;
    setError(false);
    loadTechnical(tf, history).then(
      (s) => alive && setLoaded({ tf, s }),
      () => alive && setError(true),
    );
    return () => {
      alive = false;
    };
  }, [tf, tf === "1w" ? history : null]);

  const series = loaded?.s ?? null;
  const shownTf = loaded?.tf ?? tf;
  const shown = useMemo(() => {
    if (!series) return null;
    // Suavizado: la media de su valor y la puntuación de esa media
    const values = k === "tecnico" ? null : smoothN ? smaOf(series.values[k], smoothN) : series.values[k];
    const scores = !smoothN
      ? series.scores[k]
      : values && smoothScore
        ? values.map((v) => (v === null ? null : smoothScore(v)))
        : smaOf(series.scores[k], smoothN);
    const i = scores.findIndex((v) => v !== null);
    return i < 0 ? null : { time: series.time.slice(i), price: series.price.slice(i), scores: scores.slice(i), values: values ? values.slice(i) : null };
  }, [series, k, smoothN, smoothScore]);

  const last = series ? series.time.length - 1 : -1;
  // La categoría de la última vela, para la flecha de impulso (la misma que junto al score del índice)
  const current: Category | null = useMemo(
    () =>
      series && last >= 0
        ? {
            name: "Técnico",
            score: series.scores.tecnico[last],
            metrics: TECH_METRICS.map((m) => ({ id: m, name: m, value: series.values[m][last], score: series.scores[m][last] })),
          }
        : null,
    [series, last],
  );

  const tx = t.technical;
  const seo = SEO_TECHNICAL[lang];
  const label = (x: TechKey) => tx.short[x];

  return (
    <main className="container">
      <Header title={tx.title} rest={tx.rest} />

      <section className="card chart vol">
        <header>
          <h2>
            {tx.card}
            <InfoTip label={tx.card} title={tx.card}>
              {tx.info.map((p) => (
                <p key={p}>
                  <Rich text={p} />
                </p>
              ))}
            </InfoTip>
          </h2>
        </header>

        <div className="sent-controls">
          <MetricSelect value={k} onChange={(o) => setK(o as TechKey)} options={KEYS.map((o) => ({ id: o, label: label(o) }))} aria={tx.metricAria} />
          <div className="segmented small sent-tfs" role="radiogroup" aria-label={tx.tfAria}>
            {TECH_TFS.map((x) => (
              <button key={x} role="radio" aria-checked={tf === x} className={tf === x ? "active" : ""} onClick={() => setTf(x)}>
                {t.timeframes[x].short}
              </button>
            ))}
          </div>
          {smoothable && (
            <div className="segmented small" role="radiogroup" aria-label={tx.smoothAria}>
              {SMOOTH.map((n) => (
                <button key={n} role="radio" aria-checked={smooth === n} className={smooth === n ? "active" : ""} onClick={() => setSmooth(n)}>
                  {n === "0" ? tx.smoothNone : tx.smoothLabel(Number(n), shownTf)}
                </button>
              ))}
            </div>
          )}
        </div>

        {series && current && (
          <p className="vol-stats">
            {tx.current(t.timeframes[shownTf].label, <Chip v={current.score} />)}{" "}
            <Momentum rsi={current.metrics.find((m) => m.id === "rsi_14")?.value} tf={shownTf} />
          </p>
        )}
        {shown && shown.time.length > 1 ? (
          <div className={updating ? "chart-wrap updating" : "chart-wrap"} aria-busy={updating}>
            <ScoreChart
              data={shown}
              scores={shown.scores}
              tf={shownTf}
              aria={tx.chartAria}
              label={smoothN ? tx.smoothed(label(k), tx.smoothLabel(smoothN, shownTf)) : label(k)}
              // La categoría, su puntuación; cada métrica, su puntuación y su valor real
              mode={k === "tecnico" ? "score" : "both"}
              values={shown.values ?? undefined}
              format={(v) => (k === "tecnico" ? "" : FORMAT[k as TechMetric](v))}
            />
            {updating && (
              <div className="chart-updating" role="status">
                <span className="chart-spinner" aria-hidden="true" />
                {t.refresh.updating}
              </div>
            )}
          </div>
        ) : (
          <p className="muted">{error ? tx.noData : t.loading}</p>
        )}

        {series && last >= 0 && (
          <>
            <h3 className="dd-table-title">{tx.tableTitle(t.timeframes[shownTf].label)}</h3>
            <div className="outlook-table-wrap">
              <table className="outlook-table cat-table">
                <thead>
                  <tr>
                    <th scope="col">{tx.cols.metric}</th>
                    <th scope="col">{tx.cols.value}</th>
                    <th scope="col">{tx.cols.now}</th>
                    <th scope="col">{tx.cols.c1}</th>
                    <th scope="col">{tx.cols.c6}</th>
                  </tr>
                </thead>
                <tbody>
                  {KEYS.map((key) => {
                    const v = key === "tecnico" ? null : series.values[key][last];
                    return (
                      <tr key={key}>
                        <th scope="row">{tx.names[key]}</th>
                        <td className="num">{v === null ? "—" : FORMAT[key as TechMetric](v)}</td>
                        {AGO.map((a) => (
                          <td key={a}>
                            <Chip v={last - a >= 0 ? series.scores[key][last - a] : null} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted small">{tx.scoreNote}</p>
          </>
        )}
        <p className="muted small vol-note">{tx.note}</p>
      </section>

      <section className="card faq">
        <h2>{seo.sections[0].h}</h2>
        {seo.sections.map((s, i) => (
          <div key={s.h}>
            {i > 0 && <h3>{s.h}</h3>}
            <p className="muted">{s.p}</p>
          </div>
        ))}
      </section>

      <Footer />
    </main>
  );
}
