/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dónde se leen latest.json e history.json (ver web/.env); sin definir, de public/data */
  readonly VITE_DATA_URL?: string;
}
