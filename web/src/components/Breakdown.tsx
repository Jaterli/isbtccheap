import { locale, t } from "../i18n";
import type { Category, CategoryId } from "../types";
import { InfoTip } from "./InfoTip";

interface Props {
  categories: Record<CategoryId, Category>;
  weights: Record<CategoryId, number>;
}

const ORDER: CategoryId[] = ["valoracion", "ciclo", "liquidez", "sentimiento", "tecnico"];

function fmt(v: number | null) {
  if (v === null) return "—";
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

export function colorFor(score: number) {
  return `var(--band-${Math.min(5, Math.floor(score / 20) + 1)})`;
}

export function Breakdown({ categories, weights }: Props) {
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
                    <span className="muted num">{fmt(m.value)}</span>
                    <span className="num">{m.score === null ? "—" : Math.round(m.score)}</span>
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
