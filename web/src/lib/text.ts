/**
 * Une cada cifra con su unidad (%, $, US$, M$, €, BTC) y los rangos "73.400-74.000" con un espacio y un guion que no se
 * parten. Los textos de los modelos (análisis, titulares, agenda) usan espacios normales, y el símbolo podía quedarse
 * solo al principio de la línea siguiente.
 */
export const keepUnits = (s: string) =>
  s.replace(/(\d)[ \u202f](%|US\$|M\$|\$|€|BTC\b)/g, "$1\u00a0$2").replace(/(\d)-(?=\d)/g, "$1\u2011");
