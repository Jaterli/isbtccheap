import { locale, t } from "../i18n";
import type { Timeframe } from "../types";

// RSI 14 fuertemente sobrecomprado o sobrevendido. Backtest de noviembre de 2026 (velas de Binance desde 2018 y diarias
// desde 2014): con RSI ≥ 80 la subida siguió el 62 % (1 h), 69 % (4 h) y 77 % (1D) de las veces; con RSI ≤ 20 la caída,
// algo más de la mitad. Con 70/30 apenas dice nada. Solo donde se midió: en semanal y mensual hay pocas velas. Probado
// también como ajuste del técnico (sumar puntos en sobreventa extrema y restarlos en sobrecompra): apenas mejoraba la
// anticipación y bajaba el score de 1 h en el techo de noviembre de 2021, así que solo se muestra
const STRONG = { up: 80, down: 20 };
const TFS: Timeframe[] = ["1h", "4h", "1d"];

/** Dirección del impulso fuerte, o null si el RSI no está en un extremo (o no es una temporalidad medida). */
export function momentumDir(rsi: number | null | undefined, tf: Timeframe): "up" | "down" | null {
  if (rsi == null || !TFS.includes(tf)) return null;
  return rsi >= STRONG.up ? "up" : rsi <= STRONG.down ? "down" : null;
}

/** Etiqueta «Momentum» con una flecha junto al RSI 14 cuando está en un extremo: informativa, el índice no la usa. */
export function Momentum({ rsi, tf }: { rsi: number | null | undefined; tf: Timeframe }) {
  const dir = momentumDir(rsi, tf);
  if (!dir || rsi == null) return null;
  const text = t.momentum[dir](t.timeframes[tf].label, rsi.toLocaleString(locale, { maximumFractionDigits: 0 }));
  return (
    <span className={`momentum ${dir}`} role="img" aria-label={text} title={text} tabIndex={0}>
      {t.momentum.label}
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {dir === "up" ? <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /> : <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" />}
      </svg>
    </span>
  );
}
