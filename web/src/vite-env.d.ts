/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dónde se leen latest.json e history.json; sin definir, de public/data */
  readonly VITE_DATA_URL?: string;
}
