import { useEffect, useState, type ReactNode } from "react";
import { lang, locale, PAGE_PATH, t } from "../i18n";
import { cascadeRisk, LONGS_MIN, type CascadeRisk } from "../lib/cascade";
import { getJson } from "../lib/data";
import type { Timeframe } from "../types";
import { CascadeIcon } from "./CascadeIcon";
import { InfoTip } from "./InfoTip";
import { momentumDir } from "./Momentum";
import { Rich } from "./Rich";

type CapLevel = "none" | "capitulation_levels" | "intense_capitulation";
interface Capitulation {
  level?: CapLevel;
  sth_realized_loss_ratio?: number | null;
  sth_sopr_24h?: number | null;
}

interface Props {
  /** RSI 14 en vivo de la temporalidad del score (null hasta tenerlo) */
  rsi: number | null | undefined;
  tf: Timeframe;
  live: boolean;
}

interface Alert {
  id: string;
  icon: ReactNode;
  tone: string;
  title: string;
  text: string;
  href: string;
  link: string;
}

const OPEN_KEY = "isbtccheap:alerts-open";

/** Plegada o desplegada, recordado en el navegador (si se puede); plegada por defecto: el resumen de la cabecera ya
 * dice cuántas hay y muestra sus iconos */
function useOpen() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem(OPEN_KEY, v ? "0" : "1");
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
      return !v;
    });
  return [open, toggle] as const;
}

const num = (v: number, d: number) => v.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Los avisos informativos en una sola tarjeta, debajo del score: riesgo de cascada de liquidaciones de largos,
 * capitulación de los compradores recientes y Momentum (RSI 14 en un extremo en la temporalidad del score). Cada uno
 * con su dato de ahora, lo que pasó otras veces y un enlace a su detalle. Sin ninguno, una línea que lo dice (así se
 * sabe que la tarjeta ha cargado y que no pasa nada). No cuentan en el score.
 */
export function AlertsCard({ rsi, tf, live }: Props) {
  const [cascade, setCascade] = useState<CascadeRisk | null>(null);
  const [cap, setCap] = useState<Capitulation | null>(null);
  const [open, toggle] = useOpen();
  useEffect(() => {
    cascadeRisk().then(setCascade, () => {});
    getJson("capitulation.json").then(setCap, () => {});
  }, []);

  const tx = t.alerts;
  const pct = (v: number) => t.percent(num(v, 0));
  const alerts: Alert[] = [];
  if (cascade?.active) {
    alerts.push({
      id: "cascade",
      icon: <CascadeIcon />,
      tone: "cascade",
      title: t.cascade.title,
      text: `${t.cascade.now(pct(cascade.longs), pct(LONGS_MIN), cascade.near ? t.percent(num(cascade.aboveLow * 100, 1)) : null,
        cascade.persistent ? Math.floor(cascade.streakBars / 6) : null)} ${tx.cascadeHistory}`,
      href: `${PAGE_PATH.sentiment[lang]}#liquidaciones`,
      link: tx.cascadeLink,
    });
  }
  if (cap?.level && cap.level !== "none") {
    alerts.push({
      id: "capitulation",
      icon: <span className="alert-dot" />,
      tone: cap.level,
      title: t.capitulation.levels[cap.level],
      text: `${tx.capitulationNow(
        cap.sth_realized_loss_ratio == null ? null : `×${num(cap.sth_realized_loss_ratio, 1)}`,
        cap.sth_sopr_24h == null ? null : num(cap.sth_sopr_24h, 3),
      )} ${tx.capitulationHistory}`,
      href: `${PAGE_PATH.sentiment[lang]}#capitulacion`,
      link: tx.capitulationLink,
    });
  }
  const dir = live ? momentumDir(rsi, tf) : null;
  if (dir && rsi != null) {
    alerts.push({
      id: "momentum",
      icon: (
        <svg className="alert-arrow" viewBox="0 0 16 16" aria-hidden="true">
          {dir === "up" ? <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /> : <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" />}
        </svg>
      ),
      tone: `momentum ${dir}`,
      title: tx.momentumTitle[dir](t.timeframes[tf].label),
      text: tx.momentumText[dir](num(rsi, 0)),
      href: PAGE_PATH.technical[lang],
      link: tx.momentumLink,
    });
  }

  return (
    <article className={open ? "card alerts" : "card alerts folded"}>
      <header>
        {/* h3, como el de las tarjetas del score que tiene al lado */}
        <h3>
          {tx.title}
          <InfoTip label={tx.title} title={tx.title}>
            {tx.info.map((p) => (
              <p key={p}>
                <Rich text={p} />
              </p>
            ))}
          </InfoTip>
        </h3>
        {/* Plegada: cuántas hay y sus iconos, para que no pasen desapercibidas */}
        {!open && (
          <span className="alerts-summary">
            {alerts.map((a) => (
              <span key={a.id} className={`alert-icon ${a.tone}`} title={a.title} aria-hidden="true">
                {a.icon}
              </span>
            ))}
            <span className={alerts.length ? undefined : "muted"}>{tx.count(alerts.length)}</span>
          </span>
        )}
        <button type="button" className="alerts-toggle" aria-expanded={open} aria-controls="alertas-lista" onClick={toggle}
                title={open ? tx.fold : tx.unfold}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6l4 4 4-4" />
          </svg>
          <span className="visually-hidden">{open ? tx.fold : tx.unfold}</span>
        </button>
      </header>
      {open && (
      <div id="alertas-lista">
      {alerts.length ? (
        <ul className="alerts-list">
          {alerts.map((a) => (
            <li key={a.id} className={`alert ${a.tone}`}>
              <span className="alert-icon" aria-hidden="true">
                {a.icon}
              </span>
              <div>
                <strong>{a.title}</strong>
                <p>
                  {a.text} <a href={a.href}>{a.link}</a>
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted alerts-none">{tx.none}</p>
      )}
      <p className="muted small">{tx.note}</p>
      </div>
      )}
    </article>
  );
}
