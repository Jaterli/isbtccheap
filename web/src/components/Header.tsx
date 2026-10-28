import { useEffect, useRef, useState } from "react";
import { lang, page, PAGE_PATH, savePref, t, type Lang, type Page } from "../i18n";

const PAGES: Page[] = ["index", "volatility", "cycles", "valuation", "drawdown", "categories", "etf"];

/** Cabecera común: navegación entre páginas, selector de idioma (a la misma página en el otro idioma), logo y título. */
export function Header({ title, rest }: { title: string; rest: string }) {
  // En pantallas pequeñas los enlaces no caben en una fila: un botón con la página actual los abre en un desplegable
  // (en las grandes el botón está oculto y los enlaces siempre a la vista, ver styles.css)
  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // Se cierra al pulsar fuera o con Escape (devolviendo el foco al botón)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !nav.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header>
      <div className="top-nav">
        <nav className="page-nav" aria-label={t.nav.aria} ref={nav}>
          <button ref={toggle} type="button" className="nav-toggle" aria-expanded={open} aria-controls="page-links" onClick={() => setOpen(!open)}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
            {t.nav[page]}
          </button>
          <div id="page-links" className={open ? "page-links open" : "page-links"}>
            {PAGES.map((p) => (
              <a key={p} href={PAGE_PATH[p][lang]} aria-current={p === page ? "page" : undefined} onClick={() => setOpen(false)}>
                {t.nav[p]}
              </a>
            ))}
          </div>
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
