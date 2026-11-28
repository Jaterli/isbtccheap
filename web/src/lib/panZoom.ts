import { useEffect, useRef, useState, type PointerEvent } from "react";

/**
 * Desplazar y hacer zoom en una gráfica de series largas (como el score diario frente al precio, HistoryChart): arrastrar
 * con el ratón o un dedo para desplazar, pellizcar con dos dedos o Ctrl + rueda para el zoom, y la rueda horizontal (o
 * Mayús + rueda) para desplazar; la rueda normal sigue moviendo la página. En pantallas táctiles el gesto vertical sigue
 * siendo de la página (touch-action: pan-y en la gráfica): solo el horizontal mueve la gráfica.
 *
 * La ventana visible son índices fraccionarios del primer y último punto. La de partida son los últimos `initialSpan`
 * puntos (toda la serie si no se indica); se vuelve a ella al cambiar `resetKey` (otra serie, otra temporalidad o
 * periodo) y la sigue mientras no se mueva la gráfica (si cambia el ancho, por ejemplo).
 */
export interface View {
  start: number;
  end: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function clampView(start: number, span: number, n: number, minSpan: number): View {
  const maxSpan = Math.max(1, n - 1);
  const s = clamp(span, Math.min(minSpan, maxSpan), maxSpan);
  const st = clamp(start, 0, n - 1 - s);
  return { start: st, end: st + s };
}

export function usePanZoom(n: number, padL: number, plotW: number, minSpan: number, resetKey: string, initialSpan = Infinity) {
  const initial = (): View => clampView(n - 1 - initialSpan, Math.min(initialSpan, n - 1), n, minSpan);
  // null: la de partida; con un desplazamiento o zoom, la elegida
  const [custom, setCustom] = useState<View | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => setCustom(null), [resetKey]);

  // La ventana puede quedar fuera si la serie se acorta sin cambiar de clave
  const v = custom && custom.end <= n - 1 ? custom : initial();
  // Desde el último estado (con varios movimientos de rueda seguidos, antes de pintarse) o, si no hay, desde la de partida
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const nRef = useRef(n);
  nRef.current = n;
  const setView = (f: View | ((w: View) => View)) =>
    setCustom((prev) => {
      const base = prev && prev.end <= nRef.current - 1 ? prev : initialRef.current();
      return typeof f === "function" ? f(base) : f;
    });
  const setViewRef = useRef(setView);
  setViewRef.current = setView;
  const span = v.end - v.start;
  const zoomed = span < n - 1 - 0.5;
  const relX = (clientX: number) => (clientX - (svgRef.current?.getBoundingClientRect().left ?? 0) - padL) / plotW;

  const zoomAt = (factor: number, fx: number) =>
    setView((w) => {
      const s0 = w.end - w.start;
      const s = clamp(s0 * factor, Math.min(minSpan, n - 1), n - 1);
      return clampView(w.start + fx * s0 - fx * s, s, n, minSpan);
    });

  // Rueda: con Ctrl o Cmd (también el pellizco del trackpad), zoom; horizontal o con Mayús, desplazamiento
  const ref = useRef({ n, minSpan, plotW, padL });
  ref.current = { n, minSpan, plotW, padL };
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const zooming = e.ctrlKey || e.metaKey;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!zooming && !horizontal && !e.shiftKey) return;
      e.preventDefault();
      const c = ref.current;
      const fx = clamp((e.clientX - el.getBoundingClientRect().left - c.padL) / c.plotW, 0, 1);
      setViewRef.current((w) => {
        const s0 = w.end - w.start;
        if (zooming) {
          const s = clamp(s0 * Math.exp(e.deltaY * 0.003), Math.min(c.minSpan, c.n - 1), c.n - 1);
          return clampView(w.start + fx * s0 - fx * s, s, c.n, c.minSpan);
        }
        const delta = ((horizontal ? e.deltaX : e.deltaY) / c.plotW) * s0;
        return clampView(w.start + delta, s0, c.n, c.minSpan);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Arrastrar (1 dedo o ratón) y pellizcar (2 dedos)
  const pointers = useRef(new Map<number, number>());
  const gesture = useRef<{ view: View; anchor: number; dist: number; x0: number; moved: boolean } | null>(null);
  const baseline = () => {
    const xs = [...pointers.current.values()];
    if (!xs.length) return void (gesture.current = null);
    const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
    gesture.current = {
      view: v,
      anchor: v.start + relX(mid) * span,
      dist: xs.length > 1 ? Math.abs(xs[0] - xs[1]) : 0,
      x0: mid,
      moved: gesture.current?.moved ?? false,
    };
  };
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, e.clientX);
    baseline();
  };
  /** Devuelve true si la gráfica se ha movido (entonces no se actualiza la lectura) */
  const onPointerMove = (e: PointerEvent<SVGSVGElement>): boolean => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return false;
    pointers.current.set(e.pointerId, e.clientX);
    const xs = [...pointers.current.values()];
    const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
    if (!g.moved && xs.length === 1 && Math.abs(mid - g.x0) < 4) return false; // un clic no mueve el gráfico
    g.moved = true;
    const s0 = g.view.end - g.view.start;
    const s = clamp(xs.length > 1 && g.dist > 0 ? s0 * (g.dist / Math.max(1, Math.abs(xs[0] - xs[1]))) : s0, Math.min(minSpan, n - 1), n - 1);
    setView(clampView(g.anchor - relX(mid) * s, s, n, minSpan));
    return true;
  };
  const onPointerEnd = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current) gesture.current.moved = false;
    baseline();
  };

  return {
    view: v,
    span,
    zoomed,
    svgRef,
    /** El índice bajo una posición x de la pantalla */
    indexAt: (clientX: number) => Math.round(v.start + clamp(relX(clientX), 0, 1) * span),
    zoomIn: () => zoomAt(0.6, 0.5),
    zoomOut: () => zoomAt(1 / 0.6, 0.5),
    reset: () => setCustom(null),
    handlers: { onPointerDown, onPointerMove, onPointerEnd },
  };
}
