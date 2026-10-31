import { Header } from "./components/Header";
import { LegalLinks } from "./components/LegalLinks";
import { lang, page, t } from "./i18n";
import { LEGAL, linkParts, type LegalPage } from "./i18n/legal";

function Rich({ text }: { text: string }) {
  return (
    <>
      {linkParts(text).map((x, i) =>
        "href" in x ? (
          <a key={i} href={x.href} {...(/^https?:/.test(x.href) && { target: "_blank", rel: "noreferrer" })}>
            {x.text}
          </a>
        ) : (
          x.text
        ),
      )}
    </>
  );
}

/** Aviso legal, privacidad y cookies: el texto de cada una está en i18n/legal.ts */
export function LegalApp() {
  const doc = LEGAL[page as LegalPage][lang];

  return (
    <main className="container">
      <Header title={doc.title} rest={doc.rest} />

      <section className="card legal">
        {doc.sections.map((s) => (
          <div key={s.h}>
            <h2>{s.h}</h2>
            {s.p?.map((p) => (
              <p key={p}>
                <Rich text={p} />
              </p>
            ))}
            {s.list && (
              <ul>
                {s.list.map((li) => (
                  <li key={li}>
                    <Rich text={li} />
                  </li>
                ))}
              </ul>
            )}
            {s.table && (
              <div className="legal-table-wrap">
                <table className="legal-table">
                  <thead>
                    <tr>
                      {s.table[0].map((c) => (
                        <th key={c} scope="col">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.slice(1).map(([key, use]) => (
                      <tr key={key}>
                        <td>
                          {key.split(", ").map((k) => (
                            <code key={k}>{k}</code>
                          ))}
                        </td>
                        <td>{use}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.after?.map((p) => (
              <p key={p}>
                <Rich text={p} />
              </p>
            ))}
          </div>
        ))}
      </section>

      <footer className="muted small">
        <p>{t.footer.disclaimer}</p>
        <p className="credit">
          {t.footer.credit} <a href="https://jaterli.com" target="_blank" rel="noreferrer">Jaterli</a>
        </p>
        <LegalLinks />
      </footer>
    </main>
  );
}
