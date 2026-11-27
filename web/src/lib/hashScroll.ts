import { useEffect } from "react";

/**
 * Lleva a la tarjeta `id` si la URL apunta a ella (#id) en cuanto está pintada (`ready`). Las tarjetas que esperan a sus
 * datos no existen cuando el navegador busca el ancla al abrir la página, y se quedaba arriba. Un segundo intento poco
 * después, por si lo que hay encima termina de cargar y la mueve (solo si no se ha desplazado nadie desde el primero).
 */
export function useHashScroll(id: string, ready: boolean) {
  useEffect(() => {
    if (!ready || window.location.hash !== `#${id}`) return;
    let y = -1;
    const go = () => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
      y = window.scrollY;
    };
    const raf = requestAnimationFrame(go);
    const again = window.setTimeout(() => {
      if (window.scrollY === y && window.location.hash === `#${id}`) go();
    }, 700);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(again);
    };
  }, [id, ready]);
}
