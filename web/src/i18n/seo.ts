/**
 * Textos explicativos de cada página: visibles en la página y, en el HTML inicial, para los rastreadores que no ejecutan
 * JavaScript. Texto plano: vite.config.ts lo convierte a HTML.
 */
export interface SeoText {
  title: string;
  intro: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
}

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
        a: "Valoración on-chain: MVRV, Puell Multiple y Mayer Multiple. Ciclo: fase del ciclo de halving, desviación de la power law y distancia a la media de 200 semanas. Liquidez: liquidez global de los grandes bancos centrales (Fed, BCE y Banco de Japón), masa monetaria M2, fuerza del dólar y oferta de stablecoins. Sentimiento: Fear & Greed Index, SOPR de los holders de corto plazo, flujos de los ETF al contado, funding rate y, en 1 h y 4 h, apalancamiento y posiciones en los futuros de Binance. Técnico: RSI, bandas de Bollinger y distancia a la media móvil.",
      },
      {
        q: "¿Qué temporalidad debo mirar?",
        a: "En 1 hora y 4 horas pesan más el análisis técnico y el sentimiento, y el índice responde a los movimientos del momento. En 1 día, 1 semana y 1 mes pesan más la valoración on-chain y el ciclo, que indican si Bitcoin está caro o barato a medio y largo plazo.",
      },
      {
        q: "¿Ha acertado en el pasado?",
        a: "En el histórico, el índice marcó entre 7 y 9 en los suelos de 2015, 2018, 2020 y 2022, y entre 82 y 98 en los techos de 2013, 2017, 2021, 2024 y 2025. Bitcoin solo tiene unos pocos ciclos completos, así que estos resultados describen el pasado y no garantizan el futuro.",
      },
      {
        q: "¿Cada cuánto se actualiza?",
        a: "Las métricas on-chain, de ciclo y de liquidez se recalculan una vez al día. El precio, el análisis técnico y los datos de derivados se actualizan en vivo cada pocos minutos. Las noticias se renuevan cada 15 minutos en horario de mercado y la agenda económica, cada hora.",
      },
      {
        q: "¿De dónde salen los datos?",
        a: "De fuentes públicas: Coin Metrics, Alternative.me, FRED (Reserva Federal de St. Louis), DefiLlama, Bitview (Bitcoin Research Kit), The Commoner Bitcoin ETF Tracker de TFTC, Binance, Forex Factory y medios como Cointelegraph, CoinDesk, Decrypt, Investing.com, CNBC y BBC.",
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
        a: "On-chain valuation: MVRV, Puell Multiple and Mayer Multiple. Cycle: halving cycle phase, power law deviation and distance to the 200-week moving average. Liquidity: global liquidity from the major central banks (Fed, ECB and Bank of Japan), M2 money supply, dollar strength and stablecoin supply. Sentiment: Fear & Greed Index, short-term holders' SOPR, spot ETF flows, funding rate and, on 1h and 4h, leverage and positioning in Binance futures. Technical: RSI, Bollinger Bands and distance to the moving average.",
      },
      {
        q: "Which timeframe should I look at?",
        a: "On 1 hour and 4 hours, technical analysis and sentiment weigh more, and the index reacts to current moves. On 1 day, 1 week and 1 month, on-chain valuation and the cycle weigh more, showing whether Bitcoin is cheap or expensive over the medium and long term.",
      },
      {
        q: "Has it worked in the past?",
        a: "Historically, the index read between 7 and 9 at the 2015, 2018, 2020 and 2022 bottoms, and between 82 and 98 at the 2013, 2017, 2021, 2024 and 2025 tops. Bitcoin has only had a few full cycles, so these results describe the past and do not guarantee the future.",
      },
      {
        q: "How often is it updated?",
        a: "On-chain, cycle and liquidity metrics are recalculated once a day. Price, technical analysis and derivatives data update live every few minutes. News refreshes every 15 minutes during market hours and the economic calendar every hour.",
      },
      {
        q: "Where does the data come from?",
        a: "From public sources: Coin Metrics, Alternative.me, FRED (Federal Reserve Bank of St. Louis), DefiLlama, Bitview (Bitcoin Research Kit), The Commoner Bitcoin ETF Tracker by TFTC, Binance, Forex Factory and outlets such as Cointelegraph, CoinDesk, Decrypt, Investing.com, CNBC and BBC.",
      },
      {
        q: "Is this investment advice?",
        a: "No. Is BTC Cheap? is a free, ad-free informational tool. It is not financial advice: every investment decision is each person's own responsibility.",
      },
    ],
  },
};

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
        h: "¿Qué es el precio realizado de corto plazo?",
        p: "Es el mismo cálculo, pero solo con las monedas que se movieron en los últimos 150 días: el coste medio de los compradores recientes. Se mueve mucho más rápido que el precio realizado total. En los años alcistas, como 2016, 2017, 2020, 2023 y 2024, el precio estuvo por encima la mayor parte del tiempo (entre el 77 % y el 98 % de los días); en los suelos de 2015, 2018, 2020 y 2022 llegó a estar entre un 22 % y un 48 % por debajo, con los compradores recientes en pérdidas.",
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
        h: "What is the short-term holder realized price?",
        p: "It is the same calculation, but only for coins that moved in the last 150 days: the average cost of recent buyers. It moves much faster than the overall realized price. In bull years such as 2016, 2017, 2020, 2023 and 2024, the price stayed above it most of the time (77% to 98% of days); at the 2015, 2018, 2020 and 2022 bottoms it fell 22% to 48% below it, leaving recent buyers at a loss.",
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

