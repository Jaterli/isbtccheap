import { useEffect, useState } from "react";
import { lang, PAGE_PATH, t } from "../i18n";
import { cascadeRisk } from "../lib/cascade";

/**
 * Etiqueta «Riesgo de cascada» junto a la categoría de sentimiento cuando muchas cuentas están en largo y el precio
 * está cerca de su mínimo de 7 días (o llevan así 3 días): enlaza a la tarjeta de liquidaciones, que lo explica. Sin
 * riesgo no se muestra, como la de capitulación.
 */
export function CascadeBadge() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    cascadeRisk().then((r) => setOn(!!r?.active), () => {});
  }, []);
  if (!on) return null;
  const tx = t.cascade;
  return (
    <a className="cap-light cascade" href={`${PAGE_PATH.sentiment[lang]}#liquidaciones`} title={tx.title} aria-label={tx.title}>
      <span className="cap-light-text">{tx.badge}</span>
      <span className="cap-light-dot" aria-hidden="true" />
    </a>
  );
}
