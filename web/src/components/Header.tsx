import { useEffect, useRef, useState } from "react";
import { lang, page, PAGE_PATH, savePref, t, type Lang, type Page } from "../i18n";

const PAGES: Page[] = ["index", "analysis", "etf", "volatility", "valuation", "drawdown", "categories", "cycles"];

export function Header({ title, rest }: { title: string; rest: string }) {
  // Por debajo de 1000 px los enlaces van en un desplegable (styles.css oculta el botón en pantallas grandes)
  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

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

  // stuck: en pantallas grandes, la barra pasa a estar fija arriba con el logo pequeño en cuanto llega al borde
  // (el padding superior del contenedor). scrolled: el botón flotante para volver arriba (solo en móvil, ver
  // styles.css) aparece tras bajar una pantalla
  const [stuck, setStuck] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setStuck(window.scrollY > 24);
      setScrolled(window.scrollY > window.innerHeight);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Móvil: la barra (logo pequeño, páginas e idioma) va siempre pegada arriba. Pantallas grandes: sin scroll, el
  // menú arriba a la derecha y el logo grande junto al título; al bajar, la barra se fija arriba con el logo pequeño
  const home = PAGE_PATH.index[lang];
  const logo = `${import.meta.env.BASE_URL}logo-isbtccheap.png`;
  return (
    <>
      <header className={stuck ? "site-bar stuck" : "site-bar"}>
        <a className="brand-mini" href={home}>
          <img src={logo} alt="Is BTC Cheap?" width="350" height="350" />
        </a>
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
      </header>
      <div className="top">
        <a className="brand" href={home}>
          <img src={logo} alt="Is BTC Cheap?" width="350" height="350" />
        </a>
        <div className="intro">
          <h1>{title}</h1>
          <p className="muted">{rest}</p>
        </div>
      </div>
      <button
        type="button"
        className={scrolled ? "to-top show" : "to-top"}
        aria-label={t.nav.top}
        tabIndex={scrolled ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
          <path d="M3 10l5-5 5 5" />
        </svg>
      </button>
    </>
  );
}
