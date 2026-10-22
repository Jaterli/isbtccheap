import { TIMEFRAMES, type Timeframe } from "../types";

interface Props {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export function TimeframeSelector({ value, onChange }: Props) {
  return (
    <div className="segmented timeframes" role="radiogroup" aria-label="Temporalidad">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.id}
          role="radio"
          aria-checked={value === tf.id}
          aria-label={tf.label}
          title={tf.label}
          className={value === tf.id ? "active" : ""}
          onClick={() => onChange(tf.id)}
        >
          {tf.short}
        </button>
      ))}
    </div>
  );
}
