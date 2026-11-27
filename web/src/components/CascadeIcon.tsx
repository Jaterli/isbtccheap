/**
 * Una cascada: el precio que cae en escalones, cada vez más abajo, y termina en una flecha hacia abajo (las
 * liquidaciones que se encadenan). El color, el del texto (styles.css, .alert.cascade)
 */
export function CascadeIcon() {
  return (
    <svg className="cascade-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 2.5h3v3.5h3.5v3.5h4v4" />
      <path d="M9.8 11.3 12 13.5l2.2-2.2" />
    </svg>
  );
}
