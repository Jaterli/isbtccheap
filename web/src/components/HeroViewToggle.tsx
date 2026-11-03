import { t } from "../i18n";

export type HeroView = "score" | "price";

// Medidor (score) y línea de precio
const ICONS: Record<HeroView, string> = {
  score: "M2.5 11.5a5.5 5.5 0 0 1 11 0M8 11.5l2.6-3.4",
  price: "M2 12.5l3.5-4 3 2.5 5-6.5",
};

/** Score o gráfico del precio en la tarjeta principal: dos iconos al inicio de la fila de temporalidades. */
export function HeroViewToggle({ value, onChange }: { value: HeroView; onChange: (v: HeroView) => void }) {
  return (
    <div className="segmented small hero-view" role="radiogroup" aria-label={t.heroView.aria}>
      {(["score", "price"] as const).map((v) => (
        <button key={v} role="radio" aria-checked={value === v} aria-label={t.heroView[v]} title={t.heroView[v]} className={value === v ? "active" : ""} onClick={() => onChange(v)}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d={ICONS[v]} />
          </svg>
        </button>
      ))}
    </div>
  );
}
