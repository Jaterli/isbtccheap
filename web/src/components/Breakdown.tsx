import { locale, t } from "../i18n";
import type { Category, CategoryId } from "../types";
import { InfoTip } from "./InfoTip";

interface Props {
  categories: Record<CategoryId, Category>;
  weights: Record<CategoryId, number>;
  /** false mientras llegan los datos en vivo de Binance: técnico y sentimiento aún son los diarios del pipeline */
  live: boolean;
}

// Categorías que se recalculan en vivo: hasta tenerlas, su aviso de zona extrema aparecería y desaparecería
const LIVE: CategoryId[] = ["tecnico", "sentimiento"];

// Mismas fechas que HALVINGS en pipeline/config.py: el último halving y la estimación del siguiente
const LAST_HALVING = Date.UTC(2024, 3, 20);
const NEXT_HALVING = Date.UTC(2028, 3, 15);

const ORDER: CategoryId[] = ["valoracion", "ciclo", "liquidez", "sentimiento", "tecnico"];
// Puntuación a partir de la que una métrica está en zona extrema: el 10 % más bajo o más alto de su historia reciente
const EXTREME = 10;

// Métricas que se leen mejor como porcentaje: el valor del pipeline → fracción a mostrar
const AS_PERCENT: Record<string, (v: number) => number> = {
  // Variaciones: 0,0491 es un +4,91 %
  net_liquidity_roc: (v) => v,
  m2_yoy: (v) => v,
  dxy_roc: (v) => v,
  stablecoin_roc: (v) => v,
  // Residuo en log10 frente a la tendencia: 10^v − 1 es cuánto está el precio por encima o por debajo
  power_law: (v) => 10 ** v - 1,
  // Cocientes frente a una media: 1,1 es un +10 % por encima de ella
  mayer: (v) => v - 1,
  wma200_ratio: (v) => v - 1,
  ma200_ratio: (v) => v - 1,
  ma48_ratio: (v) => v - 1,
  puell: (v) => v - 1,
};

function fmt(v: number | null, id: string) {
  // El pipeline guarda la fase ya convertida en puntuación; se muestra la parte del ciclo transcurrida, que se entiende
  if (id === "halving_phase") {
    const phase = (Date.now() - LAST_HALVING) / (NEXT_HALVING - LAST_HALVING);
    return t.percent(Math.round(Math.min(Math.max(phase, 0), 1) * 100).toLocaleString(locale));
  }
  if (v === null) return "—";
  // El funding se publica como porcentaje cada 8 h (0,01 % es neutro); como fracción, 0,0000267 redondeaba a 0
  if (id === "funding") return t.percent((v * 100).toLocaleString(locale, { maximumFractionDigits: 4 }));
  // Partes del total (50 % = equilibrio entre largos y cortos, o entre compras y ventas): sin signo
  if (id === "long_short" || id === "taker_ratio") return t.percent((v * 100).toLocaleString(locale, { maximumFractionDigits: 1 }));
  if (id === "open_interest") return `${Math.round(v).toLocaleString(locale)} BTC`;
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

/** Aviso al pie de la tarjeta con las métricas en zona extrema (muy barata o muy cara); nada si no hay ninguna. */
function ExtremeNote({ metrics }: { metrics: Category["metrics"] }) {
  // Con la puntuación redondeada, la misma que se ve en la fila (un 10,4 se muestra como 10 y debe avisar)
  const extreme = metrics
    .filter((m) => m.score !== null)
    .map((m) => ({ ...m, score: Math.round(m.score!) }))
    .filter((m) => m.score <= EXTREME || m.score >= 100 - EXTREME);
  if (!extreme.length) return null;
  return (
    <p className="extreme-note small">
      <span className="extreme-icon" aria-hidden="true">⚠</span>
      <span>
        {extreme.map((m, i) => {
          const cheap = m.score <= EXTREME;
          return (
            <span key={m.id} className={cheap ? "extreme-cheap" : "extreme-expensive"}>
              {i > 0 && " · "}
              {t.extreme.item(t.metrics[m.id]?.name ?? m.name, cheap ? t.extreme.cheap : t.extreme.expensive, m.score)}
            </span>
          );
        })}
      </span>
    </p>
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
                    <span className="num">{m.score === null ? "—" : Math.round(m.score)}</span>
                  </li>
                );
              })}
            </ul>
            {(live || !LIVE.includes(id)) && <ExtremeNote metrics={c.metrics} />}
          </article>
        );
      })}
    </>
  );
}
