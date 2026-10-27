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

/** Página de volatilidad: texto visible bajo la gráfica y en el HTML inicial */
export interface VolSeoText {
  title: string;
  intro: string;
  sections: { h: string; p: string }[];
}

export const SEO_VOL: Record<"es" | "en", VolSeoText> = {
  es: {
    title: "Volatilidad de Bitcoin",
    intro:
      "Gráfico de la volatilidad realizada de Bitcoin en velas de 1 hora, 4 horas, 1 día y 1 semana, con el precio de BTC superpuesto.",
    sections: [
      {
        h: "¿Qué es la volatilidad realizada?",
        p: "Es la desviación típica de las variaciones del precio en las últimas velas, expresada en términos anuales. Un 50 % significa que, al ritmo actual, el precio suele moverse alrededor de un 50 % arriba o abajo en un año. Bitcoin ha bajado su volatilidad con los años: en sus primeros ciclos superaba a menudo el 100 %; en los últimos años se mueve entre el 25 % y el 80 %.",
      },
      {
        h: "¿Para qué sirve?",
        p: "La volatilidad tiende a volver a su nivel normal: los periodos de calma, con volatilidad muy baja, suelen terminar en movimientos fuertes, y los picos de volatilidad suelen coincidir con caídas bruscas o subidas verticales. Lo que la volatilidad no indica es la dirección del próximo movimiento.",
      },
      {
        h: "¿Qué tamaño de vela elegir?",
        p: "Las velas de 1 hora y 4 horas muestran la agitación del mercado en días o semanas, útil para el corto plazo. Las de 1 día y 1 semana muestran los regímenes de volatilidad de meses y años, y permiten compararlos con los de ciclos anteriores.",
      },
    ],
  },
  en: {
    title: "Bitcoin volatility",
    intro:
      "Chart of Bitcoin's realized volatility on 1-hour, 4-hour, 1-day and 1-week candles, with the BTC price overlaid.",
    sections: [
      {
        h: "What is realized volatility?",
        p: "It is the standard deviation of price changes over the latest candles, annualized. 50% means that, at the current pace, the price typically moves around 50% up or down over a year. Bitcoin's volatility has fallen over the years: in its early cycles it often exceeded 100%; in recent years it has ranged between 25% and 80%.",
      },
      {
        h: "What is it useful for?",
        p: "Volatility tends to return to its normal level: calm periods with very low volatility tend to end in strong moves, and volatility spikes tend to coincide with sharp drops or vertical rallies. What volatility does not tell you is the direction of the next move.",
      },
      {
        h: "Which candle size should I choose?",
        p: "1-hour and 4-hour candles show market turbulence over days or weeks, useful for the short term. 1-day and 1-week candles show volatility regimes over months and years, and let you compare them with previous cycles.",
      },
    ],
  },
};

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

/** Página de ciclos de halving: texto visible bajo la gráfica y en el HTML inicial */
export const SEO_CYCLES: Record<"es" | "en", VolSeoText> = {
  es: {
    title: "Ciclos de Bitcoin desde cada halving",
    intro:
      "Comparativa de los ciclos de Bitcoin: el precio desde cada halving (2012, 2016, 2020 y 2024) superpuesto, con el techo de cada ciclo y la caída posterior.",
    sections: [
      {
        h: "¿Qué muestra la comparativa de ciclos?",
        p: "Cada cuatro años aproximadamente, el halving reduce a la mitad los bitcoins nuevos que se emiten. La gráfica alinea los ciclos en el día de su halving y mide el precio como múltiplo del de ese día, así que se puede ver si el ciclo actual va adelantado o retrasado respecto a los anteriores y cuánto ha subido en comparación.",
      },
      {
        h: "¿Qué enseñan los ciclos anteriores?",
        p: "En los tres ciclos completos el techo llegó entre 12 y 18 meses después del halving (en los días 371, 525 y 546), y después el precio cayó entre un 77 % y un 85 % hasta tocar fondo unos dos años y medio después del halving. Cada ciclo ha multiplicado menos el precio que el anterior: ×92 en 2012, ×30 en 2016 y ×7,9 en 2020. En el ciclo actual el máximo llegó en octubre de 2025, en el día 534, a ×1,9.",
      },
      {
        h: "¿Se repetirá el patrón?",
        p: "No hay garantía. Solo hay tres ciclos completos, y el mercado ha cambiado mucho: ahora hay ETF, grandes inversores institucionales y una relación más estrecha con la liquidez global. La comparativa sirve como referencia para situar el momento del ciclo, no como predicción. Por eso el índice de Is BTC Cheap? combina el ciclo con la valoración, la liquidez, el sentimiento y el análisis técnico.",
      },
    ],
  },
  en: {
    title: "Bitcoin cycles since each halving",
    intro:
      "Comparison of Bitcoin's cycles: the price since each halving (2012, 2016, 2020 and 2024) overlaid, with each cycle's top and the drop that followed.",
    sections: [
      {
        h: "What does the cycle comparison show?",
        p: "Roughly every four years, the halving cuts in half the number of new bitcoins issued. The chart lines up the cycles on their halving day and measures the price as a multiple of that day's price, so you can see whether the current cycle is ahead of or behind previous ones and how much it has risen by comparison.",
      },
      {
        h: "What do previous cycles show?",
        p: "In the three complete cycles the top came 12 to 18 months after the halving (on days 371, 525 and 546), after which the price fell 77% to 85%, bottoming out about two and a half years after the halving. Each cycle has multiplied the price less than the one before: ×92 in 2012, ×30 in 2016 and ×7.9 in 2020. In the current cycle the high came in October 2025, on day 534, at ×1.9.",
      },
      {
        h: "Will the pattern repeat?",
        p: "There is no guarantee. There are only three complete cycles, and the market has changed a lot: there are now ETFs, large institutional investors and a closer link to global liquidity. The comparison is a reference for placing the current moment in the cycle, not a forecast. That is why the Is BTC Cheap? index combines the cycle with valuation, liquidity, sentiment and technical analysis.",
      },
    ],
  },
};

