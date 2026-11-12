import { t } from "../i18n";
import type { History } from "../types";
import { CategoryScores } from "./CategoryScores";
import { rocPct } from "./LiquidityChart";

/** Métricas de la categoría de liquidez del índice, en el orden de su tarjeta, y al final las informativas */
const METRICS = ["global_liquidity_roc", "dxy_roc", "m2_yoy", "stablecoin_roc"] as const;
// Se puntúan igual, pero el índice no las usa: no anticipaban de forma fiable (ver pipeline/config.py)
const INFO = ["m2_yoy", "stablecoin_roc"] as const;

/** Tarjeta de la página de liquidez con la puntuación de la categoría y de sus métricas sobre el precio (#metricas). */
export function LiquidityScores({ history }: { history: History | null }) {
  return (
    <CategoryScores
      history={history}
      file="liquidity_scores.json"
      metrics={METRICS}
      info={INFO}
      tx={t.liquidity.scores}
      format={(_, v) => rocPct(v, 1)}
      storageKey="isbtccheap:liquidity-scores-range"
    />
  );
}
