export interface MetricOption {
  id: string;
  label: string;
  /** Informativa: el índice no la usa (va en su propio grupo) */
  info?: boolean;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  options: MetricOption[];
  /** Para lectores de pantalla */
  aria: string;
  /** Título del grupo de las informativas */
  infoGroup?: string;
}

/** Desplegable con lo que se dibuja sobre el precio: la categoría y sus métricas y, aparte, las informativas. */
export function MetricSelect({ value, onChange, options, aria, infoGroup }: Props) {
  const main = options.filter((o) => !o.info);
  const info = options.filter((o) => o.info);
  const opt = (o: MetricOption) => (
    <option key={o.id} value={o.id}>
      {o.label}
    </option>
  );
  return (
    <label className="metric-select">
      <span className="visually-hidden">{aria}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {main.map(opt)}
        {info.length > 0 && (infoGroup ? <optgroup label={infoGroup}>{info.map(opt)}</optgroup> : info.map(opt))}
      </select>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </label>
  );
}