export const SEO_DRAWDOWN: Record<"es" | "en", VolSeoText> = {
  es: {
    title: "Caídas y subidas de Bitcoin",
    intro:
      "Gráfico de la caída de Bitcoin desde su máximo histórico (drawdown) desde 2010, con la tabla de las grandes caídas, y los días que lleva el precio sin caer o subir un 5 %, 10 %, 20 % o 30 % comparados con lo habitual.",
    sections: [
      {
        h: "¿Qué es el drawdown de Bitcoin?",
        p: "Es cuánto está el precio por debajo del máximo histórico alcanzado hasta ese día. Un drawdown del 50 % significa que Bitcoin vale la mitad que en su máximo. Es la forma más directa de poner en contexto una caída: si es una corrección normal dentro de una tendencia alcista o un mercado bajista de los que marcan el final de un ciclo.",
      },
      {
        h: "¿Cuánto han durado las grandes caídas?",
        p: "Bitcoin ha sufrido cinco caídas de más del 70 % desde 2011: la de 2011 (93 %), la de 2013 (71 %) y las que siguieron a los techos de los ciclos de 2013, 2017 y 2021 (85 %, 84 % y 77 %). En estas tres últimas el precio tardó alrededor de un año en tocar fondo y entre dos años y medio y algo más de tres años en recuperar el máximo anterior.",
      },
      {
        h: "¿Cuánto suele tardar Bitcoin en caer o subir un 10 %?",
        p: "La tabla de caídas y subidas cuenta los días desde la última caída y la última subida de cada tamaño y los compara con lo habitual en el periodo elegido. Los tamaños que llevan más tiempo sin producirse que en el 90 % de los días del periodo se resaltan, para ver de un vistazo si el mercado está más tranquilo o más agitado de lo habitual.",
      },
      {
        h: "¿Qué indica la caída actual?",
        p: "Cada gran mercado bajista ha sido algo menos profundo que el anterior, en línea con un mercado más grande y con más inversores institucionales. Las correcciones del 20 % al 35 % son habituales incluso en plena tendencia alcista. Nada garantiza que la historia se repita: el índice de Is BTC Cheap? combina el precio con la valoración on-chain, el ciclo, la liquidez y el sentimiento para estimar si Bitcoin está barato o caro.",
      },
    ],
  },
  en: {
    title: "Bitcoin drops and rallies",
    intro:
      "Chart of Bitcoin's drawdown from its all-time high since 2010, with a table of the major drops, and the days the price has gone without a 5%, 10%, 20% or 30% drop or rally compared with what is usual.",
    sections: [
      {
        h: "What is Bitcoin's drawdown?",
        p: "It is how far the price is below the all-time high reached up to that day. A 50% drawdown means Bitcoin is worth half of its peak. It is the most direct way to put a drop in context: whether it is a normal correction within an uptrend or a bear market of the kind that ends a cycle.",
      },
      {
        h: "How long have the major drops lasted?",
        p: "Bitcoin has suffered five drops of more than 70% since 2011: the 2011 crash (93%), the 2013 drop (71%) and those that followed the tops of the 2013, 2017 and 2021 cycles (85%, 84% and 77%). In the last three, the price took about a year to bottom and between two and a half and just over three years to recover the previous high.",
      },
      {
        h: "How long does Bitcoin usually take to drop or rally 10%?",
        p: "The drops and rallies table counts the days since the last drop and the last rally of each size and compares them with what is usual in the chosen period. Sizes that have gone longer without happening than on 90% of days in the period are highlighted, so you can see at a glance whether the market is calmer or more agitated than usual.",
      },
      {
        h: "What does the current drop indicate?",
        p: "Each major bear market has been somewhat shallower than the one before, in line with a larger market with more institutional investors. Corrections of 20% to 35% are common even in a full uptrend. Nothing guarantees that history will repeat: the Is BTC Cheap? index combines price with on-chain valuation, the cycle, liquidity and sentiment to estimate whether Bitcoin is cheap or expensive.",
      },
    ],
  },
};

