import { useEffect, useState } from "react";
import { lang, locale, t } from "../i18n";
import { getJson } from "../lib/data";

/** scenarios.json (web/public/data): escenarios hasta una fecha, escritos a mano; se actualizan sin tocar el código */
type Dir = "alcista" | "bajista" | "lateral";
interface ScenarioText {
  title: string;
  what: string;
  why: string[];
  change: string;
}
interface Scenarios {
  generated_at: string;
  horizon: string;
  price: number;
  scenarios: ({ id: Dir; prob: number; low: number; high: number } & Record<"es" | "en", ScenarioText>)[];
  es: { basis: string; watch: string };
  en: { basis: string; watch: string };
}

const usd = (v: number) => v.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Tres escenarios hasta una fecha (alcista, bajista y de rango) con su probabilidad estimada, de mayor a menor. Desaparece
 * pasada esa fecha: ya no dicen nada del futuro. Una lectura con datos, no una predicción ni una recomendación.
 */
export function ScenariosCard() {
  const [s, setS] = useState<Scenarios | null>(null);
  useEffect(() => {
    getJson("scenarios.json").then(setS, () => {});
  }, []);
  if (!s || new Date().toISOString().slice(0, 10) > s.horizon) return null;
  const tx = t.analysis.yearEnd;
  const sorted = [...s.scenarios].sort((a, b) => b.prob - a.prob);
  return (
    <section className="card an-year">
      <h2>{tx.title(day(s.horizon))}</h2>
      <p className="muted small">{tx.from(day(s.generated_at), usd(s.price))}</p>
      <ul className="an-year-list">
        {sorted.map((sc) => {
          const x = sc[lang];
          return (
            <li key={sc.id} className={`an-year-item ${sc.id}`}>
              <div className="an-year-head">
                <strong>{x.title}</strong>
                <span className="num an-year-prob">{t.percent(String(sc.prob))}</span>
                <span className="muted num">{tx.range(usd(sc.low), usd(sc.high))}</span>
              </div>
              <div className="an-year-bar" aria-hidden="true">
                <i style={{ width: `${sc.prob}%` }} />
              </div>
              <p>{x.what}</p>
              <p className="an-year-label">{tx.why}</p>
              <ul className="an-points">
                {x.why.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="muted">{x.change}</p>
            </li>
          );
        })}
      </ul>
      <p className="muted small">{s[lang].basis}</p>
      <p className="muted small">{s[lang].watch}</p>
      <p className="muted small">{tx.note}</p>
    </section>
  );
}
