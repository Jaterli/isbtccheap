import type { CategoryId } from "../types";

export interface Description {
  /** Qué mide */
  what: string;
  /** Cómo interpretarlo en el score */
  read: string;
}

export const CATEGORY_INFO: Record<CategoryId, Description> = {
  valoracion: {
    what: "Compara el precio con lo que «vale» la red según datos on-chain: el precio medio pagado por los holders, los ingresos de los mineros y la media de 200 días.",
    read: "Es la base del score y pesa más en temporalidades largas. Valores altos indican que el precio está muy por encima de su valor de referencia.",
  },
  ciclo: {
    what: "Sitúa el momento actual dentro del ciclo de unos 4 años que marcan los halvings y respecto a la tendencia de largo plazo de Bitcoin.",
    read: "Históricamente los techos llegan entre 12 y 18 meses después del halving y los suelos unos 2–2,5 años después.",
  },
  liquidez: {
    what: "Mide si entra o sale dinero del sistema: liquidez de la Reserva Federal, masa monetaria M2, fuerza del dólar y oferta de stablecoins.",
    read: "Más liquidez es un entorno favorable para Bitcoin y resta al score; menos liquidez o un dólar fuerte suman.",
  },
  sentimiento: {
    what: "Mide el miedo o la euforia de los inversores y el apalancamiento en los mercados de futuros.",
    read: "La codicia extrema suele coincidir con techos y el miedo extremo con suelos, por eso la codicia suma al score.",
  },
  tecnico: {
    what: "Indicadores de precio calculados en vivo con las velas de la temporalidad elegida.",
    read: "Es la parte que más cambia y la que más pesa en temporalidades cortas (15 min, 1 h). Valores altos indican sobrecompra.",
  },
};

export const METRIC_INFO: Record<string, Description> = {
  mvrv: {
    what: "Market Value to Realized Value: capitalización de mercado dividida por la capitalización realizada, que valora cada bitcoin al precio al que se movió por última vez.",
    read: "Por encima de 3,5 ha marcado techos de ciclo; por debajo de 1 el mercado cotiza por debajo de lo que pagaron los holders (zona de suelo).",
  },
  puell: {
    what: "Ingresos diarios de los mineros por emisión de nuevos bitcoins divididos por su media de 365 días.",
    read: "Alto: los mineros ganan mucho y tienden a vender. Bajo: capitulación minera, históricamente zona de compra.",
  },
  mayer: {
    what: "Mayer Multiple: precio dividido por su media móvil de 200 días.",
    read: "Por encima de 2,4 ha coincidido con burbujas; por debajo de 1 con zonas baratas.",
  },
  halving_phase: {
    what: "Posición dentro del ciclo entre dos halvings (cada ~4 años se reduce a la mitad la emisión de nuevos bitcoins).",
    read: "El valor ya es una puntuación: sube hacia la zona en la que históricamente se formaron los techos y baja hacia la de los suelos.",
  },
  power_law: {
    what: "Distancia, en escala logarítmica, entre el precio y la tendencia de largo plazo (ley de potencia) que ha seguido Bitcoin desde su creación.",
    read: "Positivo: por encima de la tendencia (caro). Negativo: por debajo (barato).",
  },
  wma200_ratio: {
    what: "Precio dividido por la media móvil de 200 semanas (unos 4 años, un ciclo completo).",
    read: "Esa media ha actuado como suelo en todos los ciclos: cerca de 1 es zona muy barata; muy por encima, zona de euforia.",
  },
  net_liquidity_roc: {
    what: "Variación en 13 semanas de la liquidez neta de la Fed: balance de la Reserva Federal menos la cuenta del Tesoro y los repos inversos.",
    read: "Si sube, entra liquidez en los mercados y resta al score; si baja, suma.",
  },
  m2_yoy: {
    what: "Crecimiento interanual de la masa monetaria M2 de EE. UU. (efectivo, depósitos y equivalentes).",
    read: "La expansión monetaria favorece a los activos escasos como Bitcoin y resta al score.",
  },
  dxy_roc: {
    what: "Variación en 13 semanas del índice amplio del dólar frente a las principales divisas.",
    read: "Un dólar que se fortalece endurece las condiciones financieras globales y suma al score.",
  },
  stablecoin_roc: {
    what: "Crecimiento en 90 días de la oferta total de stablecoins (USDT, USDC…), dinero listo para entrar en cripto.",
    read: "Si crece, hay más «pólvora seca» disponible y resta al score.",
  },
  fear_greed: {
    what: "Crypto Fear & Greed Index de Alternative.me: combina volatilidad, volumen, redes sociales, dominancia y búsquedas. Va de 0 (miedo extremo) a 100 (codicia extrema).",
    read: "Se usa directamente como puntuación.",
  },
  funding: {
    what: "Funding rate de los futuros perpetuos de Binance: el pago periódico (cada 8 h) entre posiciones largas y cortas.",
    read: "0,01 % es neutro. Muy positivo indica exceso de apalancamiento alcista (suma); negativo indica pesimismo (resta).",
  },
  rsi_14: {
    what: "Relative Strength Index de 14 velas: compara la fuerza de las subidas con la de las bajadas recientes.",
    read: "Por encima de 70, sobrecompra; por debajo de 30, sobreventa. Puntúa 0 con RSI 30 o menos y 100 con RSI 70 o más.",
  },
  bollinger: {
    what: "Posición del precio dentro de las bandas de Bollinger (media de 20 velas ± 2 desviaciones típicas).",
    read: "100: en la banda superior (estirado al alza). 0: en la inferior (estirado a la baja).",
  },
  ma200_ratio: {
    what: "Precio dividido por su media de 200 velas en la temporalidad elegida, comparado con las últimas 1000 velas.",
    read: "La puntuación es el percentil: alto significa que el precio está más alejado de su media de lo habitual.",
  },
};

export const SCORE_COLUMNS =
  "Cada línea muestra el valor actual de la métrica y su puntuación de 0 (barato) a 100 (caro), calculada como percentil frente a los últimos 4 años (un ciclo de halving) salvo que se indique otra cosa.";
