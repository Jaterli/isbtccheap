import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** Qué explica, para lectores de pantalla: "Información sobre {label}" */
  label: string;
  title?: string;
  children: ReactNode;
}

const MARGIN = 12;

/** Icono (i) con una explicación. Se abre al pasar el ratón o al enfocarlo; con clic/toque queda fija.
 * El panel se pinta en <body> con posición fija para que nunca lo recorte una tarjeta ni se salga de la pantalla. */
export function InfoTip({ label, title, children }: Props) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const open = hovered || pinned;

  const close = () => {
    setPinned(false);
    setHovered(false);
  };

  // Colocación: debajo del icono si cabe, si no encima; siempre dentro del ancho de la pantalla
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return setPos(null);
    const r = btnRef.current.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - MARGIN * 2);
    const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - width / 2), window.innerWidth - MARGIN - width);
    const h = popRef.current?.offsetHeight ?? 0;
    const below = r.bottom + 8;
    const top = below + h > window.innerHeight - MARGIN && r.top - 8 - h > MARGIN ? r.top - 8 - h : below;
    setPos((p) => (p && p.top === top && p.left === left && p.width === width ? p : { top, left, width }));
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`info-btn${open ? " open" : ""}`}
        aria-label={`Información sobre ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => (pinned ? close() : setPinned(true))}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => !pinned && setHovered(false)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" />
          <line x1="8" y1="7" x2="8" y2="11.5" />
          <circle cx="8" cy="4.6" r="0.6" className="dot" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            id={id}
            role="tooltip"
            className="info-pop"
            style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: "hidden", top: 0, left: 0 }}
            onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
          >
            {title && <strong className="info-title">{title}</strong>}
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
