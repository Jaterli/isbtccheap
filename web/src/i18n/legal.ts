/**
 * Aviso legal, privacidad y cookies. Texto plano (sin JSX) para que vite.config.ts lo use también en el HTML inicial.
 * Los enlaces se escriben [texto](url).
 */
export type LegalPage = "legal" | "privacy" | "cookies";

export interface LegalSection {
  h: string;
  p?: string[];
  list?: string[];
  /** Primera fila: cabecera */
  table?: string[][];
  /** Párrafos después de la lista o la tabla */
  after?: string[];
}

export interface LegalText {
  title: string;
  rest: string;
  sections: LegalSection[];
}

const OWNER = "Jaime Terciado Lirola";
const EMAIL = "jaime.terciado@gmail.com";
const MAIL = `[${EMAIL}](mailto:${EMAIL})`;
/** Cambia al modificar cualquiera de los textos */
const UPDATED = { es: "31 de octubre de 2026", en: "October 31, 2026" };

const BINANCE_PRIVACY = "https://www.binance.com/en/privacy";
const GITHUB_PRIVACY = "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement";
const PAYPAL_PRIVACY = "https://www.paypal.com/es/legalhub/paypal/privacy-full";

/** Claves de localStorage: cada una con su uso */
const STORAGE: { key: string; es: string; en: string }[] = [
  { key: "isbtccheap:lang", es: "Idioma que has elegido", en: "Language you chose" },
  { key: "isbtccheap:tf", es: "Temporalidad del índice", en: "Index timeframe" },
  { key: "isbtccheap:hero-view", es: "Si la tarjeta principal muestra el score o el precio", en: "Whether the main card shows the score or the price" },
  { key: "isbtccheap:price-tf, isbtccheap:price-height", es: "Temporalidad y alto del gráfico del precio", en: "Price chart timeframe and height" },
  { key: "isbtccheap:feed", es: "Pestaña de noticias o agenda", en: "News or calendar tab" },
  { key: "isbtccheap:chart-heights", es: "Altura de las gráficas del histórico", en: "Height of the history charts" },
  { key: "isbtccheap:outlook-period, isbtccheap:moves-period", es: "Periodo de las tablas del índice", en: "Period of the index tables" },
  { key: "isbtccheap:vol-tf, isbtccheap:vol-range", es: "Temporalidad y rango de la volatilidad", en: "Volatility timeframe and range" },
  {
    key: "isbtccheap:valuation-range, isbtccheap:drawdown-range, isbtccheap:categories-range, isbtccheap:etf-range, isbtccheap:liquidity-range",
    es: "Rango de fechas de cada gráfica",
    en: "Date range of each chart",
  },
  { key: "isbtccheap:cycles-hidden", es: "Ciclos que has ocultado", en: "Cycles you hid" },
];

