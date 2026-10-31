import type { ReactNode } from "react";
import { CRYPTO, OPEN_DONATE_EVENT, PAYPAL_URL } from "../donations";
import { lang, page, PAGE_PATH, t, type Page } from "../i18n";

const LEGAL: Page[] = ["legal", "privacy", "cookies"];
const DONATIONS = !!PAYPAL_URL || CRYPTO.some((m) => m.address);

/** Pie de todas las páginas. children: párrafos propios de la página, antes del aviso */
export function Footer({ children }: { children?: ReactNode }) {
  return (
    <footer className="muted small">
      {children}
      <p>{t.footer.disclaimer}</p>
      <div className="footer-bottom">
        <p className="credit">
          {t.footer.credit} <a href="https://jaterli.com" target="_blank" rel="noreferrer">Jaterli</a>
          {/* Lleva al bloque de donaciones del índice; si ya se está en él, lo despliega (sin cambio de #, no hay hashchange) */}
          {DONATIONS && (
            <a
              className="support-link"
              href={`${PAGE_PATH.index[lang]}#donar`}
              onClick={() => page === "index" && window.dispatchEvent(new Event(OPEN_DONATE_EVENT))}
            >
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path d="M8 14s-5.5-3.4-5.5-7.2C2.5 4.6 4 3 5.8 3 6.9 3 7.6 3.6 8 4.3 8.4 3.6 9.1 3 10.2 3c1.8 0 3.3 1.6 3.3 3.8C13.5 10.6 8 14 8 14z" />
              </svg>
              {t.donate.title}
            </a>
          )}
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
