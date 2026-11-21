import { useEffect, useState } from "react";
import { lang, PAGE_PATH, t } from "../i18n";
import { getJson } from "../lib/data";

type Level = "none" | "capitulation_levels" | "intense_capitulation";

/**
 * Etiqueta «Capitulación» junto al nombre de la categoría de sentimiento cuando los compradores recientes están
 * capitulando (capitulation.json, la misma regla que la tarjeta y el análisis); enlaza a esa tarjeta. Sin capitulación no
 * se muestra: así no ocupa sitio para decir que no pasa nada.
 */
export function CapitulationBadge() {
  const [level, setLevel] = useState<Level>("none");
  useEffect(() => {
    getJson("capitulation.json").then((c: { level?: Level }) => setLevel(c.level ?? "none"), () => {});
  }, []);
  if (level === "none") return null;
  const full = t.capitulation.levels[level];
  return (
    // Un punto de color (naranja: niveles de capitulación; rojo: intensa) y, en pantallas grandes, el texto
    <a className={`cap-light ${level}`} href={`${PAGE_PATH.sentiment[lang]}#capitulacion`} title={`${full}: ${t.capitulation.card}`} aria-label={full}>
      {/* Como la etiqueta Momentum del técnico: el texto y, detrás, el icono */}
      <span className="cap-light-text">{t.capitulation.badge}</span>
      <span className="cap-light-dot" aria-hidden="true" />
    </a>
  );
}
