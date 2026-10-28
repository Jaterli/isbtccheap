// JSON del pipeline: del repositorio de GitHub (ver web/.env)
const DATA = import.meta.env.VITE_DATA_URL ?? `${import.meta.env.BASE_URL}data`;

export const getJson = (path: string) => fetch(`${DATA}/${path}`, { cache: "no-cache" }).then((r) => r.json());
