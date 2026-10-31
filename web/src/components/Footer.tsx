import type { ReactNode } from "react";
import { lang, page, PAGE_PATH, t, type Page } from "../i18n";

const LEGAL: Page[] = ["legal", "privacy", "cookies"];

/** Pie de todas las páginas. children: párrafos propios de la página, antes del aviso */
export function Footer({ children }: { children?: ReactNode }) {
  return (
    <footer className="muted small">
      {children}
      <p>{t.footer.disclaimer}</p>
      <div className="footer-bottom">
        <p className="credit">
          {t.footer.credit} <a href="https://jaterli.com" target="_blank" rel="noreferrer">Jaterli</a>
        </p>
        <nav className="legal-links" aria-label={t.footer.legalAria}>
          {LEGAL.map((p) => (
            <a key={p} href={PAGE_PATH[p][lang]} aria-current={p === page ? "page" : undefined}>
              {t.nav[p]}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
