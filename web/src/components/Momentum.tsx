import { locale, t } from "../i18n";
import type { Category, Timeframe } from "../types";

// RSI 14 fuertemente sobrecomprado o sobrevendido. Backtest de noviembre de 2026 (velas de Binance desde 2018 y diarias
// desde 2014): con RSI ≥ 80 la subida siguió el 62 % (1 h), 69 % (4 h) y 77 % (1D) de las veces; con RSI ≤ 20 la caída,
// algo más de la mitad. Con 70/30 apenas dice nada. Solo donde se midió: en semanal y mensual hay pocas velas
const STRONG = { up: 80, down: 20 };
const TFS: Timeframe[] = ["1h", "4h", "1d"];

/** Flecha de impulso fuerte junto a la etiqueta del score: informativa, el índice no la usa. */
export function Momentum({ technical, tf }: { technical: Category | null; tf: Timeframe }) {
  if (!technical || !TFS.includes(tf)) return null;
  const rsi = technical.metrics.find((m) => m.id === "rsi_14")?.value;
  if (rsi == null) return null;
  const dir = rsi >= STRONG.up ? "up" : rsi <= STRONG.down ? "down" : null;
  if (!dir) return null;
  const text = t.momentum[dir](t.timeframes[tf].label, rsi.toLocaleString(locale, { maximumFractionDigits: 0 }));
  return (
    <span className={`momentum ${dir}`} role="img" aria-label={text} title={text} tabIndex={0}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {dir === "up" ? <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /> : <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" />}
      </svg>
    </span>
  );
}