export const SEO_CATEGORIES: Record<"es" | "en", VolSeoText> = {
  es: {
    title: "Histórico del índice por categorías",
    intro:
      "Mapa de calor con la puntuación diaria desde 2011 de las cinco categorías del índice Is BTC Cheap? (valoración on-chain, ciclo, liquidez, sentimiento y técnico) y lo que marcaba cada una en los techos y suelos de ciclo de Bitcoin.",
    sections: [
      {
        h: "¿Qué muestra el histórico de categorías?",
        p: "El score del índice combina cinco categorías, cada una puntuada de 0 (barato) a 100 (caro) comparándola con su propia historia. Verlas juntas en el tiempo muestra qué empujaba el score en cada momento: si el precio estaba caro por su valoración on-chain, por el momento del ciclo, por la liquidez global o por el sentimiento del mercado.",
      },
      {
        h: "¿Qué marcaban en los techos y suelos?",
        p: "En los suelos de 2015, 2018 y 2022, la valoración on-chain estaba entre 1 y 7 y el técnico entre 0 y 5, y el score de 1 día rondaba 8-9. En los techos de 2013, 2017 y 2021 ocurría lo contrario: valoración entre 78 y 100, técnico entre 91 y 98 y ciclo por encima de 80, con el score entre 84 y 98. Son las categorías que mejor han marcado los extremos.",
      },
      {
        h: "¿Por qué la liquidez va a contracorriente?",
        p: "En los suelos de 2015, 2018 y 2022 la liquidez estaba en zona cara (entre 85 y 93): esos mercados bajistas coincidieron con un endurecimiento de la liquidez global, con subidas de tipos, retirada de estímulos o un dólar fuerte. La liquidez no señala bien los extremos, pero sí ayuda a anticipar el año siguiente; por eso pesa poco en las temporalidades cortas y más en la mensual.",
      },
    ],
  },
  en: {
    title: "Index history by category",
    intro:
      "Heatmap of the daily score since 2011 of the five categories of the Is BTC Cheap? index (on-chain valuation, cycle, liquidity, sentiment and technical) and what each one showed at Bitcoin's cycle tops and bottoms.",
    sections: [
      {
        h: "What does the category history show?",
        p: "The index score combines five categories, each scored from 0 (cheap) to 100 (expensive) by comparing it with its own history. Seeing them together over time shows what was driving the score at each moment: whether the price was expensive because of its on-chain valuation, the point in the cycle, global liquidity or market sentiment.",
      },
      {
        h: "What did they show at tops and bottoms?",
        p: "At the 2015, 2018 and 2022 bottoms, on-chain valuation was between 1 and 7 and technical between 0 and 5, with the 1-day score around 8-9. At the 2013, 2017 and 2021 tops it was the opposite: valuation between 78 and 100, technical between 91 and 98 and cycle above 80, with the score between 84 and 98. These are the categories that have best marked the extremes.",
      },
      {
        h: "Why does liquidity run against the grain?",
        p: "At the 2015, 2018 and 2022 bottoms, liquidity was in expensive territory (between 85 and 93): those bear markets coincided with tightening global liquidity, with rate hikes, withdrawal of stimulus or a strong dollar. Liquidity does not mark the extremes well, but it does help anticipate the following year; that is why it weighs little on short timeframes and more on the monthly one.",
      },
    ],
  },
};

