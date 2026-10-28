import { locale, t } from "../i18n";
import { LAST_HALVING, NEXT_HALVING } from "../lib/cycles";
import type { Category, CategoryId } from "../types";
import { InfoTip } from "./InfoTip";

interface Props {
  categories: Record<CategoryId, Category>;
  weights: Record<CategoryId, number>;
  /** false mientras llegan los datos en vivo de Binance: técnico y sentimiento aún son los diarios del pipeline */
  live: boolean;
}

// Se recalculan en vivo: hasta tenerlas, su marca de zona extrema aparecería y desaparecería
const LIVE: CategoryId[] = ["tecnico", "sentimiento"];

const ORDER: CategoryId[] = ["sentimiento", "tecnico", "valoracion", "ciclo", "liquidez"];
// Zona extrema: el 10 % más bajo o más alto de su historia reciente
const EXTREME = 10;

// Métricas que se leen mejor como porcentaje: valor del pipeline → fracción a mostrar
const AS_PERCENT: Record<string, (v: number) => number> = {
  net_liquidity_roc: (v) => v,
  m2_yoy: (v) => v,
  dxy_roc: (v) => v,
  stablecoin_roc: (v) => v,
  // Residuo en log10 frente a la tendencia
  power_law: (v) => 10 ** v - 1,
  // Cocientes frente a una media: 1,1 es un +10 % por encima de ella
  mayer: (v) => v - 1,
  wma200_ratio: (v) => v - 1,
  ma200_ratio: (v) => v - 1,
  ma48_ratio: (v) => v - 1,
  puell: (v) => v - 1,
  // SOPR 1,007 = vendieron de media con un +0,7 % de beneficio
  sth_sopr: (v) => v - 1,
};

function fmt(v: number | null, id: string) {
  // El pipeline guarda la fase ya convertida en puntuación: se muestra la parte del ciclo transcurrida
  if (id === "halving_phase") {
    const phase = (Date.now() - LAST_HALVING) / (NEXT_HALVING - LAST_HALVING);
    return t.percent(Math.round(Math.min(Math.max(phase, 0), 1) * 100).toLocaleString(locale));
  }
  if (v === null) return "—";
  // Con 4 decimales: 0,0000267 redondearía a 0
  if (id === "funding") return t.percent((v * 100).toLocaleString(locale, { maximumFractionDigits: 4 }));
  // Partes del total (50 % = equilibrio): sin signo
  if (id === "long_short" || id === "taker_ratio") return t.percent((v * 100).toLocaleString(locale, { maximumFractionDigits: 1 }));
  if (id === "open_interest") return `${Math.round(v).toLocaleString(locale)} BTC`;
  if (id === "etf_flows") return `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString(locale)} BTC`;
  if (AS_PERCENT[id]) {
    const p = AS_PERCENT[id](v) * 100;
    const s = p.toLocaleString(locale, { maximumFractionDigits: Math.abs(p) >= 10 ? 1 : 2 });
    return t.percent(p > 0 ? `+${s}` : s);
  }
  const abs = Math.abs(v);
  return v.toLocaleString(locale, { maximumFractionDigits: abs >= 100 ? 0 : abs >= 1 ? 2 : 4 });
}

function Bar({ score }: { score: number | null }) {
  return (
    <div className="bar" aria-hidden="true">
      {score !== null && <div className="bar-fill" style={{ width: `${score}%`, background: colorFor(score) }} />}
    </div>
  );
}

/** En zona extrema, con un punto que late. Se decide con el número redondeado, el que se ve. */
function MetricScore({ score, mark }: { score: number | null; mark: boolean }) {
  if (score === null) return <span className="num">—</span>;
  const s = Math.round(score);
  const zone = !mark ? null : s <= EXTREME ? "cheap" : s >= 100 - EXTREME ? "expensive" : null;
  return (
    <span className="num">
      <b className="metric-score">
        {zone && <i className={`pulse ${zone}`} title={t.extreme[zone]} role="img" aria-label={t.extreme[zone]} />}
        {s}
      </b>
    </span>
  );
}

export function colorFor(score: number) {
  return `var(--band-${Math.min(5, Math.floor(score / 20) + 1)})`;
}

export function Breakdown({ categories, weights, live }: Props) {
  const totalW = ORDER.reduce((a, id) => a + (categories[id]?.score !== null ? weights[id] : 0), 0);
  return (
    <>
      {ORDER.map((id) => {
        const c = categories[id];
        if (!c) return null;
        const w = c.score === null ? 0 : (weights[id] / totalW) * 100;
        const info = t.categories[id];
        return (
          <article key={id} className="card category">
            <header>
              <h3>
                {info.name}
                <InfoTip label={info.name} title={info.name}>
                  <p>{info.what}</p>
                  <p>{info.read}</p>
                  <p className="muted">{t.scoreColumns}</p>
                </InfoTip>
              </h3>
              <span className="muted">{t.weight(w.toFixed(0))}</span>
              <strong className="num">{c.score === null ? "—" : Math.round(c.score)}</strong>
            </header>
            <Bar score={c.score} />
            <ul>
              {c.metrics.map((m) => {
                const mi = t.metrics[m.id];
                const name = mi?.name ?? m.name;
                return (
                  <li key={m.id}>
                    <span>
                      {name}
                      {mi && (
                        <InfoTip label={name} title={name}>
                          <p>{mi.what}</p>
                          <p>{mi.read}</p>
                        </InfoTip>
                      )}
                    </span>
                    <span className="muted num">{fmt(m.value, m.id)}</span>
                    <MetricScore score={m.score} mark={live || !LIVE.includes(id)} />
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </>
  );
}
