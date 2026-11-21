import { Fragment, useEffect, useState } from "react";
import { locale, t } from "../i18n";
import { getJson } from "../lib/data";
import { InfoTip } from "./InfoTip";
import { Rich } from "./Rich";

/** capitulation.json del pipeline (metrics.capitulation_json): la misma regla que el análisis de IA */
interface CapitulationJson {
  date: string;
  level: "none" | "capitulation_levels" | "intense_capitulation";
  sth_loss_pct: number | null;
  sth_mvrv_adj: number | null;
  sth_mvrv_sigma: number | null;
  sth_realized_loss_ratio: number | null;
  sth_realized_loss_usd_bn: number | null;
  sth_realized_loss_usd_pct_4y: number | null;
  sth_sopr_24h: number | null;
  fear_greed: number | null;
  /** El último episodio (días seguidos) en niveles de capitulación, con su nivel más alto y su mayor pérdida frente a la media */
  last?: { from: string; to: string; level: "capitulation_levels" | "intense_capitulation"; max_ratio: number } | null;
  thresholds: { realized_loss_ratio: number; sopr: number; intense_sopr: number; sth_loss_pct: number; sth_mvrv_sigma: number; fear_greed: number };
  /** Pánico en la bolsa (metrics.vix_json): el último cierre del VIX y los episodios anteriores con lo que hizo BTC */
  vix?: VixJson | null;
}

interface VixContext {
  kind: "spike" | "sustained";
  tightening: boolean;
}
interface VixEpisode extends VixContext {
  start: string;
  vix: number;
  peak: number;
  extreme: boolean;
  /** Lo que hizo BTC desde el primer día (null mientras no ha pasado el plazo) */
  btc_90d: number | null;
  btc_180d: number | null;
  btc_max_drop_90d: number | null;
}
interface VixJson {
  date: string;
  close: number;
  level: "none" | "high" | "extreme";
  context?: VixContext;
  thresholds: { high: number; extreme: number };
  episodes: VixEpisode[];
}