export const SEO_ETF: Record<"es" | "en", VolSeoText> = {
  es: {
    title: "Flujos de los ETF de Bitcoin",
    intro:
      "Gráfico de las entradas y salidas diarias de los ETF de bitcoin al contado de EE. UU. frente al precio de BTC desde su lanzamiento en enero de 2024, con el acumulado y el desglose por fondo.",
    sections: [
      {
        h: "¿Qué son los flujos de los ETF de bitcoin?",
        p: "Los ETF al contado compran bitcoin real cuando reciben dinero de sus inversores y lo venden cuando se lo retiran. El flujo neto de cada sesión es la diferencia entre entradas y salidas del conjunto de fondos, y muestra si los inversores tradicionales están comprando o vendiendo exposición a Bitcoin.",
      },
      {
        h: "¿Cuánto han captado desde su lanzamiento?",
        p: "Desde enero de 2024 los ETF de bitcoin al contado de EE. UU. acumulan unas entradas netas de unos 57.000 millones de dólares: 35.000 millones en 2024 y 21.000 millones en 2025. IBIT, de BlackRock, ha captado unos 66.000 millones, mientras que GBTC, de Grayscale, ha perdido unos 28.000 millones al pasar de fondo cerrado a ETF con comisiones más altas que sus rivales.",
      },
      {
        h: "¿Cómo se interpretan?",
        p: "Las entradas fuertes y sostenidas han acompañado a las subidas y a los techos, y las salidas, a las caídas y a los mínimos: es un reflejo del sentimiento de los inversores más que una predicción. Por eso el índice de Is BTC Cheap? usa la suma de las últimas 20 sesiones como una métrica más de sentimiento. Con menos de tres años de historia, conviene tomarla con prudencia.",
      },
    ],
  },
  en: {
    title: "Bitcoin ETF flows",
    intro:
      "Chart of daily inflows and outflows of US spot bitcoin ETFs against the BTC price since their launch in January 2024, with cumulative flows and a per-fund breakdown.",
    sections: [
      {
        h: "What are bitcoin ETF flows?",
        p: "Spot ETFs buy actual bitcoin when they receive money from their investors and sell it when investors withdraw. Each session's net flow is the difference between inflows and outflows across all funds, and shows whether traditional investors are buying or selling Bitcoin exposure.",
      },
      {
        h: "How much have they taken in since launch?",
        p: "Since January 2024, US spot bitcoin ETFs have accumulated about $57 billion in net inflows: $35 billion in 2024 and $21 billion in 2025. BlackRock's IBIT has taken in about $66 billion, while Grayscale's GBTC has lost about $28 billion after converting from a closed-end fund to an ETF with higher fees than its rivals.",
      },
      {
        h: "How should you read them?",
        p: "Strong, sustained inflows have accompanied rallies and tops, and outflows have accompanied drops and lows: they reflect investor sentiment rather than predict it. That is why the Is BTC Cheap? index uses the sum of the last 20 sessions as one more sentiment metric. With less than three years of history, it is worth treating with caution.",
      },
    ],
  },
};

export const SEO_LIQUIDITY: Record<"es" | "en", VolSeoText> = {
  es: {
    title: "Liquidez global y Bitcoin",
    intro:
      "Gráfico del precio de Bitcoin frente a la variación en 13 semanas de la liquidez global (Reserva Federal, BCE y Banco de Japón), adelantada 13 semanas, con datos semanales de FRED desde 2011.",
    sections: [
      {
        h: "¿Qué es la liquidez global?",
        p: "Es el dinero que los grandes bancos centrales inyectan en el sistema financiero, medido en dólares. Aquí se suma la liquidez neta de la Reserva Federal (su balance menos el dinero que el Tesoro tiene aparcado en su cuenta y el que los bancos dejan en repos inversos) a los balances del Banco Central Europeo y del Banco de Japón. Sube cuando los bancos centrales compran activos o cuando el dólar se debilita, y baja con la retirada de estímulos.",
      },
      {
        h: "¿Anticipa la liquidez el precio de Bitcoin?",
        p: "En parte. Desde 2015, la variación de la liquidez global en 13 semanas y la rentabilidad de Bitcoin en las 13 semanas siguientes tienen una correlación de alrededor de +0,44, casi el doble que la de la liquidez de la Fed sola (+0,23). Es una relación moderada y no se cumple siempre: en 2012-2013 y en 2018-2019 apenas funcionó. Por eso la gráfica adelanta la liquidez 13 semanas: para ver si los giros del precio llegan después de los suyos.",
      },
      {
        h: "¿Cómo la usa el índice?",
        p: "La liquidez global es una de las métricas de la categoría de liquidez del índice de Is BTC Cheap?, junto con la masa monetaria M2, la fuerza del dólar y la oferta de stablecoins. Pesa poco en las temporalidades cortas y más en la mensual, donde ayuda a anticipar el año siguiente.",
      },
    ],
  },
  en: {
    title: "Global liquidity and Bitcoin",
    intro:
      "Chart of the Bitcoin price against the 13-week change in global liquidity (Federal Reserve, ECB and Bank of Japan), shifted 13 weeks forward, with weekly FRED data since 2011.",
    sections: [
      {
        h: "What is global liquidity?",
        p: "It is the money the major central banks inject into the financial system, measured in dollars. Here, Federal Reserve net liquidity (its balance sheet minus the money the Treasury keeps parked in its account and what banks leave in reverse repos) is added to the balance sheets of the European Central Bank and the Bank of Japan. It rises when central banks buy assets or the dollar weakens, and falls when stimulus is withdrawn.",
      },
      {
        h: "Does liquidity lead the Bitcoin price?",
        p: "Partly. Since 2015, the 13-week change in global liquidity and Bitcoin's return over the following 13 weeks have a correlation of about +0.44, almost double that of Fed liquidity alone (+0.23). It is a moderate relationship and does not always hold: in 2012-2013 and 2018-2019 it barely worked. That is why the chart shifts liquidity 13 weeks forward: to see whether the price's turns come after its own.",
      },
      {
        h: "How does the index use it?",
        p: "Global liquidity is one of the metrics in the liquidity category of the Is BTC Cheap? index, along with M2 money supply, dollar strength and stablecoin supply. It weighs little on short timeframes and more on the monthly one, where it helps anticipate the following year.",
      },
    ],
  },
};

