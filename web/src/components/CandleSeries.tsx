import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n";
import { fetchCandles } from "../lib/binance";
import { getJson } from "../lib/data";
import { CANDLE_TFS, isIntraday, priceSeries, type CandleTf, type PriceSeries } from "../lib/series";
import type { Candle, History } from "../types";

// En 1 h y 4 h se muestran todas las velas (las 1000 últimas de Binance)
const RANGES = [
  { id: "1y", days: 365 },
  { id: "4y", days: 1461 },
  { id: "all", days: Infinity },
];
const REFRESH_MS = 5 * 60_000;

function load(key: string, valid: string[], fallback: string) {
  try {
    const v = localStorage.getItem(key);
    return v && valid.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible: no pasa nada */
  }
}

export interface CandleSeriesState {
  tf: CandleTf;
  setTf: (tf: CandleTf) => void;
  range: string;
  setRange: (r: string) => void;
  intraday: boolean;
  /** Completos: los indicadores necesitan las velas previas al periodo mostrado */
  base: PriceSeries | null;
  days: number;
  error: boolean;
}

/** Tamaño de vela y periodo elegidos (recordados con `key`) y sus cierres, del histórico o de Binance. */
export function useCandleSeries(key: string): CandleSeriesState {
  const [tf, setTfState] = useState(() => load(`${key}-tf`, CANDLE_TFS, "1d") as CandleTf);
  const [range, setRangeState] = useState(() => load(`${key}-range`, RANGES.map((r) => r.id), "4y"));
  const [history, setHistory] = useState<History | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [candles, setCandles] = useState<{ tf: CandleTf; data: Candle[] } | null>(null);
  const [error, setError] = useState(false);
  const intraday = isIntraday(tf);

  useEffect(() => {
    getJson("history.json").then(setHistory, () => setError(true));
    fetchCandles("1d", 1).then((c) => setLive(c.at(-1)?.close ?? null), () => {});
  }, []);

  useEffect(() => {
    if (!intraday) return;
    let cancelled = false;
    const get = () =>
      fetchCandles(tf).then(
        (data) => !cancelled && (setCandles({ tf, data }), setError(false)),
        () => !cancelled && setError(true),
      );
    get();
    const id = setInterval(get, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tf, intraday]);

  const base = useMemo(() => {
    if (intraday) return candles?.tf === tf ? priceSeries(tf, { candles: candles.data }) : null;
    return history ? priceSeries(tf, { history, live }) : null;
  }, [tf, intraday, candles, history, live]);

  return {
    tf,
    setTf: (x) => (setTfState(x), save(`${key}-tf`, x)),
    range,
    setRange: (r) => (setRangeState(r), save(`${key}-range`, r)),
    intraday,
    base,
    days: intraday ? Infinity : RANGES.find((r) => r.id === range)!.days,
    error,
  };
}

export function CandleSeriesControls({ state }: { state: CandleSeriesState }) {
  const tx = t.charts;
  return (
    <div className="chart-controls">
      <div className="segmented small" role="radiogroup" aria-label={tx.tfAria}>
        {CANDLE_TFS.map((x) => (
          <button key={x} role="radio" aria-checked={x === state.tf} className={x === state.tf ? "active" : ""} onClick={() => state.setTf(x)}>
            {t.timeframes[x].short}
          </button>
        ))}
      </div>
      {!state.intraday && (
        <div className="segmented small" role="group" aria-label={tx.rangeAria}>
          {RANGES.map((r) => (
            <button key={r.id} className={r.id === state.range ? "active" : ""} onClick={() => state.setRange(r.id)}>
              {tx.ranges[r.id]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
