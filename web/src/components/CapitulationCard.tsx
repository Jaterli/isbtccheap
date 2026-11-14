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
  thresholds: { realized_loss_ratio: number; sopr: number; intense_sopr: number; sth_loss_pct: number; sth_mvrv_sigma: number; fear_greed: number };
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
  ];
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
      <p className="muted small vol-note">{tx.note}</p>
    </section>
  );
}
