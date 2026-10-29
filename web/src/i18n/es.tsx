import type { ReactNode } from "react";
import type { CategoryId, Timeframe } from "../types";

interface Description {
  /** Qué mide */
  what: string;
  /** Cómo interpretarlo en el score */
  read: string;
}

export const es = {
  loading: "Cargando…",
  noData: "Sin datos",
  dataError: "No se pudieron cargar los datos diarios. Ejecuta el pipeline (python pipeline/build.py).",
  infoAbout: (label: string) => `Información sobre ${label}`,
  percent: (n: string) => `${n}\u00a0%`,
  language: "Idioma",
  nav: { aria: "Secciones", index: "Índice", volatility: "Volatilidad", cycles: "Ciclos", valuation: "Valoración", drawdown: "Caídas", categories: "Categorías", etf: "ETF", liquidity: "Liquidez", phase: "Tendencia" },
  cycles: {
    title: "Ciclos de Bitcoin desde cada halving",
    rest: "El ciclo actual frente a los de 2012, 2016 y 2020: cuánto ha subido el precio desde su halving, cuándo llegó el techo y cuánto cayó después.",
    card: "Precio desde cada halving",
    info: [
      "Cada línea es un ciclo: el precio de Bitcoin dividido por su precio el día del halving, frente a los días transcurridos desde entonces. ×1 es el precio del halving; ×2, el doble. La escala es logarítmica para poder comparar ciclos con subidas muy distintas.",
      "El punto de cada línea marca el techo del ciclo, buscado en los dos primeros años tras el halving. Pulsa en los años para mostrar u ocultar cada ciclo. Se usa el histórico diario desde 2011 más el precio actual.",
    ],
    toggleAria: "Ciclos mostrados",
    current: (day: ReactNode, phase: ReactNode, mult: ReactNode, others: string) => (
      <>
        Hoy es el día {day} del ciclo actual ({phase} del camino hasta el próximo halving) y BTC cotiza a {mult} el precio del
        halving. A estas alturas, los ciclos anteriores iban {others}.
      </>
    ),
    sincePeak: (date: ReactNode, day: number, fall: ReactNode) => (
      <>
        El máximo de este ciclo llegó el {date} (día {day}) y hoy el precio está un {fall} por debajo.
      </>
    ),
    dayN: (d: number) => `Día ${d} tras el halving`,
    yearN: (y: number) => (y === 0 ? "Halving" : y === 1 ? "1 año" : `${y} años`),
    today: "Hoy",
    peakTitle: (year: number, day: number, mult: string) => `Techo del ciclo ${year}: día ${day}, ${mult}`,
    cols: {
      cycle: "Ciclo",
      halvingPrice: "Precio en el halving",
      peak: "Techo",
      peakDay: "Día del techo",
      peakMult: "× en el techo",
      drawdown: "Caída tras el techo",
      atToday: (d: number) => `Día ${d}`,
    },
    note: "* Ciclo en curso: caída máxima hasta hoy. Datos históricos, no una predicción ni una recomendación de inversión.",
    chartAria: "Gráfico del precio de Bitcoin en cada ciclo, como múltiplo del precio del día del halving",
  },
  valuation: {
    title: "Bandas de valoración de Bitcoin",
    rest: "El precio de BTC frente a sus niveles de largo plazo: precio realizado, media de 200 semanas y la tendencia de la power law.",
    card: "Precio y niveles de valoración",
    info: [
      "Precio realizado: el precio medio al que se movieron por última vez los bitcoins en circulación, una aproximación a lo que pagaron de media sus dueños (precio / MVRV, de Coin Metrics). Precio realizado de corto plazo: lo mismo solo para las monedas de menos de 150 días, el coste medio de los compradores recientes (de Bitview). Media de 200 semanas: la media del precio de los últimos cuatro años, aproximadamente un ciclo.",
      "Power law: la recta que mejor se ajusta al precio en escala logarítmica frente a los días desde el bloque génesis. El corredor sombreado contiene el 95 % de los días desde 2013. La escala es logarítmica y el último día usa el precio actual.",
    ],
    current: (price: ReactNode, vsRealized: ReactNode, vsWma: ReactNode, vsTrend: ReactNode, zone: string) => (
      <>
        Precio actual: {price}, un {vsRealized} frente al precio realizado y un {vsWma} frente a la media de 200 semanas. Respecto a
        la tendencia de la power law está a {vsTrend}, {zone}.
      </>
    ),
    zones: {
      below: "por debajo de su corredor habitual",
      nearLow: "cerca del suelo de su corredor habitual",
      underTrend: "por debajo de la tendencia",
      overTrend: "por encima de la tendencia",
      nearHigh: "cerca del techo de su corredor habitual",
      above: "por encima de su corredor habitual",
    },
    legend: { price: "Precio", realized: "Realizado", sth: "Realizado CP", wma: "MA 200 sem", trend: "Power law" } as Record<string, string>,
    levels: {
      realized: "Precio realizado",
      sth: "Precio realizado de corto plazo",
      wma: "Media de 200 semanas",
      trend: "Tendencia power law",
      low: "Suelo del corredor",
      high: "Techo del corredor",
    },
    cols: { level: "Nivel", value: "Hoy", distance: "Precio frente al nivel" },
    note: "Datos históricos, no una predicción ni una recomendación de inversión. El ajuste de la power law se recalcula cada día con todo el histórico.",
    chartAria: "Gráfico del precio de Bitcoin con el precio realizado total y de corto plazo, la media de 200 semanas y la power law",
  },
  movesLink: { text: "¿Cuánto lleva BTC sin caer un 10 % o sin subir un 20 %? Compáralo con lo habitual.", cta: "Caídas y subidas" },
  drawdown: {
    title: "Caídas y subidas de Bitcoin",
    rest: "Cuánto está BTC por debajo de su máximo histórico, cómo se compara con las grandes caídas anteriores y cuánto lleva sin caer o subir un 5 %, un 10 % o más.",
    card: "Precio y caída desde el máximo histórico",
    info: [
      "La caída (drawdown) es la distancia entre el precio de cada día y el máximo histórico alcanzado hasta entonces: 0 % en máximos, -50 % si el precio vale la mitad.",
      "Se usa el precio diario desde 2010 más el precio actual. La tabla recoge las caídas de más del 50 % desde 2011 (antes el mercado era minúsculo) y la actual.",
    ],
    current: (dd: ReactNode, ath: ReactNode, athDate: ReactNode, days: ReactNode, maxDd: ReactNode, lowDate: ReactNode) => (
      <>
        BTC está un {dd} por debajo de su máximo histórico ({ath}, el {athDate}), alcanzado hace {days} días. La mayor caída
        desde entonces ha sido del {maxDd} ({lowDate}).
      </>
    ),
    atAth: (ath: ReactNode) => <>BTC está en máximos históricos: {ath}.</>,
    bears: (n: number, min: ReactNode, max: ReactNode) => (
      <>
        En los {n} grandes mercados bajistas anteriores, la caída fue de entre el {min} y el {max}.
      </>
    ),
    legend: { price: "Precio", ath: "Máximo", dd: "Caída" },
    tableTitle: "Grandes caídas desde el máximo",
    cols: { ath: "Máximo", low: "Mínimo", dd: "Caída", toLow: "Días hasta el mínimo", toRecover: "Días hasta recuperarlo" },
    ongoing: "En curso",
    note: "Datos históricos, no una predicción ni una recomendación de inversión.",
    chartAria: "Gráfico del precio de Bitcoin con su máximo histórico y de la caída desde ese máximo",
  },
  catHistory: {
    title: "Histórico del índice por categorías",
    rest: "Cómo han evolucionado desde 2011 las cinco categorías del índice y qué marcaban en cada techo y suelo de ciclo.",
    card: "Score y categorías en el tiempo",
    info: [
      "Cada fila es la puntuación diaria (cierre del día) de una categoría, de 0 (barato, verde) a 100 (caro, rojo), con los mismos tramos de color que el medidor. La primera fila es el score de 1 día, que las combina con sus pesos. Con periodos largos, cada columna es la media de varios días.",
      "Las líneas verticales marcan los techos de ciclo (rojo) y los suelos que los siguieron (verde). El sentimiento usa el SOPR de corto plazo desde 2011, y suma el Fear & Greed Index desde 2018 y los flujos de los ETF desde 2025.",
    ],
    current: (day: ReactNode, score: ReactNode, cheapest: string, cheapV: ReactNode, dearest: string, dearV: ReactNode) => (
      <>
        Al cierre del {day} el score de 1 día es {score}. La categoría más barata es {cheapest} {cheapV} y la más cara, {dearest}{" "}
        {dearV}.
      </>
    ),
    short: {
      score: "Score",
      valoracion: "Valoración",
      ciclo: "Ciclo",
      liquidez: "Liquidez",
      sentimiento: "Sentimiento",
      tecnico: "Técnico",
    },
    priceLegend: "Precio",
    tableTitle: "En los techos y suelos de ciclo",
    cols: { when: "Momento", price: "Precio" },
    kinds: { today: "Hoy", top: "Techo", bottom: "Suelo", lowSoFar: "Mínimo actual" },
    note: "Datos históricos calculados cada día sin mirar al futuro (cada métrica solo se compara con su pasado), no una predicción ni una recomendación de inversión.",
    chartAria: "Gráfico del precio de Bitcoin y mapa de calor del score y de sus cinco categorías desde 2011",
  },
  etf: {
    title: "Flujos de los ETF de Bitcoin",
    rest: "Cuánto dinero entra o sale cada día de los ETF de bitcoin al contado de EE. UU., frente al precio de BTC.",
    card: "Flujo neto diario y precio",
    info: [
      "Cada barra es el flujo neto de una sesión: lo que entró menos lo que salió del conjunto de ETF de bitcoin al contado de EE. UU. (IBIT, FBTC, GBTC…), en dólares. Verde, entradas; rojo, salidas. El eje x son sesiones de mercado, sin fines de semana ni festivos.",
      "El índice usa la suma de las últimas 20 sesiones en BTC como métrica de sentimiento: entradas fuertes, típicas de los techos, suman; salidas, típicas de los mínimos, restan. Los datos se actualizan una vez al día.",
    ],
    money: (v: number) =>
      v >= 1e9
        ? `${(v / 1e9).toLocaleString("es-ES", { maximumFractionDigits: 1 })} mil M$`
        : `${(v / 1e6).toLocaleString("es-ES", { maximumFractionDigits: v < 1e7 ? 1 : 0 })} M$`,
    current: (day: ReactNode, last: ReactNode, n: number, sum: ReactNode, sumBtc: ReactNode, pct: ReactNode, total: ReactNode) => (
      <>
        Última sesión ({day}): {last}. En las últimas {n} sesiones: {sum} ({sumBtc}), percentil {pct} desde el lanzamiento. Acumulado desde
        enero de 2024: {total}.
      </>
    ),
    legend: { price: "Precio", flow: "Flujo", cumulative: "Acumulado" },
    tableTitle: "Por fondo",
    cols: { fund: "Fondo", last: (d: string) => `Sesión del ${d}`, d20: (n: number) => `Últimas ${n} sesiones`, total: "Desde el lanzamiento" },
    source: "Fuente:",
    note: "Datos históricos, no una predicción ni una recomendación de inversión.",
    chartAria: "Gráfico del precio de Bitcoin y del flujo neto diario de los ETF de bitcoin al contado",
  },
  liquidity: {
    title: "Liquidez global y Bitcoin",
    rest: "La variación de la liquidez de los grandes bancos centrales, adelantada 13 semanas, frente al precio de BTC: ¿se anticipa la liquidez al precio?",
    card: "Precio de BTC y liquidez global 13 semanas antes",
    info: [
      "Liquidez global = liquidez neta de la Fed (balance − cuenta del Tesoro − repos inversos) + balances del BCE y del Banco de Japón, en dólares. Datos semanales de FRED hasta el último de la Fed; el del Banco de Japón es mensual y se repite su último dato. La línea naranja es su variación en 13 semanas.",
      "La línea naranja está adelantada 13 semanas: en cada fecha se ve la variación de la liquidez de 13 semanas antes, junto al precio de BTC (azul) de ese día. Si la liquidez se adelanta al precio, las dos líneas suben y bajan a la vez. El tramo sombreado son las próximas 13 semanas: lo que anticipa la liquidez ya publicada.",
    ],
    money: (bn: number) => `${(bn / 1000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} billones de $`,
    current: (day: ReactNode, net: ReactNode, roc: ReactNode) => (
      <>
        Liquidez global a {day}: {net}, {roc} en 13 semanas.
      </>
    ),
    correlation: (c: ReactNode) => (
      <>En el periodo mostrado, su correlación con la rentabilidad de BTC en las 13 semanas siguientes es {c}.</>
    ),
    legend: {
      price: "BTC",
      roc: (d: string) => `Liquidez global (13 sem.) a ${d}`,
      pending: "aún no",
    },
    today: "Hoy",
    ahead: "Próximas 13 semanas",
    note: "Datos de FRED (Reserva Federal de St. Louis). Correlación no implica causalidad; no es una predicción ni una recomendación de inversión.",
    chartAria: "Gráfico del precio de Bitcoin y de la variación en 13 semanas de la liquidez global, adelantada 13 semanas",
  },
  phase: {
    title: "Fase del mercado de Bitcoin",
    rest: "Si el mercado va a favor o en contra: tendencia del precio frente al coste de los compradores recientes y dirección de la liquidez global.",
    card: "Precio y fase del mercado",
    info: [
      "Tendencia: alcista cuando el precio está por encima del precio realizado de corto plazo (el coste medio de las monedas compradas en los últimos 150 días, de Bitview); bajista cuando está por debajo. Liquidez: al alza o a la baja según la variación en 13 semanas de la liquidez global (Fed, BCE y Banco de Japón).",
      "La tendencia se confirma con el score diario del índice: un giro alcista solo cuenta con el score en 60 o menos y uno bajista con el score en 40 o más, y se confirma en 3 días si el score lo respalda, en 14 si lo contradice y en 7 si es neutral. La liquidez se confirma siempre en 7 días. Estas señales no anticipan los giros: los confirman con retraso, pero separan bien las fases.",
    ],
    currentTrend: (phase: ReactNode, since: ReactNode, days: number, vsSth: ReactNode, sth: ReactNode) => (
      <>
        Tendencia {phase} desde el {since} ({days} días)
        {vsSth && (
          <>
            : el precio está un {vsSth} frente al coste de los compradores recientes ({sth})
          </>
        )}
        .
      </>
    ),
    currentLiquidity: (phase: ReactNode, since: ReactNode, roc: ReactNode) => (
      <>
        Liquidez global {phase} desde el {since}
        {roc && <> ({roc} en 13 semanas)</>}.
      </>
    ),
    names: { trend: { up: "alcista", down: "bajista" }, liquidity: { up: "al alza", down: "a la baja" } },
    legend: { price: "Precio", sth: "Coste compradores recientes", trend: "Tendencia", liquidity: "Liquidez" },
    stripLabel: "Liquidez",
    statsTitle: "Historial desde 2012",
    indicators: { trend: "Tendencia (precio vs. compradores recientes)", liquidity: "Liquidez global" },
    cols: {
      indicator: "Indicador",
      bull90: "BTC a 90 días en fase alcista",
      bear90: "En fase bajista",
      bullShare: "Días en fase alcista",
      perYear: "Cambios al año",
      false: "Se deshacen en < 30 días",
      date: "Cambio",
      phase: "Fase",
      price: "Precio",
      duration: "Duración",
    },
    changesTitle: "Últimos cambios de tendencia",
    days: (n: number) => `${n} días`,
    ongoing: (n: number) => `${n} días (en curso)`,
    note: "Rentabilidad mediana de BTC en los 90 días siguientes a cada día de la fase. Datos históricos, no una predicción ni una recomendación de inversión.",
    chartAria: "Gráfico del precio de Bitcoin con las fases de tendencia y de liquidez desde 2012",
  },
  charts: {
    tfAria: "Tamaño de vela",
    rangeAria: "Periodo mostrado",
    ranges: { "3m": "3 meses", "1y": "1 año", "4y": "4 años", all: "Todo" } as Record<string, string>,
    error: "No se pudieron cargar los datos de esta temporalidad.",
    note: "Datos históricos, no una predicción ni una recomendación de inversión.",
  },
  vol: {
    title: "Volatilidad de Bitcoin",
    rest: "Cuánto se mueve el precio de BTC según el tamaño de vela, con el precio superpuesto para ver cómo se relacionan.",
    card: "Volatilidad realizada y precio",
    info: [
      "La volatilidad realizada mide cuánto ha variado el precio de una vela a otra en las últimas velas, expresada en términos anuales para poder comparar temporalidades.",
      "Ventana de cálculo: 24 velas en 1 h (un día), 42 en 4 h (una semana), 30 en 1 día (un mes) y 26 en 1 semana (medio año). En 1 h y 4 h se usan las velas de Binance; en 1 día y 1 semana, el histórico desde 2011 más el precio actual.",
    ],
    current: (vol: ReactNode, pct: ReactNode, mean: ReactNode) => (
      <>
        Volatilidad actual: {vol} anualizada, percentil {pct} del periodo mostrado (media {mean}).
      </>
    ),
    volLegend: "Volatilidad",
    priceLegend: "Precio",
    chartAria: "Gráfico de la volatilidad realizada de Bitcoin y de su precio",
  },
  periods: { "2y": "2 años", "4y": "4 años", "8y": "8 años", all: "Desde 2011" } as Record<string, string>,
  periodAria: "Periodo de la muestra",

  taglineTitle: "¿Está Bitcoin barato o caro?",
  taglineRest: "Un índice de 1 a 100 que combina valoración on‑chain, ciclos, liquidez, sentimiento y análisis técnico.",

  timeframes: {
    "1h": { label: "1 hora", short: "1 h" },
    "4h": { label: "4 horas", short: "4 h" },
    "1d": { label: "1 día", short: "1 día" },
    "1w": { label: "1 semana", short: "1 sem" },
    "1M": { label: "1 mes", short: "1 mes" },
  } satisfies Record<Timeframe, { label: string; short: string }>,
  timeframeAria: "Temporalidad",
  timeframeInfo: {
    label: "la temporalidad",
    title: "Temporalidad",
    body: "Elige el horizonte del análisis. El técnico se calcula con velas de esa temporalidad y los pesos de cada categoría cambian: en las cortas pesa más el técnico y el sentimiento; en las largas, la valoración y el ciclo.",
    weightsIn: (tf: string) => `Pesos en ${tf}:`,
  },

  gauge: { cheap: "Barato", expensive: "Caro" },
  scoreInfo: {
    label: "el score",
    title: "Score",
    body: "Índice de 1 a 100 que estima si Bitcoin está barato o caro. Es la media ponderada de las cinco categorías de abajo, estirada para que los extremos sean alcanzables; cada métrica se puntúa según su percentil histórico.",
    disclaimer: "Es una referencia informativa, no una recomendación de inversión.",
  },
  /** Etiquetas de la escala, en el mismo orden que LABELS del pipeline */
  labels: ["Muy barato", "Barato", "Neutral", "Caro", "Muy caro"],

  priceInfo: {
    label: "el precio",
    title: "Precio",
    body: "Último precio de BTC/USDT en Binance, tomado del cierre de la vela más reciente. Si Binance no está disponible, se muestra el precio diario de Coin Metrics.",
    changeInfo:
      "El porcentaje es la variación desde el cierre de la vela anterior de la temporalidad elegida: en 1 hora, desde el inicio de la hora; en 1 día, desde las 00:00 UTC; en 1 mes, en lo que va de mes.",
    change: (tf: string) => `Variación de la vela actual de ${tf}`,
  },

  refresh: {
    updating: "Actualizando…",
    next: (countdown: string) => `Se actualiza en ${countdown}`,
  },
  liveError: "Sin conexión con Binance: se usan los datos técnicos diarios.",

  categories: {
    valoracion: {
      name: "Valoración on-chain",
      what: "Compara el precio con lo que «vale» la red según datos on-chain: el precio medio pagado por los holders, los ingresos de los mineros y la media de 200 días.",
      read: "Es la base del score y pesa más en temporalidades largas. Valores altos indican que el precio está muy por encima de su valor de referencia.",
    },
    ciclo: {
      name: "Ciclo",
      what: "Sitúa el momento actual dentro del ciclo de unos 4 años que marcan los halvings y respecto a la tendencia de largo plazo de Bitcoin.",
      read: "Históricamente los techos llegan entre 12 y 18 meses después del halving y los suelos unos 2–2,5 años después.",
    },
    liquidez: {
      name: "Liquidez",
      what: "Mide si entra o sale dinero del sistema: liquidez de la Reserva Federal, masa monetaria M2, fuerza del dólar y oferta de stablecoins.",
      read: "Más liquidez es un entorno favorable para Bitcoin y resta al score; menos liquidez o un dólar fuerte suman.",
    },
    sentimiento: {
      name: "Sentimiento",
      what: "Mide el miedo o la euforia de los inversores y el apalancamiento en los mercados de futuros. En 1 h y 4 h se mide con los derivados de Binance (open interest, ratios long/short y de compras/ventas, y funding), que cambian a ese ritmo; en 1 día, 1 semana y 1 mes, con el Fear & Greed, el SOPR de los holders de corto plazo (datos on-chain diarios), los flujos de los ETF al contado y el funding.",
      read: "La codicia extrema suele coincidir con techos y el miedo extremo con suelos, por eso la codicia suma al score.",
    },
    tecnico: {
      name: "Técnico",
      what: "Indicadores de precio calculados en vivo con las velas de la temporalidad elegida.",
      read: "Es la parte que más cambia y la que más pesa en temporalidades cortas (1 h, 4 h). Valores altos indican sobrecompra.",
    },
  } satisfies Record<CategoryId, Description & { name: string }>,
  weight: (w: string) => `peso ${w} %`,
  scoreColumns:
    "Cada línea muestra el valor actual de la métrica y su puntuación de 0 (barato) a 100 (caro), calculada como percentil frente a los últimos 4 años (un ciclo de halving) salvo que se indique otra cosa. Un punto verde junto a la puntuación marca la zona muy barata (10 o menos) y uno rojo, la muy cara (90 o más).",
  extreme: { cheap: "Zona muy barata", expensive: "Zona muy cara" },

  metrics: {
    mvrv: {
      name: "MVRV",
      what: "Market Value to Realized Value: capitalización de mercado dividida por la capitalización realizada, que valora cada bitcoin al precio al que se movió por última vez.",
      read: "Por encima de 3,5 ha marcado techos de ciclo; por debajo de 1 el mercado cotiza por debajo de lo que pagaron los holders (zona de suelo).",
    },
    puell: {
      name: "Puell Multiple",
      what: "Cuánto están los ingresos diarios de los mineros por emisión de nuevos bitcoins por encima o por debajo de su media de 365 días.",
      read: "Alto: los mineros ganan mucho y tienden a vender. Bajo: capitulación minera, históricamente zona de compra.",
    },
    mayer: {
      name: "Mayer Multiple (frente a MA200d)",
      what: "Mayer Multiple: cuánto está el precio por encima o por debajo de su media móvil de 200 días.",
      read: "Más de un +140 % (el precio a 2,4 veces su media) ha coincidido con burbujas; por debajo de la media (valores negativos), con zonas baratas.",
    },
    halving_phase: {
      name: "Fase del ciclo de halving",
      what: "Parte del ciclo transcurrida desde el último halving (abril de 2024) hasta el siguiente, previsto para abril de 2028. En cada halving, cada ~4 años, se reduce a la mitad la emisión de nuevos bitcoins.",
      read: "Históricamente los techos llegan hacia el 33 % del ciclo y los suelos hacia el 60 %. La puntuación sube al acercarse a la zona de techos y baja al acercarse a la de suelos.",
    },
    power_law: {
      name: "Desviación de la power law",
      what: "Cuánto está el precio por encima o por debajo de la tendencia de largo plazo (ley de potencia) que ha seguido Bitcoin desde su creación. Se mide en escala logarítmica y se muestra en porcentaje.",
      read: "Positivo: por encima de la tendencia (caro). Negativo: por debajo (barato).",
    },
    wma200_ratio: {
      name: "Precio frente a MA200 semanas",
      what: "Cuánto está el precio por encima o por debajo de su media móvil de 200 semanas (unos 4 años, un ciclo completo).",
      read: "Esa media ha actuado como suelo en todos los ciclos: cerca del 0 % (el precio en la media) es zona muy barata; muy por encima, zona de euforia.",
    },
    global_liquidity_roc: {
      name: "Liquidez global (var. 13 sem.)",
      what: "Variación en 13 semanas de la liquidez de los grandes bancos centrales en dólares: liquidez neta de la Fed (balance menos cuenta del Tesoro y repos inversos) más los balances del BCE y del Banco de Japón.",
      read: "Si sube, entra liquidez en los mercados y resta al score; si baja, suma. Anticipa la rentabilidad de BTC bastante mejor que la liquidez de la Fed sola.",
    },
    m2_yoy: {
      name: "M2 EE. UU. (var. interanual)",
      what: "Crecimiento interanual de la masa monetaria M2 de EE. UU. (efectivo, depósitos y equivalentes).",
      read: "La expansión monetaria favorece a los activos escasos como Bitcoin y resta al score.",
    },
    dxy_roc: {
      name: "Dólar DXY amplio (var. 13 sem.)",
      what: "Variación en 13 semanas del índice amplio del dólar frente a las principales divisas.",
      read: "Un dólar que se fortalece endurece las condiciones financieras globales y suma al score.",
    },
    stablecoin_roc: {
      name: "Oferta de stablecoins (var. 90 d)",
      what: "Crecimiento en 90 días de la oferta total de stablecoins (USDT, USDC…), dinero listo para entrar en cripto.",
      read: "Si crece, hay más «pólvora seca» disponible y resta al score.",
    },
    fear_greed: {
      name: "Fear & Greed Index",
      what: "Crypto Fear & Greed Index de Alternative.me: combina volatilidad, volumen, redes sociales, dominancia y búsquedas. Va de 0 (miedo extremo) a 100 (codicia extrema).",
      read: "Se usa directamente como puntuación.",
    },
    sth_sopr: {
      name: "SOPR de corto plazo (7 d)",
      what: "Spent Output Profit Ratio de los holders de corto plazo (monedas de menos de 150 días), media de 7 días: precio de venta entre precio de compra de las monedas que se movieron. +1 % es que vendieron de media con un 1 % de beneficio. Datos on-chain de Bitview.",
      read: "Percentil frente a los últimos 4 años. Alto: los compradores recientes recogen beneficios, típico de mercados eufóricos (suma). Bajo: venden con pérdidas, capitulación típica de los suelos (resta).",
    },
    etf_flows: {
      name: "Flujos de ETF al contado (20 ses.)",
      what: "Entradas menos salidas de los ETF de bitcoin al contado de EE. UU. en las últimas 20 sesiones (aproximadamente un mes), en BTC. Datos de The Commoner Bitcoin ETF Tracker (TFTC), desde enero de 2024.",
      read: "Percentil frente a su historia. Entradas fuertes, típicas de los techos, suman; salidas, típicas de los mínimos, restan. Con menos de tres años de datos, es una señal todavía poco contrastada.",
    },
    funding: {
      name: "Funding rate perpetuos (Binance)",
      what: "Funding rate de los futuros perpetuos de Binance: el pago periódico (cada 8 h) entre posiciones largas y cortas.",
      read: "0,01 % es neutro. Muy positivo indica exceso de apalancamiento alcista (suma); negativo indica pesimismo (resta).",
    },
    open_interest: {
      name: "Open interest",
      what: "Bitcoins en contratos de futuros perpetuos abiertos en Binance: cuánto apalancamiento hay en el mercado.",
      read: "Puntúa por su percentil en los últimos 30 días. Alto: mucho apalancamiento acumulado, que suele acabar en movimientos bruscos y liquidaciones (suma). Bajo: el mercado se ha desapalancado (resta).",
    },
    long_short: {
      name: "Cuentas en largo",
      what: "De las cuentas de Binance con posición en futuros de BTC, qué parte apuesta al alza (en largo). El 50 % es el equilibrio entre largos y cortos.",
      read: "Puntúa por su percentil en los últimos 30 días. Se usa a la contra: cuando casi todos apuestan al alza, el mercado está saturado de compradores (suma); cuando dominan los cortos, al revés (resta).",
    },
    taker_ratio: {
      name: "Compras a mercado",
      what: "Del volumen negociado con órdenes a mercado en los futuros de Binance, qué parte fueron compras (media de las 3 últimas velas). Mide quién tiene prisa por entrar o salir. El 50 % es el equilibrio.",
      read: "Puntúa por su percentil en los últimos 30 días. Por encima del 50 % dominan las compras agresivas (suma); por debajo, las ventas (resta).",
    },
    rsi_14: {
      name: "RSI 14",
      what: "Relative Strength Index de 14 velas: compara la fuerza de las subidas con la de las bajadas recientes.",
      read: "Por encima de 70, sobrecompra; por debajo de 30, sobreventa. Puntúa 0 con RSI 30 o menos y 100 con RSI 70 o más.",
    },
    bollinger: {
      name: "Bollinger %B (20, 2)",
      what: "Posición del precio dentro de las bandas de Bollinger (media de 20 velas ± 2 desviaciones típicas).",
      read: "100: en la banda superior (estirado al alza). 0: en la inferior (estirado a la baja).",
    },
    ma200_ratio: {
      name: "Precio frente a MA200 (percentil)",
      what: "Cuánto está el precio por encima o por debajo de su media de 200 velas en la temporalidad elegida, comparado con las últimas 1000 velas.",
      read: "La puntuación es el percentil: alto significa que el precio está más alejado de su media de lo habitual.",
    },
    ma48_ratio: {
      name: "Precio frente a MA48 meses (percentil)",
      what: "Cuánto está el precio por encima o por debajo de su media de 48 velas mensuales (4 años, un ciclo de halving), comparado con todo el histórico mensual desde 2011. En mensual se usa esta media en lugar de la de 200 velas, que serían 16 años.",
      read: "La puntuación es el percentil: alto significa que el precio está más alejado de su media de lo habitual.",
    },
  } as Record<string, Description & { name: string }>,

  history: {
    title: "Histórico del score diario frente al precio",
    infoLabel: "el histórico",
    infoTitle: "Histórico",
    info1: "Arriba, el precio de Bitcoin en escala logarítmica; abajo, el score diario. Las franjas verde y roja marcan las zonas de muy barato (≤20) y muy caro (≥80).",
    info2: "Cada día se calcula solo con los datos disponibles hasta ese día, así que el histórico refleja lo que el score habría marcado en su momento. Se señalan el máximo y el mínimo del tramo visible.",
    ranges: { "1m": "1 mes", "1y": "1 año", "4y": "4 años", all: "Todo" } as Record<string, string>,
    rangeAria: "Rango del histórico",
    zoomOut: "Alejar",
    zoomIn: "Acercar",
    price: "Precio",
    chartAria: "Gráfico histórico del precio de Bitcoin y del score",
    resizePrice: "Alto del gráfico de precio",
    resizeScore: "Alto del gráfico del score",
    resizeTitle: "Arrastra para cambiar el alto · doble clic para restablecer",
    months: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    max: "Máx",
    min: "Mín",
    hint: (
      <>
        Arrastra el gráfico para desplazarte · Ctrl + rueda, pellizco o <kbd>+</kbd>/<kbd>−</kbd> para hacer zoom · arrastra las
        barras <span aria-hidden="true">═</span> para cambiar el alto de cada gráfico
      </>
    ) as ReactNode,
  },

  outlook: {
    title: "Qué hizo el precio después",
    info: [
      "La tabla toma los días del histórico con un score diario parecido al de hoy (±7,5 puntos) y mide cuánto había cambiado el precio al cabo de cada plazo.",
      "Los días cercanos se parecen mucho entre sí, así que se agrupan en episodios: días de la muestra separados por menos de un mes son el mismo episodio. El tamaño real de la muestra es el número de episodios, no el de días.",
      "El tiempo en una zona se mide con la media de 30 días del score, porque el valor diario es demasiado ruidoso: en pocas semanas puede cruzar varias zonas.",
      '"2 años" muestra solo el mercado más reciente y tiene muy pocos episodios; "4 años" (un ciclo) es lo más parecido al mercado actual, pero tiene pocos episodios; "8 años" (unos dos ciclos) equilibra parecido y tamaño de la muestra; "Desde 2011" tiene más episodios, pero incluye las subidas extremas de los primeros años.',
    ],
    infoNote:
      "El score histórico usa una regresión power law ajustada con todos los datos, así que los resultados pasados salen algo mejores de lo que habría marcado en su momento. Describe el pasado, no predice el futuro.",
    today: (score: ReactNode, label: string, zone: string, days: number, share: ReactNode) => (
      <>
        El score diario está en {score} ({label}, zona {zone}). En los últimos {days} días ha estado en esa zona el {share} del
        tiempo.
      </>
    ),
    smooth: (days: number, value: ReactNode, label: string, streak: ReactNode, streakDays: number, zone: string, since: string) => (
      <>
        Su media de {days} días está en {value} ({label}) y lleva {streak} {streakDays === 1 ? "día seguido" : "días seguidos"} en
        la zona {zone}, desde el {since}.
      </>
    ),
    past: (count: number, longer: number, median: string) =>
      ` De ${count} ${count === 1 ? "racha anterior" : "rachas anteriores"} en esa zona, ${
        longer === 0 ? "ninguna duró más" : `${longer} ${longer === 1 ? "duró" : "duraron"} más`
      } (mediana ${median} días).`,
    sample: (lo: string, hi: string) => `Días con un score diario entre ${lo} y ${hi}: qué hizo el precio después.`,
    horizons: { 30: "1 mes", 90: "3 meses", 180: "6 meses", 365: "1 año" } as Record<number, string>,
    cols: { horizon: "Plazo", median: "Mediana", rose: "Subió", range: "Peor / mejor", sample: "Muestra" },
    notEnough: "Sin datos suficientes",
    days: (n: number) => `${n} días`,
    episodes: (n: number) => `${n} ${n === 1 ? "episodio" : "episodios"}`,
    vol: (value: ReactNode, pct: ReactNode) => (
      <>
        Volatilidad de los últimos 30 días: {value} anualizada, percentil {pct} de los últimos 4 años.
      </>
    ),
    volLow: " Una volatilidad tan baja suele anticipar un movimiento fuerte, pero no indica en qué dirección.",
    volHigh: " Una volatilidad tan alta suele darse en caídas bruscas o subidas verticales.",
    note: "Datos históricos, no una predicción ni una recomendación de inversión.",
  },

  moves: {
    title: "Caídas y subidas desde máximo y mínimo",
    info: [
      "Cuenta los días desde la última caída y la última subida de cada tamaño, con precios de cierre diarios más el precio actual como último dato, y los compara con lo habitual en el periodo elegido: cuántos días solían llevar sin producirse en un día cualquiera (la mediana).",
      "Una caída del 10 % se cuenta cuando el cierre queda un 10 % por debajo del máximo alcanzado desde la anterior caída de ese tamaño; desde ahí se vuelve a medir. Las subidas, igual desde el mínimo. Como Bitcoin cotiza 24 h, cada vela diaria abre en el cierre de la anterior, así que equivale a medir de apertura a cierre.",
      "No se usa el tiempo medio entre dos casos porque estos movimientos llegan en rachas (varias caídas del 5 % en un mismo desplome) y esa media es engañosamente corta.",
      "La barra indica qué parte de los días del periodo llevaban menos tiempo sin ese movimiento que hoy; la marca central es lo habitual. En naranja, los que superan al 90 % de los días.",
    ],
    infoNote:
      "Llevar más tiempo que la media sin un movimiento no significa que vaya a producirse pronto: no siguen un calendario y las fases tranquilas tienden a alargarse.",
    drops: "Caídas desde máximo",
    rallies: "Subidas desde mínimo",
    cols: { size: "Tamaño", since: "Hace", typical: "Habitual" },
    days: (n: number) => (n === 0 ? "Hoy" : `${n.toLocaleString("es-ES")} ${n === 1 ? "día" : "días"}`),
    count: (n: number) => `${n} ${n === 1 ? "vez" : "veces"} en el periodo`,
    none: "Ninguna en el periodo",
    percentile: (p: number) => `Más tiempo sin producirse que en el ${p}\u00A0% de los días del periodo`,
    overDrops: (list: string) => `Las caídas de ${list} llevan más tiempo sin producirse que en el 90\u00A0% de los días del periodo.`,
    overRallies: (list: string) => `Las subidas de ${list} llevan más tiempo sin producirse que en el 90\u00A0% de los días del periodo.`,
    allNormal: "Ninguna caída ni subida lleva un tiempo inusualmente largo sin producirse.",
    note: "Datos históricos, no una predicción ni una recomendación de inversión.",
  },

  calendar: {
    title: "Agenda económica de la semana",
    info: [
      "Los datos económicos y decisiones de bancos centrales de esta semana que más pueden mover los mercados y el precio de BTC: los de impacto alto de EE. UU. y las decisiones de tipos del BCE, el Banco de Japón, el Banco de Inglaterra y China.",
      "Las horas están en tu zona horaria. Previsión es lo que espera el mercado; anterior, el último dato publicado. Cuando el dato se aleja de la previsión es cuando más se mueve el precio. Nombres de los eventos traducidos con IA.",
    ],
    forecast: "Prev.",
    previous: "Ant.",
    countries: { USD: "EE. UU.", EUR: "Eurozona", JPY: "Japón", GBP: "R. Unido", CNY: "China" } as Record<string, string>,
    note: "Fuente: Forex Factory.",
  },

  news: {
    title: "Últimas noticias del mercado",
    info: [
      "Titulares recientes de Cointelegraph, CoinDesk, Decrypt, Investing.com, CNBC, BBC y la Reserva Federal. Cada 15 minutos en horario de mercado (cada hora el resto del tiempo), un modelo de IA los clasifica según su posible impacto en el precio de BTC a corto plazo, descarta los repetidos y traduce los titulares.",
      "Se muestran las 10 de más impacto de las últimas 48 horas, con prioridad para las más recientes. Cada titular enlaza a la noticia original; la selección y la traducción automáticas pueden contener errores. El indicador de color muestra el impacto estimado:",
    ],
    levels: { high: "Impacto alto", mid: "Impacto medio", low: "Impacto moderado" },
    categories: {
      geopolitica: "Geopolítica",
      macro: "Macro",
      crisis: "Crisis",
      mercados: "Mercados",
      flujos: "Flujos",
      cripto: "Cripto",
    } as Record<string, string>,
    note: "Seleccionadas y traducidas con IA.",
  },

  donate: {
    title: "Apoya el proyecto",
    infoLabel: "las donaciones",
    infoTitle: "Donaciones",
    info1: "Is BTC Cheap? es gratuito y sin publicidad. Las donaciones son voluntarias y ayudan a cubrir el dominio y el tiempo de desarrollo; no dan acceso a nada adicional.",
    info2: "Las direcciones de wallet son públicas: cualquier pago a ellas queda registrado en la blockchain.",
    coffee: "Si te resulta útil, puedes invitarme a un café ☕",
    paypal: "Donar con PayPal",
    networkAria: "Red",
    qrAria: "Código QR de la dirección",
    copy: "Copiar",
    copied: "¡Copiada!",
    openWallet: "Abrir en wallet",
    hints: {
      btc: "Red Bitcoin (on-chain). Envía solo BTC a esta dirección.",
      ln: "Lightning Network: pagos instantáneos y casi sin comisión, ideal para cantidades pequeñas.",
    } as Record<string, string>,
  },

  footer: {
    dataAsOf: (asOf: string, updated: string) =>
      `Datos on-chain, de ciclo y de liquidez a ${asOf} (se recalculan una vez al día; última ejecución ${updated}).`,
    missing: (list: string) => ` Fuentes no disponibles hoy: ${list}.`,
    sources: "Fuentes:",
    /** Nombres de las fuentes por URL; las que no estén usan el nombre del pipeline */
    attribution: {} as Record<string, string>,
    disclaimer: "Este indicador es informativo y no constituye asesoramiento financiero.",
    credit: "Desarrollado por",
  },
};

export type Messages = typeof es;
