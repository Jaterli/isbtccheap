import { t } from "../i18n";
import { InfoTip } from "./InfoTip";

/**
 * Icono de ayuda junto al nombre de una métrica o categoría en los textos de las gráficas: qué mide y cómo se lee (las
 * mismas descripciones que las tarjetas del índice). Se abre al pasar el ratón o al pulsarlo.
 */
export function MetricHelp({ id, kind = "metric" }: { id: string; kind?: "metric" | "category" }) {
  const d = kind === "category" ? t.categories[id as keyof typeof t.categories] : t.metrics[id];
  if (!d) return null;
  return (
    <InfoTip label={d.name} title={d.name}>
      <p>{d.what}</p>
      <p>{d.read}</p>
    </InfoTip>
  );
}
