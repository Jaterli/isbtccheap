export const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  values.forEach((v, i) => {
    sum += v;
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  });
  return out;
}

/** RSI de Wilder del último cierre. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    if (i <= period) {
      gain += g / period;
      loss += l / period;
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
    }
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

/** %B de Bollinger (0 = banda inferior, 100 = banda superior) del último cierre. */
export function bollingerPctB(values: number[], period = 20, k = 2): number | null {
  if (values.length < period) return null;
  const win = values.slice(-period);
  const mean = win.reduce((a, b) => a + b, 0) / period;
  const sd = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  if (sd === 0) return 50;
  const last = values[values.length - 1];
  return ((last - (mean - k * sd)) / (2 * k * sd)) * 100;
}

export function percentileOfLast(series: number[]): number | null {
  if (series.length < 50) return null;
  const last = series[series.length - 1];
  const below = series.filter((v) => v <= last).length;
  return (below / series.length) * 100;
}
