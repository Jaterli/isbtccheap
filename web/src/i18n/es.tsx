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
  percent: (n: string) => `${n} %`,
  language: "Idioma",
  /** Periodo de la muestra de las tarjetas de estadística histórica */
  periods: { "2y": "2 años", "4y": "4 años", "8y": "8 años", all: "Desde 2011" } as Record<string, string>,
  periodAria: "Periodo de la muestra",

  tagline: "¿Está Bitcoin barato o caro? Un índice de 1 a 100 que combina valoración on-chain, ciclos, liquidez, sentimiento y análisis técnico.",

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
  },

  refresh: {
    updating: "Actualizando…",
    next: (countdown: string) => `Se actualiza en ${countdown}`,
    infoLabel: "la actualización",
    infoTitle: "Actualización",
    info1: (interval: string) =>
      `El técnico y el funding se actualizan solos cada ${interval} en esta temporalidad. Al cambiar de temporalidad se reutilizan los datos ya descargados mientras sigan vigentes.`,
    info2: "Las métricas on-chain, de ciclo y de liquidez se recalculan una vez al día.",
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
      what: "Mide el miedo o la euforia de los inversores y el apalancamiento en los mercados de futuros. En 1 h y 4 h se mide con los derivados de Binance (open interest, ratios long/short y de compras/ventas, y funding), que cambian a ese ritmo; en 1 día, 1 semana y 1 mes, con el Fear & Greed, que es diario, y el funding.",
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
    "Cada línea muestra el valor actual de la métrica y su puntuación de 0 (barato) a 100 (caro), calculada como percentil frente a los últimos 4 años (un ciclo de halving) salvo que se indique otra cosa.",

  metrics: {
    mvrv: {
      name: "MVRV",
      what: "Market Value to Realized Value: capitalización de mercado dividida por la capitalización realizada, que valora cada bitcoin al precio al que se movió por última vez.",
      read: "Por encima de 3,5 ha marcado techos de ciclo; por debajo de 1 el mercado cotiza por debajo de lo que pagaron los holders (zona de suelo).",
    },
    puell: {
      name: "Puell Multiple",
      what: "Ingresos diarios de los mineros por emisión de nuevos bitcoins divididos por su media de 365 días.",
      read: "Alto: los mineros ganan mucho y tienden a vender. Bajo: capitulación minera, históricamente zona de compra.",
    },
    mayer: {
      name: "Mayer Multiple (precio / MA200d)",
      what: "Mayer Multiple: precio dividido por su media móvil de 200 días.",
      read: "Por encima de 2,4 ha coincidido con burbujas; por debajo de 1 con zonas baratas.",
    },
    halving_phase: {
      name: "Fase del ciclo de halving",
      what: "Posición dentro del ciclo entre dos halvings (cada ~4 años se reduce a la mitad la emisión de nuevos bitcoins).",
      read: "El valor ya es una puntuación: sube hacia la zona en la que históricamente se formaron los techos y baja hacia la de los suelos.",
    },
    power_law: {
      name: "Desviación de la power law",
      what: "Cuánto está el precio por encima o por debajo de la tendencia de largo plazo (ley de potencia) que ha seguido Bitcoin desde su creación. Se mide en escala logarítmica y se muestra en porcentaje.",
      read: "Positivo: por encima de la tendencia (caro). Negativo: por debajo (barato).",
    },
    wma200_ratio: {
      name: "Precio / MA200 semanas",
      what: "Precio dividido por la media móvil de 200 semanas (unos 4 años, un ciclo completo).",
      read: "Esa media ha actuado como suelo en todos los ciclos: cerca de 1 es zona muy barata; muy por encima, zona de euforia.",
    },
    net_liquidity_roc: {
      name: "Liquidez neta Fed (var. 13 sem.)",
      what: "Variación en 13 semanas de la liquidez neta de la Fed: balance de la Reserva Federal menos la cuenta del Tesoro y los repos inversos.",
      read: "Si sube, entra liquidez en los mercados y resta al score; si baja, suma.",
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
      name: "Precio / MA200 (percentil)",
      what: "Precio dividido por su media de 200 velas en la temporalidad elegida, comparado con las últimas 1000 velas.",
      read: "La puntuación es el percentil: alto significa que el precio está más alejado de su media de lo habitual.",
    },
    ma48_ratio: {
      name: "Precio / MA48 meses (percentil)",
      what: "Precio dividido por su media de 48 velas mensuales (4 años, un ciclo de halving), comparado con todo el histórico mensual desde 2011. En mensual se usa esta media en lugar de la de 200 velas, que serían 16 años.",
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
      "Cuenta los días desde la última caída y la última subida de cada tamaño, con precios de cierre diarios, y los compara con lo habitual en el periodo elegido: cuántos días solían llevar sin producirse en un día cualquiera (la mediana).",
      "Una caída del 10 % se cuenta cuando el cierre queda un 10 % por debajo del máximo alcanzado desde la anterior caída de ese tamaño; desde ahí se vuelve a medir. Las subidas, igual desde el mínimo. Como Bitcoin cotiza 24 h, cada vela diaria abre en el cierre de la anterior, así que equivale a medir de apertura a cierre.",
      "No se usa el tiempo medio entre dos casos porque estos movimientos llegan en rachas (varias caídas del 5 % en un mismo desplome) y esa media es engañosamente corta.",
      "La barra indica qué parte de los días del periodo llevaban menos tiempo sin ese movimiento que hoy; la marca central es lo habitual. En naranja, los que superan al 90 % de los días.",
    ],
    infoNote:
      "Llevar más tiempo que la media sin un movimiento no significa que vaya a producirse pronto: no siguen un calendario y las fases tranquilas tienden a alargarse.",
    drops: "Caídas desde máximo",
    rallies: "Subidas desde mínimo",
    cols: { size: "Tamaño", since: "Hace", typical: "Habitual" },
    days: (n: number) => `${n.toLocaleString("es-ES")} ${n === 1 ? "día" : "días"}`,
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
      "Las horas están en tu zona horaria. Previsión es lo que espera el mercado; anterior, el último dato publicado. Cuando el dato se aleja de la previsión es cuando más se mueve el precio.",
    ],
    forecast: "Prev.",
    previous: "Ant.",
    countries: { USD: "EE. UU.", EUR: "Eurozona", JPY: "Japón", GBP: "R. Unido", CNY: "China" } as Record<string, string>,
    note: "Fuente: calendario de Forex Factory. Nombres de los eventos traducidos con IA.",
  },

  news: {
    title: "Noticias que pueden mover el precio",
    info: [
      "Titulares recientes de Cointelegraph, CoinDesk, Decrypt, Investing.com, CNBC, BBC y la Reserva Federal. Cada 15 minutos un modelo de IA los clasifica según su posible impacto en el precio de BTC a corto plazo, descarta los repetidos y traduce los titulares.",
      "Se muestran las 10 de más impacto de las últimas 48 horas, de la más reciente a la más antigua. El indicador de color muestra el impacto estimado:",
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
    note: "Selección y traducción automáticas con IA: pueden contener errores. Cada titular enlaza a la noticia original. No es asesoramiento financiero.",
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
