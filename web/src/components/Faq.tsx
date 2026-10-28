import { lang } from "../i18n";
import { SEO } from "../i18n/seo";

export function Faq() {
  const s = SEO[lang];
  return (
    <section className="card faq">
      <h2>{s.faqTitle}</h2>
      <p className="muted">{s.intro}</p>
      {s.faq.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </section>
  );
}
