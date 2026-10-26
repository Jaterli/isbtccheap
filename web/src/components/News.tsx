import { useEffect, useState } from "react";
import { lang, locale, t } from "../i18n";
import { InfoTip } from "./InfoTip";

/** Salida de news/build_news.py */
interface NewsItem {
  title_es: string;
  title: string;
  source: string;
  link: string;
  published: string;
  category: string;
  impact: number;
}

// Lo genera el script del droplet cada 15 min; nginx lo sirve en la misma web (en desarrollo, vite.config.ts)
const NEWS_URL = `${import.meta.env.BASE_URL}news/news.json`;
const REFRESH_MS = 15 * 60_000;

/** "hace 3 h" / "3 hours ago" */
function ago(iso: string, now: number) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  const min = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (min > -60) return rtf.format(Math.min(min, 0), "minute");
  const h = Math.round(min / 60);
  return h > -24 ? rtf.format(h, "hour") : rtf.format(Math.round(h / 24), "day");
}

/** Impacto 0-10 del script → nivel para el indicador */
const level = (impact: number) => (impact >= 7 ? "high" : impact >= 5 ? "mid" : "low");

/** Noticias recientes que más pueden mover el precio de BTC, seleccionadas y traducidas con IA. */
export function News() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = () =>
      fetch(NEWS_URL, { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: { items: NewsItem[] }) => {
          setItems(d.items);
          setNow(Date.now());
        })
        .catch(() => {
          /* sin noticias la tarjeta no se muestra; el resto de la web no depende de ellas */
        });
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  if (!items?.length) return null;
  const tx = t.news;

  return (
    <section className="card news">
      <header>
        <h3>
          {tx.title}
          <InfoTip label={tx.title} title={tx.title}>
            {tx.info.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <ul className="info-list">
              {(["high", "mid", "low"] as const).map((l) => (
                <li key={l}>
                  <span className={`news-dot ${l}`} />
                  {tx.levels[l]}
                </li>
              ))}
            </ul>
          </InfoTip>
        </h3>
      </header>
      <ol className="news-list">
        {items.map((n) => (
          <li key={n.link}>
            <span className={`news-dot ${level(n.impact)}`} title={tx.levels[level(n.impact)]} />
            <div>
              <a href={n.link} target="_blank" rel="noreferrer" lang={lang === "es" && n.title_es !== n.title ? "es" : "en"}>
                {lang === "es" ? n.title_es : n.title}
              </a>
              <p className="news-meta muted small">
                <span className="news-tag">{tx.categories[n.category] ?? n.category}</span>
                {n.source} · <time dateTime={n.published}>{ago(n.published, now)}</time>
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="muted small news-note">{tx.note}</p>
    </section>
  );
}
