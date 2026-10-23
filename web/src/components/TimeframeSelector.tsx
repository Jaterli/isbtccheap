import { t } from "../i18n";
import { TIMEFRAMES, type Timeframe } from "../types";

interface Props {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export function TimeframeSelector({ value, onChange }: Props) {
  return (
    <div className="segmented timeframes" role="radiogroup" aria-label={t.timeframeAria}>
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          role="radio"
          aria-checked={value === tf}
          aria-label={t.timeframes[tf].label}
          title={t.timeframes[tf].label}
          className={value === tf ? "active" : ""}
          onClick={() => onChange(tf)}
        >
          {t.timeframes[tf].short}
        </button>
      ))}
    </div>
  );
}