export const LEGAL: Record<LegalPage, Record<"es" | "en", LegalText>> = {
  legal: {
    es: {
      title: "Aviso legal",
      rest: `Quién está detrás de Is BTC Cheap? y en qué condiciones se ofrece. Última actualización: ${UPDATED.es}.`,
      sections: [
        {
          h: "Titular",
          p: [
            `En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se informa de que el titular de isbtccheap.com es ${OWNER}, particular residente en España. Contacto: ${MAIL}.`,
            "Is BTC Cheap? es un proyecto personal sin ánimo de lucro: se usa gratis y sin registro, y se mantiene con donaciones voluntarias que no dan derecho a ninguna contraprestación.",
          ],
        },
        {
          h: "Objeto",
          p: [
            "La web ofrece información y herramientas sobre el mercado de Bitcoin: un índice de 1 a 100 que estima si está barato o caro, gráficas de valoración, ciclos, volatilidad, caídas, liquidez y ETF, noticias y agenda económica, y un análisis diario del precio generado con inteligencia artificial.",
          ],
        },
        {
          h: "No es asesoramiento financiero",
          p: [
            "Nada de lo publicado en esta web constituye asesoramiento financiero, de inversión, fiscal ni legal, ni una recomendación de comprar, vender o mantener Bitcoin u otro activo. El titular no es una empresa de servicios de inversión ni está registrado en la CNMV.",
            "Invertir en criptoactivos tiene un riesgo muy alto y puede suponer la pérdida de todo el capital. Los datos históricos no garantizan resultados futuros. Cualquier decisión que tomes es solo tuya y bajo tu responsabilidad.",
          ],
        },
        {
          h: "Contenido automático e inteligencia artificial",
          p: [
            "Los datos proceden de fuentes de terceros y se procesan de forma automática. El análisis diario del precio, la traducción y la clasificación de las noticias los genera un modelo de inteligencia artificial sin revisión humana: pueden contener errores, datos desfasados o conclusiones equivocadas.",
          ],
        },
        {
          h: "Responsabilidad",
          p: [
            "El titular no garantiza que la información sea exacta, completa o esté actualizada, ni que la web esté siempre disponible, y no responde de los daños que puedan derivarse de su uso, de errores en los datos de las fuentes o de interrupciones del servicio.",
          ],
        },
        {
          h: "Enlaces",
          p: [
            "La web enlaza con sitios de terceros (fuentes de datos, medios de noticias, PayPal). El titular no controla esos sitios ni responde de sus contenidos o de sus políticas.",
          ],
        },
        {
          h: "Propiedad intelectual",
          p: [
            `El diseño, los textos, el código y el logotipo de Is BTC Cheap? pertenecen a ${OWNER}, salvo que se indique otra cosa. Los datos y los titulares de noticias pertenecen a sus fuentes, que se citan en cada página; los flujos de los ETF son de TFTC bajo licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`,
            "Puedes citar y enlazar la web indicando la fuente. Para reproducir su contenido de forma sistemática, pide permiso antes.",
          ],
        },
        {
          h: "Legislación aplicable",
          p: [
            "Este aviso legal se rige por la legislación española. Consulta también la [política de privacidad](/privacidad/) y la [política de cookies](/cookies/).",
          ],
        },
      ],
    },
    en: {
      title: "Legal notice",
      rest: `Who is behind Is BTC Cheap? and on what terms it is offered. Last updated: ${UPDATED.en}.`,
      sections: [
        {
          h: "Owner",
          p: [
            `In accordance with article 10 of Spanish Law 34/2002 on information society services and electronic commerce (LSSI-CE), the owner of isbtccheap.com is ${OWNER}, a private individual resident in Spain. Contact: ${MAIL}.`,
            "Is BTC Cheap? is a non-profit personal project: it is free to use with no sign-up, and it is kept running by voluntary donations that give no right to anything in return.",
          ],
        },
        {
          h: "Purpose",
          p: [
            "The site offers information and tools about the Bitcoin market: a 1 to 100 index that estimates whether it is cheap or expensive, charts of valuation, cycles, volatility, drawdowns, liquidity and ETFs, news and an economic calendar, and a daily price analysis generated with artificial intelligence.",
          ],
        },
        {
          h: "Not financial advice",
          p: [
            "Nothing published on this site is financial, investment, tax or legal advice, nor a recommendation to buy, sell or hold Bitcoin or any other asset. The owner is not an investment firm and is not registered with the CNMV (the Spanish securities regulator) or any other regulator.",
            "Investing in crypto-assets is very high risk and can result in the loss of all your capital. Past data does not guarantee future results. Any decision you make is yours alone and at your own risk.",
          ],
        },
        {
          h: "Automated content and artificial intelligence",
          p: [
            "The data comes from third-party sources and is processed automatically. The daily price analysis and the translation and classification of the news are generated by an artificial intelligence model with no human review: they may contain errors, outdated data or wrong conclusions.",
          ],
        },
        {
          h: "Liability",
          p: [
            "The owner does not guarantee that the information is accurate, complete or up to date, nor that the site is always available, and is not liable for any damage arising from its use, from errors in the source data or from service interruptions.",
          ],
        },
        {
          h: "Links",
          p: [
            "The site links to third-party sites (data sources, news outlets, PayPal). The owner does not control those sites and is not responsible for their content or policies.",
          ],
        },
        {
          h: "Intellectual property",
          p: [
            `The design, texts, code and logo of Is BTC Cheap? belong to ${OWNER} unless stated otherwise. The data and news headlines belong to their sources, credited on each page; ETF flows are from TFTC under a [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) licence.`,
            "You may quote and link to the site, citing the source. To reproduce its content systematically, ask for permission first.",
          ],
        },
        {
          h: "Governing law",
          p: [
            "This legal notice is governed by Spanish law. See also the [privacy policy](/en/privacy/) and the [cookie policy](/en/cookies/).",
          ],
        },
      ],
    },
  },

  privacy: {
    es: {
      title: "Política de privacidad",
      rest: `Qué datos personales se tratan al usar Is BTC Cheap? y qué derechos tienes. Última actualización: ${UPDATED.es}.`,
      sections: [
        {
          h: "Responsable",
          p: [
            `${OWNER}, particular residente en España. Para cualquier cuestión sobre tus datos: ${MAIL}.`,
            "En pocas palabras: la web no tiene registro, formularios, cookies ni analítica, y no te pide ningún dato. Solo se tratan los datos técnicos que cualquier servidor web recibe al visitarlo.",
          ],
        },
        {
          h: "Registros del servidor",
          p: [
            "Cada vez que visitas una página, el servidor anota tu dirección IP, la fecha y hora, la dirección pedida, el navegador que usas y la página de la que vienes.",
          ],
          list: [
            "Para qué: que la web funcione, protegerla de abusos y ataques y resolver errores.",
            "Base legal: el interés legítimo en mantener el servicio seguro y en funcionamiento (artículo 6.1.f del RGPD).",
            "Cuánto tiempo: 14 días; después se borran.",
            "No se usan para identificarte ni para crear perfiles, y no se ceden a nadie salvo obligación legal.",
          ],
        },
        {
          h: "Si escribes por email",
          p: [
            "Se usan tu dirección y lo que cuentes solo para responderte, con tu consentimiento como base legal, y se conservan el tiempo necesario para atender tu mensaje. El correo lo gestiona Gmail (Google).",
          ],
        },
        {
          h: "Donaciones",
          p: [
            `Las donaciones con PayPal se hacen en su web: PayPal es responsable de esos datos según su [política de privacidad](${PAYPAL_PRIVACY}). El titular solo ve lo que PayPal muestra en el movimiento (normalmente nombre y email) y no lo usa para nada más.`,
            "Las donaciones en Bitcoin quedan en la cadena de bloques, que es pública, pero la web no las asocia a ninguna persona.",
          ],
        },
        {
          h: "Servicios a los que se conecta tu navegador",
          p: [
            "Para mostrar el precio en directo y los datos diarios, tu navegador los pide directamente a estos servicios, que reciben tu IP y tu navegador como cualquier web que visitas. No se les envían cookies ni ningún otro dato, y cada uno los trata según su propia política:",
          ],
          list: [
            `Binance (api.binance.com y fapi.binance.com): precio de BTC y datos de derivados. [Política de privacidad](${BINANCE_PRIVACY}).`,
            `GitHub (raw.githubusercontent.com): datos del índice que se recalculan cada día. [Política de privacidad](${GITHUB_PRIVACY}).`,
          ],
        },
        {
          h: "Proveedores y transferencias internacionales",
          p: [
            "La web se aloja en un servidor de DigitalOcean, que trata los registros del servidor por cuenta del titular. DigitalOcean, Google, GitHub y Binance pueden tratar datos fuera del Espacio Económico Europeo; en el caso de los proveedores del titular, con las garantías que exige el RGPD (Marco de Privacidad de Datos UE-EE. UU. o cláusulas contractuales tipo de la Comisión Europea).",
          ],
        },
        {
          h: "Tus derechos",
          p: [
            `Puedes pedir el acceso, la rectificación o la supresión de tus datos, oponerte a su tratamiento o pedir que se limite, y la portabilidad, escribiendo a ${MAIL}. Ten en cuenta que, con solo una dirección IP, puede no ser posible saber qué registros son tuyos.`,
            "Si crees que no se han respetado tus derechos, puedes reclamar ante la [Agencia Española de Protección de Datos](https://www.aepd.es).",
          ],
        },
        {
          h: "Cambios",
          p: [
            "Si cambia lo que se hace con los datos (por ejemplo, si se añadiera analítica), se actualizará esta página y su fecha. Consulta también el [aviso legal](/aviso-legal/) y la [política de cookies](/cookies/).",
          ],
        },
      ],
    },
    en: {
      title: "Privacy policy",
      rest: `What personal data is processed when you use Is BTC Cheap? and what your rights are. Last updated: ${UPDATED.en}.`,
      sections: [
        {
          h: "Controller",
          p: [
            `${OWNER}, a private individual resident in Spain. For any question about your data: ${MAIL}.`,
            "In short: the site has no sign-up, forms, cookies or analytics, and asks you for no data. Only the technical data that any web server receives when you visit it is processed.",
          ],
        },
        {
          h: "Server logs",
          p: [
            "Each time you visit a page, the server records your IP address, the date and time, the address requested, the browser you use and the page you came from.",
          ],
          list: [
            "Why: to keep the site working, protect it from abuse and attacks, and fix errors.",
            "Legal basis: the legitimate interest in keeping the service secure and running (article 6(1)(f) GDPR).",
            "How long: 14 days; after that they are deleted.",
            "They are not used to identify you or build profiles, and they are not shared with anyone unless required by law.",
          ],
        },
        {
          h: "If you write by email",
          p: [
            "Your address and whatever you write are used only to reply to you, with your consent as the legal basis, and are kept for as long as needed to deal with your message. Email is handled by Gmail (Google).",
          ],
        },
        {
          h: "Donations",
          p: [
            `PayPal donations are made on PayPal's site: PayPal is responsible for that data under its [privacy policy](${PAYPAL_PRIVACY}). The owner only sees what PayPal shows in the transaction (usually name and email) and uses it for nothing else.`,
            "Bitcoin donations are recorded on the blockchain, which is public, but the site does not link them to any person.",
          ],
        },
        {
          h: "Services your browser connects to",
          p: [
            "To show the live price and the daily data, your browser requests them directly from these services, which receive your IP and browser as any site you visit does. No cookies or other data are sent to them, and each one processes it under its own policy:",
          ],
          list: [
            `Binance (api.binance.com and fapi.binance.com): BTC price and derivatives data. [Privacy policy](${BINANCE_PRIVACY}).`,
            `GitHub (raw.githubusercontent.com): index data recalculated every day. [Privacy policy](${GITHUB_PRIVACY}).`,
          ],
        },
        {
          h: "Providers and international transfers",
          p: [
            "The site is hosted on a DigitalOcean server, which processes the server logs on the owner's behalf. DigitalOcean, Google, GitHub and Binance may process data outside the European Economic Area; for the owner's providers, with the safeguards required by the GDPR (the EU-US Data Privacy Framework or the European Commission's standard contractual clauses).",
          ],
        },
        {
          h: "Your rights",
          p: [
            `You can ask for access to, rectification or erasure of your data, object to or restrict its processing, and ask for portability, by writing to ${MAIL}. Bear in mind that with only an IP address it may not be possible to tell which records are yours.`,
            "If you think your rights have not been respected, you can complain to the [Spanish Data Protection Agency (AEPD)](https://www.aepd.es) or the authority of your country.",
          ],
        },
        {
          h: "Changes",
          p: [
            "If what is done with the data changes (for example, if analytics were added), this page and its date will be updated. See also the [legal notice](/en/legal-notice/) and the [cookie policy](/en/cookies/).",
          ],
        },
      ],
    },
  },

  cookies: {
    es: {
      title: "Política de cookies",
      rest: `Qué guarda Is BTC Cheap? en tu navegador. Última actualización: ${UPDATED.es}.`,
      sections: [
        {
          h: "Sin cookies",
          p: [
            "Esta web no usa cookies, ni propias ni de terceros. No hay analítica, publicidad ni botones de redes sociales que te sigan entre webs. Por eso no ves ningún aviso de cookies.",
          ],
        },
        {
          h: "Preferencias en tu navegador",
          p: [
            "Para recordar lo que eliges (idioma, temporalidad, rango de las gráficas…), la web lo guarda en el almacenamiento local (localStorage) de tu navegador. Estos datos no salen de tu dispositivo ni se envían al servidor, y se quedan hasta que los borres.",
            "Son preferencias que tú mismo eliges, así que están exentas de consentimiento según el artículo 22.2 de la LSSI y la guía sobre cookies de la AEPD. Son estas:",
          ],
          table: [["Clave", "Para qué"], ...STORAGE.map((s) => [s.key, s.es])],
          after: [
            "Para borrarlas, elimina los datos de isbtccheap.com en la configuración de privacidad de tu navegador. Si navegas en modo privado, se borran al cerrar la ventana.",
          ],
        },
        {
          h: "Servicios de terceros",
          p: [
            "Tu navegador pide el precio en directo a Binance y los datos diarios a GitHub, pero sin cookies: esas peticiones no envían ni guardan ninguna. Si vas a PayPal para donar, allí se aplica la política de cookies de PayPal.",
          ],
        },
        {
          h: "Cambios",
          p: [
            "Si algún día se añadieran cookies que no sean técnicas, por ejemplo de analítica, se te pedirá permiso antes de usarlas y se actualizará esta página. Consulta también el [aviso legal](/aviso-legal/) y la [política de privacidad](/privacidad/).",
          ],
        },
      ],
    },
    en: {
      title: "Cookie policy",
      rest: `What Is BTC Cheap? stores in your browser. Last updated: ${UPDATED.en}.`,
      sections: [
        {
          h: "No cookies",
          p: [
            "This site uses no cookies, neither its own nor third-party ones. There are no analytics, ads or social media buttons that follow you across sites. That is why you see no cookie banner.",
          ],
        },
        {
          h: "Preferences in your browser",
          p: [
            "To remember what you choose (language, timeframe, chart range…), the site saves it in your browser's local storage (localStorage). This data never leaves your device, is not sent to the server, and stays until you delete it.",
            "These are preferences you choose yourself, so they are exempt from consent under article 22.2 of the Spanish LSSI and the AEPD cookie guidelines. They are:",
          ],
          table: [["Key", "Purpose"], ...STORAGE.map((s) => [s.key, s.en])],
          after: [
            "To delete them, clear the data for isbtccheap.com in your browser's privacy settings. In a private window they are deleted when you close it.",
          ],
        },
        {
          h: "Third-party services",
          p: [
            "Your browser requests the live price from Binance and the daily data from GitHub, but without cookies: those requests neither send nor store any. If you go to PayPal to donate, PayPal's cookie policy applies there.",
          ],
        },
        {
          h: "Changes",
          p: [
            "If non-technical cookies, such as analytics, were ever added, you would be asked for permission before they are used and this page would be updated. See also the [legal notice](/en/legal-notice/) and the [privacy policy](/en/privacy/).",
          ],
        },
      ],
    },
  },
};

/** Trozos de un párrafo: texto o enlace */
export function linkParts(s: string): ({ text: string } | { text: string; href: string })[] {
  const out: ({ text: string } | { text: string; href: string })[] = [];
  let last = 0;
  for (const m of s.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ text: m[1], href: m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}
