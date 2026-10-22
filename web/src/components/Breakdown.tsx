import type { Category, CategoryId } from "../types";

interface Props {
  categories: Record<CategoryId, Category>;
  weights: Record<CategoryId, number>;
}

const ORDER: CategoryId[] = ["valoracion", "ciclo", "liquidez", "sentimiento", "tecnico"];

function fmt(v: number | null) {
  if (v === null) return "—";
  const abs = Math.abs(v);
  return v.toLocaleString("es-ES", { maximumFractionDigits: abs >= 100 ? 0 : abs >= 1 ? 2 : 4 });
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
        return (
          <article key={id} className="card category">
            <header>
              <h3>{c.name}</h3>
              <span className="muted">peso {w.toFixed(0)} %</span>
              <strong className="num">{c.score === null ? "—" : Math.round(c.score)}</strong>
            </header>
            <Bar score={c.score} />
            <ul>
              {c.metrics.map((m) => (
                <li key={m.id}>
                  <span>{m.name}</span>
                  <span className="muted num">{fmt(m.value)}</span>
                  <span className="num">{m.score === null ? "—" : Math.round(m.score)}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </>
  );
}
