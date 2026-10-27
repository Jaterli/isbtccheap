// JSON del pipeline (latest.json, history.json): del repositorio en producción, de public/data en local (ver web/.env)
const DATA = import.meta.env.VITE_DATA_URL ?? `${import.meta.env.BASE_URL}data`;

export const getJson = (path: string) => fetch(`${DATA}/${path}`, { cache: "no-cache" }).then((r) => r.json());