export const SEO_ANALYSIS: Record<"es" | "en", VolSeoText> = {
  es: {
    title: "Análisis de Bitcoin: soportes, resistencias y sesgo",
    intro:
      "Análisis del precio de Bitcoin con IA que se actualiza dos veces al día: la situación de BTC hoy, sus soportes y resistencias inmediatos, el sesgo del mercado y lo más probable en las próximas horas, dibujado sobre el gráfico de BTC.",
    sections: [
      {
        h: "¿Cómo se hace el análisis?",
        p: "Un modelo de IA recibe datos de mercado en bruto de Bitcoin: velas diarias, de 4 horas y de 1 hora, el funding de los futuros perpetuos, el open interest, el porcentaje de cuentas en largo, el ratio de compras y ventas a mercado, el Fear & Greed Index y los flujos de los ETF al contado. Con ellos hace su propio análisis y decide qué factores pesan más, sin niveles ni conclusiones de esta web.",
      },
      {
        h: "¿Qué muestra?",
        p: "Las zonas de soporte y resistencia más cercanas al precio, con su fuerza; el sesgo de corto plazo y la confianza en él; el movimiento más probable en las próximas horas, con el precio que lo invalidaría, y un escenario alternativo. Antes de publicarse se comprueba que todo sea coherente con el precio: zonas a cada lado y objetivos razonables.",
      },
      {
        h: "¿Es una predicción?",
        p: "No. Es una lectura del momento hecha por un modelo de IA, que puede equivocarse: los soportes y resistencias se rompen a menudo y el sesgo puede cambiar en horas. Sirve para situar el precio y entender qué está pesando más, no como recomendación de compra o venta.",
      },
    ],
  },
  en: {
    title: "Bitcoin analysis: support, resistance and bias",
    intro:
      "AI analysis of the Bitcoin price updated twice a day: BTC's situation today, its immediate support and resistance, the market bias and what is most likely over the next hours, drawn on the BTC chart.",
    sections: [
      {
        h: "How is the analysis made?",
        p: "An AI model receives raw Bitcoin market data: daily, 4-hour and 1-hour candles, perpetual futures funding, open interest, the share of accounts long, the taker buy/sell ratio, the Fear & Greed Index and spot ETF flows. From them it makes its own analysis and decides which factors weigh most, with no levels or conclusions from this site.",
      },
      {
        h: "What does it show?",
        p: "The support and resistance zones closest to the price, with their strength; the short-term bias and the confidence in it; the most likely move over the next hours, with the price that would invalidate it, and an alternative scenario. Before publishing, everything is checked for consistency with the price: zones on each side and reasonable targets.",
      },
      {
        h: "Is it a prediction?",
        p: "No. It is a reading of the moment by an AI model, which can be wrong: support and resistance levels break often and the bias can change within hours. It helps place the price and understand what is weighing most, not as a buy or sell recommendation.",
      },
    ],
  },
};
