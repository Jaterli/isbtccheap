import { useEffect, useId, useState, type ReactNode } from "react";

// Mismo corte que la rejilla del panel (styles.css): por debajo, una sola columna
const SMALL = "(max-width: 639px)";

function useSmallScreen() {
  const [small, setSmall] = useState(() => window.matchMedia(SMALL).matches);
  useEffect(() => {
    const mq = window.matchMedia(SMALL);
    const onChange = () => setSmall(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return small;
}

export interface MobileCollapse {
  collapsible: boolean;
  open: boolean;
  toggle: () => void;
  bodyId: string;
}

/** Plegada por defecto en móvil y siempre desplegada en pantallas mayores. */
export function useMobileCollapse(): MobileCollapse {
  const small = useSmallScreen();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return { collapsible: small, open: !small || open, toggle: () => setOpen((o) => !o), bodyId };
}

export function CollapseTitle({ state, children }: { state: MobileCollapse; children: ReactNode }) {
  if (!state.collapsible) return <>{children}</>;
  return (
    <button type="button" className="collapse-toggle" aria-expanded={state.open} aria-controls={state.bodyId} onClick={state.toggle}>
      {children}
      <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
  );
}
