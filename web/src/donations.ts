/** Datos de donación. Deja una cadena vacía para ocultar ese método; si todos están vacíos no se muestra la sección. */

/** Enlace de PayPal.me, p. ej. "https://paypal.me/tu_usuario" */
export const PAYPAL_URL = "https://paypal.me/Jaterli";

export interface CryptoMethod {
  id: string;
  label: string;
  /** Dirección pública o Lightning address */
  address: string;
  /** Enlace que abre la app de wallet del usuario */
  uri: (address: string) => string;
}
// La explicación de cada método está en i18n (t.donate.hints, por id)

export const CRYPTO: CryptoMethod[] = [
  {
    id: "btc",
    label: "Bitcoin",
    address: "3PaRjB5uzksnyQaggVxrhknWSoi1pPUBkT", // dirección on-chain, p. ej. bc1q…
    uri: (a) => `bitcoin:${a}`,
  },
  {
    id: "ln",
    label: "Lightning",
    address: "", // Lightning address, p. ej. usuario@walletofsatoshi.com
    uri: (a) => `lightning:${a}`,
  },
];