/** Página de bandas de valoración: texto visible bajo la gráfica y en el HTML inicial */
export const SEO_VALUATION: Record<"es" | "en", VolSeoText> = {
  es: {
    title: "Bandas de valoración de Bitcoin",
    intro:
      "Gráfico del precio de Bitcoin frente a sus niveles de valoración de largo plazo: el precio realizado, la media de 200 semanas y la tendencia de la power law con su corredor, desde 2010.",
    sections: [
      {
        h: "¿Qué es el precio realizado de Bitcoin?",
        p: "Es el precio medio al que se movieron por última vez todos los bitcoins en circulación, una aproximación a lo que pagaron de media sus dueños. Cuando el precio cae por debajo, el holder medio está en pérdidas, algo que solo ha ocurrido cerca de los suelos de cada ciclo: en 2015, 2018-2019, marzo de 2020 y 2022, cuando el precio llegó a estar entre un 12 % y un 44 % por debajo. En los techos, en cambio, el precio llegó a multiplicarlo por entre 2,3 y 4,7.",
      },
      {
        h: "¿Por qué importa la media de 200 semanas?",
        p: "Es la media del precio de unos cuatro años, aproximadamente un ciclo completo de halving. Ha funcionado como gran soporte de largo plazo: los suelos de 2015, 2018 y 2020 se formaron muy cerca de ella, y solo en 2022 el precio cayó claramente por debajo (un 34 %).",
      },
      {
        h: "¿Qué es la power law de Bitcoin?",
        p: "Es la recta que mejor se ajusta al precio de Bitcoin cuando se dibujan en escala logarítmica tanto el precio como los días transcurridos desde el bloque génesis. Describe un crecimiento que se va frenando con el tiempo. El corredor sombreado contiene el 95 % de los días desde 2013: los suelos de ciclo han quedado cerca de su borde inferior, a entre ×0,45 y ×0,6 de la tendencia, mientras que cada techo ha quedado más cerca de ella que el anterior.",
      },
      {
        h: "¿Cómo usarlas?",
        p: "Ninguna de estas referencias predice el precio, pero juntas ayudan a situar si Bitcoin está caro o barato frente a su propia historia. El índice de Is BTC Cheap? usa el MVRV (la relación entre el precio y el precio realizado), la distancia a la media de 200 semanas y la desviación de la power law, junto con otras métricas.",
      },
    ],
  },
  en: {
    title: "Bitcoin valuation bands",
    intro:
      "Chart of Bitcoin's price against its long-term valuation levels: the realized price, the 200-week moving average and the power law trend with its corridor, since 2010.",
    sections: [
      {
        h: "What is Bitcoin's realized price?",
        p: "It is the average price at which all bitcoins in circulation last moved, an approximation of what their owners paid on average. When the price falls below it, the average holder is at a loss, something that has only happened near the bottom of each cycle: in 2015, 2018-2019, March 2020 and 2022, when the price was between 12% and 44% below it. At the tops, by contrast, the price reached 2.3 to 4.7 times the realized price.",
      },
      {
        h: "Why does the 200-week moving average matter?",
        p: "It is the average price over about four years, roughly one full halving cycle. It has acted as major long-term support: the bottoms of 2015, 2018 and 2020 formed very close to it, and only in 2022 did the price fall clearly below it (by 34%).",
      },
      {
        h: "What is the Bitcoin power law?",
        p: "It is the straight line that best fits Bitcoin's price when both the price and the days since the genesis block are drawn on a logarithmic scale. It describes growth that slows down over time. The shaded corridor contains 95% of days since 2013: cycle bottoms have landed near its lower edge, at ×0.45 to ×0.6 of the trend, while each top has come closer to it than the one before.",
      },
      {
        h: "How should you use them?",
        p: "None of these references predicts the price, but together they help gauge whether Bitcoin is expensive or cheap relative to its own history. The Is BTC Cheap? index uses MVRV (the ratio between price and realized price), the distance to the 200-week moving average and the power law deviation, along with other metrics.",
      },
    ],
  },
};
