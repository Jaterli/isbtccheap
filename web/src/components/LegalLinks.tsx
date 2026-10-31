import { lang, page, PAGE_PATH, t, type Page } from "../i18n";

const LINKS: Page[] = ["legal", "privacy", "cookies"];

/** Enlaces al aviso legal, la privacidad y las cookies, al pie de todas las páginas */
export function LegalLinks() {
  return (
    <nav className="legal-links" aria-label={t.footer.legalAria}>
      {LINKS.map((p) => (
        <a key={p} href={PAGE_PATH[p][lang]} aria-current={p === page ? "page" : undefined}>
          {t.nav[p]}
        </a>
      ))}
    </nav>
  );
}
