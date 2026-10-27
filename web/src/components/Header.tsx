import { useEffect, useRef } from "react";
import { lang, page, PAGE_PATH, savePref, t, type Lang, type Page } from "../i18n";

const PAGES: Page[] = ["index", "volatility", "cycles", "valuation", "drawdown", "categories"];

/** Cabecera común: navegación entre páginas, selector de idioma (a la misma página en el otro idioma), logo y título. */
export function Header({ title, rest }: { title: string; rest: string }) {
  const nav = useRef<HTMLElement>(null);
  // En móvil el menú no cabe y se desplaza: que la página actual quede a la vista
  useEffect(() => {
    const el = nav.current;
    const current = el?.querySelector<HTMLElement>("[aria-current]");
    const overflow = el && current ? current.getBoundingClientRect().right - el.getBoundingClientRect().right : 0;
    if (overflow > 0) el!.scrollLeft += overflow;
  }, []);
  return (
    <header>
      <div className="top-nav">
        <nav className="page-nav" aria-label={t.nav.aria} ref={nav}>
          {PAGES.map((p) => (
            <a key={p} href={PAGE_PATH[p][lang]} aria-current={p === page ? "page" : undefined}>
              {t.nav[p]}
            </a>
          ))}
        </nav>
        <nav className="lang-switch" aria-label={t.language}>
          {(["es", "en"] as Lang[]).map((l) => (
            <a key={l} href={PAGE_PATH[page][l]} hrefLang={l} lang={l} aria-current={l === lang ? "true" : undefined} onClick={() => savePref(l)}>
              {l.toUpperCase()}
            </a>
          ))}
        </nav>
      </div>
      <div className="top">
        <a className="brand" href={PAGE_PATH.index[lang]}>
          <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Is BTC Cheap?" width="320" height="320" />
        </a>
        {/* El <h1> es la pregunta o el tema de la página, el texto que buscan los usuarios */}
        <div className="intro">
          <h1>{title}</h1>
          <p className="muted">{rest}</p>
        </div>
      </div>
    </header>
  );
}