const num = (v: number, d: number) => v.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v: number, d: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v), d)}`;

/**
 * Tarjeta de la página de sentimiento: ¿están capitulando los compradores recientes? Tres preguntas en orden (cuántos
 * pierden, si venden con pérdidas y si hay pánico) con sus datos de hoy y su umbral, y el nivel con la misma regla que el
 * análisis de IA. Informativa: el índice no la usa.
 */
export function CapitulationCard() {
  const [c, setC] = useState<CapitulationJson | null>(null);
  useEffect(() => {
    getJson("capitulation.json").then(setC, () => {});
  }, []);
  if (!c) return null;
  const tx = t.capitulation;
  const th = c.thresholds;
  const date = new Date(`${c.date}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", timeZone: "UTC" });
  // Fechas del último episodio: con el año si no es el de los datos
  const short = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", ...(d.slice(0, 4) !== c.date.slice(0, 4) && { year: "numeric" }), timeZone: "UTC" });
  const last = c.level === "none" && c.last ? c.last : null;
  // Cada fila: la pregunta a la que responde, el dato de hoy, el umbral y si lo cumple (null: sin dato)
  const rows: { q: string; name: string; value: string; threshold: string; met: boolean | null }[] = [
    {
      q: tx.questions.stress,
      name: tx.metrics.sthLoss,
      value: c.sth_loss_pct === null ? "—" : t.percent(num(c.sth_loss_pct, 1)),
      threshold: tx.over(t.percent(String(th.sth_loss_pct))),
      met: c.sth_loss_pct === null ? null : c.sth_loss_pct > th.sth_loss_pct,
    },
    {
      q: tx.questions.stress,
      name: tx.metrics.mvrv,
      value: c.sth_mvrv_adj === null ? "—" : `${signed(c.sth_mvrv_adj, 3)}${c.sth_mvrv_sigma === null ? "" : ` (${signed(c.sth_mvrv_sigma, 1)}σ)`}`,
      threshold: tx.under(`${signed(th.sth_mvrv_sigma, 0)}σ`),
      met: c.sth_mvrv_sigma === null ? null : c.sth_mvrv_sigma < th.sth_mvrv_sigma,
    },
    {
      q: tx.questions.selling,
      name: tx.metrics.realizedLoss,
      value: c.sth_realized_loss_ratio === null ? "—" : `×${num(c.sth_realized_loss_ratio, 1)}`,
      threshold: tx.atLeast(`×${th.realized_loss_ratio}`),
      met: c.sth_realized_loss_ratio === null ? null : c.sth_realized_loss_ratio >= th.realized_loss_ratio,
    },
    {
      q: tx.questions.selling,
      name: tx.metrics.sopr,
      value: c.sth_sopr_24h === null ? "—" : num(c.sth_sopr_24h, 3),
      threshold: tx.soprThreshold(num(th.sopr, 0), num(th.intense_sopr, 2)),
      met: c.sth_sopr_24h === null ? null : c.sth_sopr_24h < th.sopr,
    },
    {
      q: tx.questions.panic,
      name: tx.metrics.fearGreed,
      value: c.fear_greed === null ? "—" : num(c.fear_greed, 0),
      threshold: tx.under(String(th.fear_greed)),
      met: c.fear_greed === null ? null : c.fear_greed < th.fear_greed,
    },
    ...(c.vix
      ? [
          {
            q: tx.questions.stockPanic,
            name: tx.metrics.vix,
            value: num(c.vix.close, 1),
            threshold: tx.vix.threshold(String(c.vix.thresholds.high), String(c.vix.thresholds.extreme)),
            met: c.vix.level !== "none",
          },
        ]
      : []),
  ];
  // Con el VIX por encima del umbral: cómo es el pánico y los precedentes parecidos (mismo tipo y mismo contexto de tipos),
  // ya cerrados; la lista crece sola con cada episodio nuevo
  const vix = c.vix;
  const ctx = vix?.level !== "none" ? vix?.context : undefined;
  const precedents = ctx ? (vix?.episodes ?? []).filter((e) => e.kind === ctx.kind && e.tightening === ctx.tightening && e.btc_90d !== null) : [];
  const monthYear = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" });
  const pctOf = (v: number | null) => (v === null ? "—" : `${signed(v * 100, 0)}\u00A0%`);
  return (
    <section className="card capitulation">
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
      <p className="cap-level">
        <span className={`cap-badge ${c.level}`}>{tx.levels[c.level]}</span>
        <span className="muted small">{tx.asOf(date)}</span>
      </p>
      <p>{tx.reading[c.level](c.sth_realized_loss_usd_pct_4y ?? 0)}</p>
      {/* Sin capitulación hoy: la última, para que no se pierda la de ayer */}
      {last && (
        <p className="cap-last small">
          {tx.last(
            last.from === last.to ? short(last.to) : `${short(last.from)} – ${short(last.to)}`,
            <span className={`cap-badge small ${last.level}`}>{tx.levels[last.level]}</span>,
            `×${num(last.max_ratio, 1)}`,
          )}
        </p>
      )}
      <div className="outlook-table-wrap">
        <table className="outlook-table cap-table">
          <thead>
            <tr>
              <th scope="col">{tx.cols.metric}</th>
              <th scope="col">{tx.cols.now}</th>
              <th scope="col" className="cap-th">{tx.cols.threshold}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <Fragment key={r.name}>
                {/* Cada pregunta, título de su grupo de filas */}
                {(i === 0 || rows[i - 1].q !== r.q) && (
                  <tr className="cap-group">
                    <th scope="rowgroup" colSpan={3}>
                      {r.q}
                    </th>
                  </tr>
                )}
                <tr>
                  <th scope="row">
                    {r.name}
                    {/* En pantallas estrechas, el umbral va aquí y no en su columna */}
                    <span className="cap-th-inline muted">
                      {tx.cols.threshold}: {r.threshold}
                    </span>
                  </th>
                  <td className={r.met ? "num cap-met" : "num"}>
                    {r.value}
                    {r.met && <span className="cap-check" aria-label={tx.met}> ●</span>}
                  </td>
                  <td className="num muted cap-th">{r.threshold}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {vix && ctx && (
        <div className="cap-vix">
          <p>
            <strong>{tx.vix.intro(ctx.kind, vix.level === "extreme", ctx.tightening, num(vix.close, 1), short(vix.date))}</strong>{" "}
            {precedents.length ? tx.vix.precedents : tx.vix.noPrecedents}
          </p>
          {precedents.length > 0 && (
            <ul className="cap-vix-list">
              {precedents.map((e) => (
                <li key={e.start}>
                  {tx.vix.episode(monthYear(e.start), num(e.peak, 0), pctOf(e.btc_90d), pctOf(e.btc_180d), e.btc_max_drop_90d === null ? null : pctOf(e.btc_max_drop_90d))}
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">{tx.vix.caveat}</p>
        </div>
      )}
      <p className="muted small vol-note">{tx.note}</p>
    </section>
  );
}
