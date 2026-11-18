import { locale, t } from "../i18n";
import type { History } from "../types";
import { CATEGORY_KEY, CategoryScores } from "./CategoryScores";
import { rocPct } from "./LiquidityChart";

/** Métricas de la categoría de liquidez del índice, en el orden de su tarjeta, y al final las informativas */
const METRICS = ["global_liquidity_roc", "us2y_chg", "dxy_roc", "curve_chg", "nfci", "nfci_chg"] as const;
// Se puntúan igual, pero el índice no las usa: no anticipaban de forma fiable o no lo mejoraban (ver pipeline/config.py)
const INFO = ["dxy_roc", "curve_chg", "nfci", "nfci_chg"] as const;
// Suavizables: las que zigzaguean de un día a otro (los tipos de cambio y los repos son diarios; de media, unos 2 puntos
// al día y un recorrido en 30 días ~5 veces su cambio neto). El NFCI es semanal y ya va liso
const SMOOTH = [CATEGORY_KEY, "global_liquidity_roc", "us2y_chg", "dxy_roc", "curve_chg"] as const;
// El NFCI es un índice en desviaciones típicas (0 = la media), no una variación
const nfci = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Tarjeta de la página de liquidez con la puntuación de la categoría y de sus métricas sobre el precio (#metricas). */
export function LiquidityScores({ history }: { history: History | null }) {
  return (
    <CategoryScores
      history={history}
      file="liquidity_scores.json"
      category="liquidez"
      metrics={METRICS}
      info={INFO}
      tx={t.liquidity.scores}
      format={(id, v) => (id === "nfci" || id === "nfci_chg" ? nfci(v) : (id === "us2y_chg" || id === "curve_chg") ? t.liquidity.pp(nfci(v)) : rocPct(v, 1))}
      storageKey="isbtccheap:liquidity-scores-range"
      smooth={SMOOTH}
    />
  );
}
