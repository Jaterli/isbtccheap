import { useEffect, useState } from "react";
import { lang, locale, t } from "../i18n";
import { CollapseTitle, useMobileCollapse } from "./Collapsible";
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

// Lo genera el script del droplet; nginx lo sirve en la misma web (en desarrollo, vite.config.ts)
const NEWS_URL = `${import.meta.env.BASE_URL}news/news.json`;
// El cron lo regenera a los :05, :20, :35 y :50 (UTC): se pide un minuto después, para mostrar las noticias de un
// dato económico (publicados a en punto o a y media) unos 6 minutos después de salir
const FETCH_MINUTES = [6, 21, 36, 51];

function msToNextFetch(now = new Date()) {
  const m = now.getUTCMinutes();
  const target = new Date(now);
  target.setUTCMinutes(FETCH_MINUTES.find((x) => x > m) ?? FETCH_MINUTES[0] + 60, 0, 0);
  // Unos segundos al azar: que no lleguen todos los visitantes a la vez
  return target.getTime() - now.getTime() + Math.random() * 20_000;
}

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
  const fold = useMobileCollapse();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      fetch(NEWS_URL, { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: { items: NewsItem[] }) => setItems(d.items))
        .catch(() => {
          /* sin noticias la tarjeta no se muestra; el resto de la web no depende de ellas */
        });
      timer = setTimeout(load, msToNextFetch());
    };
    load();
    // Reloj para el "hace X min" de cada titular
    const clock = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, []);

  if (!items?.length) return null;
  const tx = t.news;

  return (
    <section className={`card news${fold.open ? "" : " collapsed"}`}>
      <header>
        <h3>
          <CollapseTitle state={fold}>{tx.title}</CollapseTitle>
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
      {fold.open && (
        <>
          <ol className="news-list" id={fold.bodyId}>
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
        </>
      )}
    </section>
  );
}
