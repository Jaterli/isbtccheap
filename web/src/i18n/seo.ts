/**
 * Texto de presentación y preguntas frecuentes de cada idioma. Lo usan:
 *  - components/Faq.tsx: la sección visible de la página (Google indexa la página ya pintada por React).
 *  - vite.config.ts: el mismo texto en el HTML inicial, para los rastreadores que no ejecutan JavaScript.
 * Texto plano, sin JSX: vite.config.ts lo convierte a HTML al compilar.
 */
export interface SeoText {
  title: string;
  intro: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
}

export const SEO: Record<"es" | "en", SeoText> = {
  es: {
    title: "¿Está Bitcoin barato o caro?",
    intro:
      "Is BTC Cheap? estima si Bitcoin está barato o caro con un índice de 1 a 100. Combina métricas de valoración on-chain, del ciclo de cuatro años de los halvings, de la liquidez global, del sentimiento del mercado y de análisis técnico, y se puede consultar en temporalidades de 1 hora a 1 mes.",
    faqTitle: "Preguntas frecuentes",
    faq: [
      {
        q: "¿Cómo se calcula el índice?",
        a: "Cada métrica se convierte en una puntuación de 0 (barato) a 100 (caro) según su percentil frente a los últimos 4 años, un ciclo de halving completo. Las métricas se agrupan en cinco categorías, cada categoría pesa según la temporalidad elegida y el resultado se reescala de 1 a 100.",
      },
      {
        q: "¿Qué métricas utiliza?",
        a: "Valoración on-chain: MVRV, Puell Multiple y Mayer Multiple. Ciclo: fase del ciclo de halving, desviación de la power law y distancia a la media de 200 semanas. Liquidez: liquidez neta de la Reserva Federal, masa monetaria M2, fuerza del dólar y oferta de stablecoins. Sentimiento: Fear & Greed Index, funding rate y, en 1 h y 4 h, apalancamiento y posiciones en los futuros de Binance. Técnico: RSI, bandas de Bollinger y distancia a la media móvil.",
      },
      {
        q: "¿Qué temporalidad debo mirar?",
        a: "En 1 hora y 4 horas pesan más el análisis técnico y el sentimiento, y el índice responde a los movimientos del momento. En 1 día, 1 semana y 1 mes pesan más la valoración on-chain y el ciclo, que indican si Bitcoin está caro o barato a medio y largo plazo.",
      },
      {
        q: "¿Ha acertado en el pasado?",
        a: "En el histórico, el índice marcó entre 7 y 9 en los suelos de 2015, 2018, 2020 y 2022, y entre 85 y 98 en los techos de 2013, 2017, 2021, 2024 y 2025. Bitcoin solo tiene unos pocos ciclos completos, así que estos resultados describen el pasado y no garantizan el futuro.",
      },
      {
        q: "¿Cada cuánto se actualiza?",
        a: "Las métricas on-chain, de ciclo y de liquidez se recalculan una vez al día. El precio, el análisis técnico y los datos de derivados se actualizan en vivo cada pocos minutos. Las noticias se renuevan cada 15 minutos en horario de mercado y la agenda económica, cada hora.",
      },
      {
        q: "¿De dónde salen los datos?",
        a: "De fuentes públicas: Coin Metrics, Alternative.me, FRED (Reserva Federal de St. Louis), DefiLlama, Binance, Forex Factory y medios como Cointelegraph, CoinDesk, Decrypt, Investing.com, CNBC y BBC.",
      },
      {
        q: "¿Es una recomendación de inversión?",
        a: "No. Is BTC Cheap? es una herramienta informativa y gratuita, sin publicidad. No constituye asesoramiento financiero: cualquier decisión de inversión es responsabilidad de cada persona.",
      },
    ],
  },
  en: {
    title: "Is Bitcoin cheap or expensive?",
    intro:
      "Is BTC Cheap? estimates whether Bitcoin is cheap or expensive with a 1 to 100 index. It combines on-chain valuation, the four-year halving cycle, global liquidity, market sentiment and technical analysis metrics, and can be checked on timeframes from 1 hour to 1 month.",
    faqTitle: "Frequently asked questions",
    faq: [
      {
        q: "How is the index calculated?",
        a: "Each metric is turned into a score from 0 (cheap) to 100 (expensive) based on its percentile over the last 4 years, a full halving cycle. Metrics are grouped into five categories, each category is weighted according to the selected timeframe, and the result is rescaled from 1 to 100.",
      },
      {
        q: "Which metrics does it use?",
        a: "On-chain valuation: MVRV, Puell Multiple and Mayer Multiple. Cycle: halving cycle phase, power law deviation and distance to the 200-week moving average. Liquidity: Federal Reserve net liquidity, M2 money supply, dollar strength and stablecoin supply. Sentiment: Fear & Greed Index, funding rate and, on 1h and 4h, leverage and positioning in Binance futures. Technical: RSI, Bollinger Bands and distance to the moving average.",
      },
      {
        q: "Which timeframe should I look at?",
        a: "On 1 hour and 4 hours, technical analysis and sentiment weigh more, and the index reacts to current moves. On 1 day, 1 week and 1 month, on-chain valuation and the cycle weigh more, showing whether Bitcoin is cheap or expensive over the medium and long term.",
      },
      {
        q: "Has it worked in the past?",
        a: "Historically, the index read between 7 and 9 at the 2015, 2018, 2020 and 2022 bottoms, and between 85 and 98 at the 2013, 2017, 2021, 2024 and 2025 tops. Bitcoin has only had a few full cycles, so these results describe the past and do not guarantee the future.",
      },
      {
        q: "How often is it updated?",
        a: "On-chain, cycle and liquidity metrics are recalculated once a day. Price, technical analysis and derivatives data update live every few minutes. News refreshes every 15 minutes during market hours and the economic calendar every hour.",
      },
      {
        q: "Where does the data come from?",
        a: "From public sources: Coin Metrics, Alternative.me, FRED (Federal Reserve Bank of St. Louis), DefiLlama, Binance, Forex Factory and outlets such as Cointelegraph, CoinDesk, Decrypt, Investing.com, CNBC and BBC.",
      },
      {
        q: "Is this investment advice?",
        a: "No. Is BTC Cheap? is a free, ad-free informational tool. It is not financial advice: every investment decision is each person's own responsibility.",
      },
    ],
  },
};
