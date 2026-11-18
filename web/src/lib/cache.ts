/**
 * Caché de las peticiones a APIs externas (Binance, Bitview): en memoria y en sessionStorage, para no volver a pedir lo
 * mismo al cambiar de temporalidad o de página dentro de la web. sessionStorage se borra al cerrar la pestaña; si no está
 * disponible (navegación privada, cuota llena), queda solo la memoria y, si no, se pide como siempre.
 */

const PREFIX = "isbtccheap:api:";
const MIN = 60_000;

interface Entry {
  at: number;
  data: unknown;
}

const memory = new Map<string, Entry>();
// Peticiones en curso: dos componentes que piden lo mismo a la vez comparten la respuesta
const pending = new Map<string, Promise<unknown>>();

/**
 * Cuánto vale una respuesta, según lo que es. Con endTime en el pasado las velas ya están cerradas y no cambian; sin él,
 * la última vela va en curso: cuanto más corta la vela, antes caduca. Una sola vela es el precio en vivo de las páginas.
 */
export function ttlFor(url: string): number {
  if (url.includes("bitview")) return 60 * MIN; // on-chain diario
  if (url.includes("/futures/data/")) return 5 * MIN; // derivados, cada 4 h o cada hora
  const interval = /interval=([0-9]+[mhdwM])/.exec(url)?.[1];
  const end = /endTime=(\d+)/.exec(url)?.[1];
  if (end && Number(end) < Date.now() - 2 * MIN) return 6 * 60 * MIN;
  if (/limit=1(&|$)/.test(url)) return MIN;
  const byInterval: Record<string, number> = { "1m": 0.5 * MIN, "5m": 0.5 * MIN, "15m": MIN, "1h": 2 * MIN, "4h": 5 * MIN, "1d": 10 * MIN, "1w": 30 * MIN, "1M": 60 * MIN };
  return interval ? (byInterval[interval] ?? MIN) : MIN;
}

function readStored(url: string): Entry | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + url);
    return raw ? (JSON.parse(raw) as Entry) : null;
  } catch {
    return null;
  }
}

function store(url: string, entry: Entry) {
  try {
    sessionStorage.setItem(PREFIX + url, JSON.stringify(entry));
  } catch {
    // Cuota llena: se borran las respuestas guardadas (solo las nuestras) y se prueba una vez más
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k?.startsWith(PREFIX)) sessionStorage.removeItem(k);
      }
      sessionStorage.setItem(PREFIX + url, JSON.stringify(entry));
    } catch {
      /* sin almacenamiento: queda en memoria */
    }
  }
}

/** JSON de `url`, de la caché si no ha caducado; si no, se pide (con `timeoutMs`) y se guarda. Los errores no se guardan. */
export async function cachedJson<T>(url: string, timeoutMs: number, label: string): Promise<T> {
  // Un 10 % antes de tiempo: los refrescos automáticos de la portada van al mismo ritmo que estas caducidades, y uno que
  // llegara justo antes de caducar recibiría el dato viejo y el siguiente se retrasaría un intervalo entero
  const ttl = ttlFor(url) * 0.9;
  const now = Date.now();
  const hit = memory.get(url) ?? readStored(url);
  if (hit && now - hit.at < ttl) {
    memory.set(url, hit);
    return hit.data as T;
  }
  const inFlight = pending.get(url);
  if (inFlight) return inFlight as Promise<T>;
  const p = (async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`${label} ${res.status}`);
    const data = (await res.json()) as T;
    const entry = { at: Date.now(), data };
    memory.set(url, entry);
    store(url, entry);
    return data;
  })();
  pending.set(url, p);
  try {
    return await p;
  } finally {
    pending.delete(url);
  }
}
