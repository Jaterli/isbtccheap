import qrcode from "qrcode-generator";
import { useEffect, useMemo, useState } from "react";
import { CRYPTO, PAYPAL_URL } from "../donations";
import { t } from "../i18n";
import { InfoTip } from "./InfoTip";

function Qr({ text }: { text: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
    return { size: n, path: d };
  }, [text]);
  // Fondo blanco siempre (también en modo oscuro) para que lo lean todas las cámaras
  return (
    <svg className="qr" viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img" aria-label={t.donate.qrAria}>
      <rect x="-2" y="-2" width={size + 4} height={size + 4} fill="#fff" />
      <path d={path} fill="#000" shapeRendering="crispEdges" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sin permiso de portapapeles: la dirección sigue visible para copiarla a mano */
    }
  };
  return (
    <button type="button" className="btn" onClick={copy} aria-live="polite">
      {copied ? t.donate.copied : t.donate.copy}
    </button>
  );
}

/** Evento para desplegar el bloque desde fuera (p. ej. el enlace del footer) */
export const OPEN_DONATE_EVENT = "isbtccheap:open-donate";

export function Donate() {
  const methods = CRYPTO.filter((m) => m.address);
  const [active, setActive] = useState(methods[0]?.id);
  const [open, setOpen] = useState(() => window.location.hash === "#donar");

  useEffect(() => {
    const show = () => setOpen(true);
    const onHash = () => window.location.hash === "#donar" && show();
    window.addEventListener(OPEN_DONATE_EVENT, show);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener(OPEN_DONATE_EVENT, show);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  if (!PAYPAL_URL && !methods.length) return null;
  const m = methods.find((x) => x.id === active) ?? methods[0];

  return (
    <section id="donar" className={`card donate${open ? " open" : ""}`}>
      <header>
        <h3>
          <button type="button" className="collapse-toggle" aria-expanded={open} aria-controls="donar-body" onClick={() => setOpen((o) => !o)}>
            {t.donate.title}
            <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          <InfoTip label={t.donate.infoLabel} title={t.donate.infoTitle}>
            <p>{t.donate.info1}</p>
            <p>{t.donate.info2}</p>
          </InfoTip>
        </h3>
      </header>

      {open && (
        <div id="donar-body">
          <p className="muted">{t.donate.coffee}</p>

          <div className="donate-body">
            {PAYPAL_URL && (
              <a className="btn btn-paypal" href={PAYPAL_URL} target="_blank" rel="noreferrer">
                {t.donate.paypal}
              </a>
            )}

            {m && (
              <div className="crypto">
                {methods.length > 1 && (
                  <div className="segmented small" role="tablist" aria-label={t.donate.networkAria}>
                    {methods.map((x) => (
                      <button key={x.id} role="tab" aria-selected={x.id === m.id} className={x.id === m.id ? "active" : ""} onClick={() => setActive(x.id)}>
                        {x.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="crypto-row">
                  <Qr text={m.uri(m.address)} />
                  <div className="crypto-info">
                    <span className="small muted">{methods.length === 1 ? `${m.label} · ` : ""}{t.donate.hints[m.id]}</span>
                    <code className="address">{m.address}</code>
                    <div className="crypto-actions">
                      <CopyButton text={m.address} />
                      <a className="btn" href={m.uri(m.address)}>{t.donate.openWallet}</a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
