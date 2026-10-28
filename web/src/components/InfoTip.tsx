import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "../i18n";

interface Props {
  /** Para lectores de pantalla */
  label: string;
  title?: string;
  children: ReactNode;
}

const MARGIN = 12;
const MAX_WIDTH = 340;

interface Pos {
  top: number;
  left: number;
  width: number;
  /** Solo si no cabe ni debajo ni encima */
  maxHeight?: number;
}

/** Se abre al pasar el ratón o al enfocarlo; con clic queda fija. Se pinta en <body> con posición fija para que no lo
 * recorte una tarjeta. */
export function InfoTip({ label, title, children }: Props) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const open = hovered || pinned;

  const close = () => {
    setPinned(false);
    setHovered(false);
  };

  // Debajo si cabe, si no encima; si no cabe en ninguno, en el de más espacio con el alto limitado
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return setPos(null);
    const r = btnRef.current.getBoundingClientRect();
    const width = Math.min(MAX_WIDTH, window.innerWidth - MARGIN * 2);
    const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - width / 2), window.innerWidth - MARGIN - width);
    const h = popRef.current?.scrollHeight ?? 0;
    const below = r.bottom + 8;
    const spaceBelow = window.innerHeight - MARGIN - below;
    const spaceAbove = r.top - 8 - MARGIN;
    let next: Pos;
    if (h <= spaceBelow) next = { top: below, left, width };
    else if (h <= spaceAbove) next = { top: r.top - 8 - h, left, width };
    else if (spaceBelow >= spaceAbove) next = { top: below, left, width, maxHeight: spaceBelow };
    else next = { top: MARGIN, left, width, maxHeight: spaceAbove };
    setPos((p) =>
      p && p.top === next.top && p.left === next.left && p.width === next.width && p.maxHeight === next.maxHeight ? p : next,
    );
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
        aria-label={t.infoAbout(label)}
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
            style={
              pos
                ? { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, overflowY: pos.maxHeight ? "auto" : undefined }
                : { visibility: "hidden", top: 0, left: 0, width: MAX_WIDTH }
            }
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
