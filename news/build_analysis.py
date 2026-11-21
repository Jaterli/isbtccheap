"""Genera analysis.json: un análisis breve de la situación de BTC hecho por IA, con sus soportes, resistencias, sesgo, lo
más probable en las próximas horas y en 1-2 días, y un escenario alternativo.

El modelo recibe datos de mercado en bruto (velas de 1 h, 4 h y diarias, derivados, Fear & Greed y flujos de los ETF),
la hora actual y si la bolsa de EE. UU. está abierta (en fin de semana la liquidez es menor) y, como contexto, los
titulares de impacto medio y alto de las últimas 48 h que ya clasifica build_news.py y la agenda económica de la
semana de build_calendar.py. Nunca recibe niveles ni conclusiones
nuestras: el análisis es suyo.

Los modelos de ANALYSIS_MODELS se prueban en orden: si uno falla o su respuesta no se sostiene (zonas al lado equivocado
del precio, objetivos fuera de rango, escenarios incoherentes), se pasa al siguiente (proveedores y prefijos en llm.py).
Si ninguno sirve se mantiene el analysis.json anterior.
Cada análisis publicado se añade a state/analysis_log.jsonl para poder medir después cuánto acierta.

Variables de entorno (ver .env.example): DO_MODEL_ACCESS_KEY, GEMINI_API_KEY (para los gemini:), ANALYSIS_MODELS,
NEWS_OUT_DIR, NEWS_STATE_DIR.
La tendencia de fondo (semanas y meses) se analiza aparte, cada lunes (--weekly, trend.json), y el análisis diario la
recibe como contexto; si un cierre diario supera uno de sus niveles de revisión, el diario la revisa antes.
Uso: python build_analysis.py [--dry-run | --weekly]   (--dry-run no llama al modelo: zonas de prueba, para probar la web)
"""

import argparse
import json
import logging
import math
import os
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import llm  # noqa: E402
from build_news import OUT_DIR, STATE_DIR, write_json  # noqa: E402

log = logging.getLogger("analysis")

# Por orden de preferencia (llm.py). En las pruebas (31 oct 2026), GLM-5.3 Flash dio el análisis más completo y preciso;
# Gemini 3.5 Flash acertó también pero con menos detalle (queda de respaldo, en el nivel gratuito), y DeepSeek V4 Flash
# confundía tendencias de los derivados. Qwen 3.5, el primer respaldo, dejó de estar en DigitalOcean (10 nov 2026).
# gpt-oss-120b (DigitalOcean; en Groq no cabe: los datos superan los 8.000 tokens por minuto de su nivel gratuito) se
# descartó: en las pruebas y en un análisis publicado (10 nov 2026) leyó mal la estructura semanal, inventó niveles y no
# respeta el formato de los precios. Si fallan todos, la web mantiene el análisis anterior, mejor que uno erróneo.
# glm-5.3-flash@high, de respaldo si GLM agota dos veces los tokens razonando (11 nov 2026, mismos datos): sin parámetro
# GLM razona al máximo (20.000-26.000 tokens, 3-4 min) y da los textos más detallados y estables; con reasoning_effort
# "high" o "medium" razona unos 3.000 (30-45 s) con zonas y escenarios parecidos, pero textos algo menos precisos y una
# dirección menos estable entre intentos. "high" salió algo mejor que "medium"; con "low" o "none" no razona y falla
MODELS = llm.models_from_env("ANALYSIS_MODELS", "glm-5.3-flash,glm-5.3-flash@high,gemini:gemini-3.5-flash,"
                             "gemini:gemini-flash-latest")
SPOT = "https://data-api.binance.vision/api/v3"
FUTURES = "https://fapi.binance.com"
PRICE_URL = f"{SPOT}/ticker/price?symbol=BTCUSDT"
LATEST_URL = os.environ.get("ANALYSIS_LATEST_URL", "https://raw.githubusercontent.com/Jaterli/isbtccheap/main/web/public/data/latest.json")
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}
# Histórico diario de la web (cierres desde 2011), para los techos y suelos de ciclo
HISTORY_URL = LATEST_URL.rsplit("/", 1)[0] + "/history.json"
LIQUIDITY_URL = LATEST_URL.rsplit("/", 1)[0] + "/liquidity_scores.json"
CAPITULATION_URL = LATEST_URL.rsplit("/", 1)[0] + "/capitulation.json"

# Titulares de news.json que se pasan como contexto: los de impacto medio y alto (naranja y rojo en la web) y recientes
NEWS_MIN_IMPACT = 5
NEWS_MAX_HOURS = 48

MAX_LEVELS = 3
# Distancia máxima de un objetivo: un 15 % en horas o un 20 % en 1-2 días ya no es un escenario razonable
MAX_SHORT = 0.15
MAX_DAYS = 0.20

# Ordenado de más a menos importante: primero las reglas que más se saltaban los modelos (zonas, niveles exactos,
# bases), después el formato y al final cómo leer los datos, que es material de consulta. Repetir las reglas en una lista
# de comprobación después de los datos (11 nov 2026) hizo que GLM agotara los 32.000 tokens revisándolas: sin ella, ~22.000
PROMPT = """Eres un analista de mercado de Bitcoin. Recibes en JSON datos de mercado en bruto de BTC/USDT (descritos al \
final) y haces tu propio análisis de la situación actual de BTC: tú decides qué factores pesan más. Respondes solo con \
un objeto JSON con las zonas de soporte y resistencia, el sesgo, los escenarios más probables y las claves que los \
explican; otro modelo redactará después los textos a partir de tu análisis.

REGLAS PRINCIPALES

1. Zonas (supports y resistances): elige de zone_candidates de 1 a 3 de cada lado del precio actual, solo las \
realmente relevantes, y da su id con strength de 1 (débil) a 3 (fuerte): los soportes, entre las de side "below"; las \
resistencias, entre las de side "above". Las candidatas ya están calculadas desde las zonas donde el precio ha girado de \
verdad (afinadas con las de 4 h sólidas y partidas en el precio si lo contienen): no construyas zonas propias. Si no \
hay ninguna candidata de un lado (el precio en mínimos o máximos de años), deja ese lado vacío y saca los objetivos de \
ese lado de otros niveles de los datos (pivotes semanales, huecos semanales, extensiones de Fibonacci) o del ATR.
- Fuerza: más a las zonas con más reacciones y más recientes; menos a las que los cierres han atravesado varias veces \
sin girar (crossings), sobre todo desde su última reacción (crossings_since_last): el precio ya no las respeta. Una \
sola ruptura seguida de una reacción desde el otro lado no resta, porque confirma la zona con el papel cambiado. Las \
confluencias (confluences: niveles de Fibonacci, pivotes, liquidez o imbalances dentro de la zona) la refuerzan.

2. Precios exactos: en los objetivos y las invalidaciones usa los precios de los niveles de los datos, sin redondearlos. \
Solo se redondean en los textos.

3. Cada objetivo e invalidación sale de un nivel de los datos, y lo indicas en su base (target_basis e \
invalidation_basis: {"kind": ..., "timeframe": ...}). kind: "reaction_zone" (un borde de una zona de zone_candidates, \
en 1d o 4h), "liquidity_pool" (en 1d o 4h), \
"imbalance" (en 1w, 1d o 4h), "pivot" (de market_structure, en 1w o 1d, incluido el extremo en curso), "fibonacci" (en \
1d) o, si no hay un nivel cerca y lo estimas por la volatilidad, "atr" (en cualquier temporalidad).

4. Escenarios realistas: ajusta objetivos e invalidaciones a la volatilidad reciente (ATR). En las próximas horas el \
precio suele moverse unos pocos ATR de 1 h, y en 1-2 días, del orden de 1-2 ATR diarios: un objetivo mucho más lejano es \
poco probable en ese plazo. Ten en cuenta la tendencia de fondo (background_trend, la revisión semanal, y las velas \
semanales y diarias, sus indicadores, market_structure y trend_context): un movimiento de pocas horas no la cambia por \
sí solo. La liquidez \
pendiente y los imbalances cercanos son objetivos habituales del precio (suele ir a barrerlos o a rellenarlos antes de \
girar), y Fibonacci sirve para los objetivos, sobre todo cuando el precio atraviesa un tramo sin zonas de reacción, \
como un imbalance grande.

5. Las claves (notes) son lo único que verá quien redacte los textos, además de tus zonas y escenarios: cada una con \
sus cifras exactas de los datos y bien interpretada (por ejemplo, si un dato salió por encima o por debajo de la \
previsión y qué implica para BTC, o qué indica un dato on-chain, sin exagerarlo). Escríbelas en lenguaje llano, como \
para un lector que no es especialista: el redactor tiende a copiar tus palabras. Nada de abreviaturas ni de los nombres \
de los campos del JSON (%B, HH, LL, m/m, current_extreme, crossings, imbalance…): "el mínimo de ayer en X $", "la parte \
baja de su rango habitual", "el hueco que el precio dejó sin rellenar entre X e Y $", "máximos cada vez más bajos". \
Soporte, resistencia, Fibonacci o liquidez sí valen.

FORMATO DE LA RESPUESTA

Solo un objeto JSON, sin texto antes ni después, con esta forma:
{
  "price": precio actual de BTC en dólares (número),
  "supports": [{"id": id de zone_candidates, "strength": 1 a 3}, ...],
  "resistances": [{"id": id de zone_candidates, "strength": 1 a 3}, ...],
  "bias": "alcista" | "bajista" | "neutral",
  "confidence": 1 a 3,
  "outlook": {"direction": "alcista" | "bajista" | "lateral", "target": número, "target_basis": base, "invalidation": número, \
"invalidation_basis": base, "horizon_hours": número},
  "outlook_days": {"direction": "alcista" | "bajista" | "lateral", "target": número, "target_basis": base, "invalidation": número, \
"invalidation_basis": base},
  "alternative": {"direction": "alcista" | "bajista" | "lateral", "target": número, "target_basis": base},
  "notes": {"drivers": [texto, ...]}
}

- bias: el sesgo de corto plazo y confidence, tu confianza en él, de 1 (baja) a 3 (alta).
- outlook: lo más probable en las próximas horas (horizon_hours entre 4 y 24): dirección, precio objetivo y precio que \
invalidaría ese escenario (al otro lado del precio actual).
- outlook_days: lo más probable en 1-2 días, con su dirección, objetivo e invalidación (al otro lado del precio actual). \
Puede coincidir o no con el de las próximas horas.
- alternative: el escenario alternativo de las próximas horas, menos probable y en una dirección distinta de la de \
outlook.
- notes, en español: drivers, de 3 a 6 claves de lo que está moviendo el precio y de por qué esperas cada escenario, \
una frase cada una con sus cifras. La tendencia de fondo no se reescribe: es la de background_trend.

CÓMO LEER LOS DATOS

- Velas semanales (un año), diarias (6 meses), de 4 h (20 días) y de 1 h (3 días) ([hora UTC, apertura, máximo, mínimo, cierre, volumen en BTC], la \
última en curso: su cierre es el precio actual) e indicadores de cada temporalidad, calculados con un histórico más \
largo: RSI 14 (y en el máximo y el mínimo de 50 velas), %B de Bollinger, distancia a las medias de 50 y 200 velas, \
máximos y mínimos de 20 y 50 velas, y ATR 14.
- zone_candidates: las zonas donde el precio ha girado de verdad, de la más alta a la más baja (ver la regla 1), con las \
reacciones de cada temporalidad (cuántas, como techo o como suelo, la última y los cruces sin girar), daily_range si es \
una de 4 h dentro de una diaria, split_at_price si es parte de una zona partida en el precio, y confluences, los niveles \
que caen dentro.
- market_structure, semanal y diaria: los últimos pivotes (HH, LH, HL, LL, con su RSI), el extremo en curso \
(current_extreme, aún sin confirmar), la última ruptura de un pivote por un cierre y las divergencias del RSI: \
referencias para el sesgo, no certezas. Solo en diario, Fibonacci en escala logarítmica de dos tramos: main (desde el \
último mínimo que el precio no ha perdido hasta el máximo posterior, o al revés en bajada) y correction (desde su final; \
si es provisional, sin extensiones).
- liquidity_pools (diario y 4 h): máximos y mínimos que el precio no ha vuelto a superar, donde se acumulan stops; los \
iguales concentran más. imbalances (semanal, diario y 4 h): huecos que el precio no ha rellenado.
- background_trend: la tendencia de fondo de la revisión semanal (cada lunes tras el cierre semanal, o antes si un \
cierre diario superó uno de sus niveles de revisión): su dirección, su texto y los cierres diarios que la harían \
revisar (review_above y review_below). No la reanalices: tus escenarios de horas y días pueden ir en contra de ella, \
pero sabiéndolo.
- trend_context (máximo y mínimo de 12 meses) y cycle_context (máximo histórico y ciclos anteriores): para encuadrar la \
tendencia de fondo, no para predecir por analogía.
- Derivados, en series de la más antigua a la más reciente: open interest, porcentaje de cuentas en largo y ratio de \
compras/ventas a mercado (cada 4 h, 7 días) y Fear & Greed (14 días); flujos netos \
de los ETF en 20 sesiones; la fecha y hora, y si la bolsa de EE. UU. está abierta.
- Agenda económica de la semana (previsión, dato anterior y real) y fed_decision_odds: probabilidades de cada decisión \
de las próximas reuniones de la Fed según Kalshi, ahora, hace 24 h y hace 7 días (sus cambios muestran cómo ha \
reinterpretado el mercado los datos recientes).
- short_term_holders (holders de corto plazo, monedas movidas hace menos de 155 días; datos diarios con un día de \
retraso): pérdida no realizada y realizada frente a su media de 90 días y en qué % de los días de los últimos 4 años fue \
menor (above_pct_of_days_4y: 97 = mayor que en el 97 % de los días), y SOPR (por debajo de \
1, venden con pérdidas). Una pérdida no realizada alta es estrés y riesgo de más ventas; capitulación es cuando venden de \
verdad (pérdida realizada disparada y SOPR claramente por debajo de 1, a menudo con pico de volumen, caída del open \
interest y miedo extremo), y suele quedar cerca de un suelo. Contexto para el sesgo, no una señal de giro por sí solo. \
capitulation.level ya lo clasifica: none, capitulation_levels (pérdida realizada de 5 veces su media o más con SOPR por \
debajo de 1) o intense_capitulation (además, SOPR de 0,97 o menos o pérdida en dólares en el 1 % más alto de 4 años). \
Con capitulation_levels, una pérdida en dólares mayor que en el 95 % de los días es muy alta pero queda por debajo de \
la de las grandes capitulaciones, que fueron las mayores de su periodo.
- long_term_holders (monedas movidas hace más de 155 días, mismo retraso): pérdida realizada frente a su media de 90 días \
y su último pico del año (5 veces su media o más). En los mercados alcistas es casi cero; su primer pico tras un periodo \
así ha marcado el inicio de fases bajistas (2018, 2021, 2025: los compradores del techo venden con pérdidas), no suelos. \
Contexto de fondo para el sesgo de días y semanas, no para las próximas horas.
- news_headlines: titulares de impacto medio y alto (hora UTC, medio, impacto de 0 a 10), como contexto.
- vix: el índice de volatilidad de la bolsa de EE. UU. (Cboe) al último cierre y su cambio en 5 sesiones. Mide el miedo \
en la bolsa: BTC suele moverse el mismo día que el Nasdaq, y un VIX disparado dice que la venta viene de fuera de cripto. \
Contexto del entorno de riesgo, no una señal de giro para las próximas horas."""


# Las zonas se eligen de zone_candidates por su id: el modelo no copia bordes (los redondeaba o los cambiaba)
ZONE = {"type": "object", "properties": {"id": {"type": "string"}, "strength": {"type": "integer"}},
        "required": ["id", "strength"], "additionalProperties": False}
DIRECTION = {"type": "string", "enum": ["alcista", "bajista", "lateral"]}
TEXT = {"type": "object",
        "properties": {"headline": {"type": "string"}, "summary": {"type": "string"},
                       "outlook": {"type": "string"}, "outlook_days": {"type": "string"},
                       "points": {"type": "array", "items": {"type": "string"}}},
        "required": ["headline", "summary", "outlook", "outlook_days", "points"], "additionalProperties": False}
# De qué nivel de los datos sale un objetivo o una invalidación (se comprueba en check_basis)
BASIS_KINDS = ["reaction_zone", "liquidity_pool", "imbalance", "pivot", "fibonacci", "atr"]
BASIS = {"type": "object", "properties": {"kind": {"type": "string", "enum": BASIS_KINDS},
                                          "timeframe": {"type": "string", "enum": ["1w", "1d", "4h", "1h"]}},
         "required": ["kind", "timeframe"], "additionalProperties": False}
MOVE = {"type": "object", "properties": {"direction": DIRECTION, "target": {"type": "number"}, "target_basis": BASIS,
                                         "invalidation": {"type": "number"}, "invalidation_basis": BASIS},
        "required": ["direction", "target", "target_basis", "invalidation", "invalidation_basis"], "additionalProperties": False}
# Esquema estricto (DigitalOcean, compatible con OpenAI, y Gemini): todos los campos obligatorios
SCHEMA = {
    "type": "object",
    "properties": {
        "price": {"type": "number"},
        "supports": {"type": "array", "items": ZONE},
        "resistances": {"type": "array", "items": ZONE},
        "bias": {"type": "string", "enum": ["alcista", "bajista", "neutral"]},
        "confidence": {"type": "integer"},
        "outlook": {**MOVE, "properties": {**MOVE["properties"], "horizon_hours": {"type": "integer"}},
                    "required": [*MOVE["required"], "horizon_hours"]},
        "outlook_days": MOVE,
        "alternative": {"type": "object", "properties": {"direction": DIRECTION, "target": {"type": "number"}, "target_basis": BASIS},
                        "required": ["direction", "target", "target_basis"], "additionalProperties": False},
        "notes": {"type": "object", "properties": {"drivers": {"type": "array", "items": {"type": "string"}}},
                  "required": ["drivers"], "additionalProperties": False},
    },
    "required": ["price", "supports", "resistances", "bias", "confidence", "outlook", "outlook_days", "alternative", "notes"],
    "additionalProperties": False,
}


# Los textos, en una segunda llamada con el análisis ya validado: así nunca contradicen lo que se publica (la
# validación recorta zonas, corrige direcciones o descarta invalidaciones) y cada llamada razona solo su parte
TEXT_SCHEMA = {"type": "object", "properties": {"es": TEXT, "en": TEXT}, "required": ["es", "en"], "additionalProperties": False}
# Redactar apenas necesita razonar (11 nov 2026, mismo análisis): GLM con "high" redacta bien en 30-90 s; con su esfuerzo
# por defecto agotó los 16.000 tokens las dos veces, así que el respaldo es "medium"; Gemini suele tener la cuota agotada
TEXT_MODELS = llm.models_from_env("ANALYSIS_TEXT_MODELS", "glm-5.3-flash@high,glm-5.3-flash@medium,gemini:gemini-3.5-flash,"
                                  "gemini:gemini-flash-latest")
TEXT_PROMPT = """Eres un redactor de análisis de mercado de Bitcoin. Recibes en JSON el análisis de un analista ya \
revisado (analysis: zonas de soporte y resistencia con su fuerza de 1 a 3 y sus datos, sesgo, confianza y escenarios con \
su objetivo, su invalidación y de qué nivel sale cada uno; notes: sus claves) y los datos de mercado que puedes citar \
(data, con background_trend: la tendencia de fondo de la revisión semanal, que se publica aparte). Redactas sus textos para la web, en español de España y en inglés, sin cambiar el \
análisis.

REGLAS

1. Los textos cuentan este análisis: las mismas zonas, direcciones, objetivos e invalidaciones, con sus precios. No \
añadas escenarios, niveles ni cifras que no estén en analysis, notes o data.
2. Cada precio que cites, salvo el actual, dice en pocas palabras qué nivel es y por qué importa, con los datos que lo \
respaldan: por ejemplo "los mínimos iguales de 4 h en X $, donde se acumulan stops de largos", "el 50 % de Fibonacci del \
tramo diario principal (X $), dentro de una zona con N reacciones" o "el hueco de 4 h entre X e Y $ que el precio no ha \
rellenado" (X, Y y N son los de los datos).
3. Interpreta bien los datos: un dato por encima de la previsión no es "mejor de lo previsto" si es malo para el \
mercado (una inflación más alta, por ejemplo); una pérdida no realizada alta de los holders de corto plazo es estrés, y \
solo es capitulación si venden de verdad con pérdidas (pérdida realizada disparada y SOPR claramente por debajo de 1). \
Su intensidad es la de short_term_holders.capitulation.level, sin exagerarla: con capitulation_levels, "en niveles de \
capitulación" o "con pérdidas propias de una capitulación" (nunca "plena capitulación" ni "capitulación masiva"); solo \
con intense_capitulation, "capitulación intensa"; con none, no hables de capitulación. El SOPR compara el precio al que \
venden con el que pagaron: 0,98 es que venden de media con un 2 % de pérdida; llámalo así ("venden de media con un 2 % \
de pérdida") o SOPR, nunca "ventas a mercado" ni "índice de ventas", que son otra cosa (las compras y ventas a mercado \
de los derivados).
4. Atribuye cada dato a su fuente y no mezcles datos de distinta naturaleza en una misma frase o clave: las \
probabilidades de las decisiones de la Fed son las del mercado de predicción Kalshi, no la opinión de un miembro de la \
Fed; las salidas de los ETF son flujos de inversores, no posiciones en derivados.
5. Escribe para lectores que no son especialistas: sin jerga ni abreviaturas ("%B de Bollinger", "m/m", "hawkish", \
"dovish", "pierna", "pozo de liquidez", "extremo en curso", "extremo sin confirmar", "SMA200", "HH", "LL"…). Explícalo \
con palabras normales: "en la parte baja de su rango habitual" en vez de "%B en 0,1", "el mínimo de ayer" en vez de \
"extremo en curso", \
"la media de 200 semanas" en vez de "SMA200 semanal". Soporte, resistencia, Fibonacci, liquidez o hueco sin rellenar sí \
valen, con su explicación cuando hace falta.
6. El precio actual es analysis.price: cita ese.
7. Habla de probabilidades y escenarios, nunca de certezas, y no des recomendaciones de compra o venta.
8. Fechas, no días de la semana: "el mínimo del 15 de noviembre", no "el mínimo del sábado" (los datos llevan fechas sin \
el día de la semana y es fácil equivocarse). Solo hoy puede nombrarse por su día (context.weekday).

Responde solo con un objeto JSON, sin texto antes ni después, con esta forma:
{
  "es": {"headline": texto, "summary": texto, "outlook": texto, "outlook_days": texto, "points": [texto, ...]},
  "en": {"headline": texto, "summary": texto, "outlook": texto, "outlook_days": texto, "points": [texto, ...]}
}

- headline: una frase de 12 palabras como máximo.
- summary: la situación de BTC hoy en 3 o 4 frases (100 palabras como máximo).
- La tendencia de fondo se publica aparte (background_trend): no la repitas; el summary puede mencionarla en pocas \
palabras si ayuda a entender la situación, sin contradecirla.
- outlook: lo más probable en las próximas horas (analysis.outlook), hacia dónde y qué lo invalidaría, en 2 o 3 frases \
(70 palabras como máximo).
- outlook_days: lo mismo para 1-2 días (analysis.outlook_days). Si su dirección es la contraria a la de lo más probable \
en 2-4 semanas (data.background_trend.outlook_2_4_weeks), dilo en una frase para que el lector no lo tome por una \
contradicción: por ejemplo, "antes del rebote hacia X $ que prevé la tendencia de fondo para las próximas semanas", con \
su objetivo.
- points: de 2 a 4 claves (35 palabras como máximo cada una) de lo que está moviendo el precio. No repitas las métricas \
de las claves de la tendencia de fondo (data.background_trend.points: se publican en la misma página) salvo que hayan \
cambiado desde entonces, y entonces di el cambio ("Kalshi ha pasado del 89 al 92 %"): si ya citan los flujos de los ETF \
o las pérdidas de los holders de corto plazo y no han cambiado, no los repitas, ni siquiera de pasada en otra clave. \
Prioriza lo de horas y días: \
velas de 1 h y 4 h, derivados, la agenda y las noticias del día, la liquidez y los huecos cercanos.
- "es" en español y "en" en inglés, con el mismo contenido: traduce con cuidado las cifras y su sentido (una subida de \
tipos mayor no es un recorte).
- Precios en dólares redondeados (78.500 $ en español, $78,500 en inglés). Nombra los datos con palabras normales, no con \
sus nombres en el JSON."""


# ---------- Datos ----------

def get(url: str):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as res:
        return json.loads(res.read())


# Velas que ve el modelo por temporalidad (las semanales, para la tendencia de fondo) y las que se descargan para los
# indicadores (medias de 200) y, en diario, para el contexto de los últimos 12 meses
# Velas que ve el modelo (los niveles los calcula el script con CANDLES_FOR_INDICATORS). Reducirlas a 26/60/60/48 y
# resumir las series de derivados (11 nov 2026, mismos datos) no bajó el razonamiento (~19.000 tokens igual) y cambió el
# escenario de las próximas horas en 2 de 3 pruebas: el corto plazo sí las usa
CANDLES = {"1w": 52, "1d": 180, "4h": 120, "1h": 72}
CANDLES_FOR_INDICATORS = {"1d": 400}
# Zonas de reacción diarias, con más historia (desde 2024): con el precio en mínimos de más de un año, en 400 velas no
# había ninguna por debajo (21 nov 2026: sin soportes, los tres modelos dieron 0 y no se publicó el análisis)
REACTION_CANDLES = {"1d": 1000}
DEFAULT_FOR_INDICATORS = 250


def klines(interval: str, limit: int) -> list[list]:
    """[hora UTC, apertura, máximo, mínimo, cierre, volumen en BTC], redondeado para gastar menos tokens."""
    return _rows(get(f"{SPOT}/klines?symbol=BTCUSDT&interval={interval}&limit={limit}"), interval)


def _rows(raw: list[list], interval: str) -> list[list]:
    fmt = "%Y-%m-%d" if interval in ("1d", "1w") else "%Y-%m-%d %H:%M"
    return [[datetime.fromtimestamp(r[0] / 1000, timezone.utc).strftime(fmt), *(round(float(x)) for x in r[1:6])] for r in raw]


# Techo de ciclo, con el mismo criterio que la web (web/src/lib/drawdown.ts): un máximo histórico seguido de una caída de
# más del 50 % que tardó más de medio año en tocar fondo (las correcciones bruscas, como la de mayo de 2021, no cuentan)
CYCLE_DRAWDOWN = -0.5
CYCLE_MIN_DAYS = 180


def cycle_context(history: dict) -> dict:
    """Máximo histórico, techos y suelos de los ciclos anteriores y el punto del actual, con los cierres diarios del
    histórico de la web: los mismos que muestra su tabla de techos y suelos. Contexto de largo plazo, no predicción."""
    dates = [datetime.fromisoformat(d).date() for d in history["dates"]]
    price = history["price"]
    episodes, cur = [], None  # de un máximo histórico al siguiente
    ath = 0.0
    for d, p in zip(dates, price):
        if p >= ath:
            ath = p
            if cur:
                episodes.append({**cur, "recovered": d})
            cur = {"top": d, "top_price": p, "low": d, "low_price": p}
        elif p < cur["low_price"]:
            cur.update(low=d, low_price=p)
    episodes.append({**cur, "recovered": None})
    is_cycle = lambda e: e["low_price"] / e["top_price"] - 1 <= CYCLE_DRAWDOWN and (e["low"] - e["top"]).days > CYCLE_MIN_DAYS
    today, last = dates[-1], price[-1]
    row = lambda e: {"top_date": e["top"].isoformat(), "top_close": round(e["top_price"]), "bottom_date": e["low"].isoformat(),
                     "bottom_close": round(e["low_price"]), "drawdown_pct": round((e["low_price"] / e["top_price"] - 1) * 100, 1),
                     "days_top_to_bottom": (e["low"] - e["top"]).days}
    current = episodes[-1]
    return {
        "all_time_high": {"date": current["top"].isoformat(), "close": round(current["top_price"]),
                          "days_since": (today - current["top"]).days, "pct_from_ath": round((last / current["top_price"] - 1) * 100, 1)},
        "previous_cycles": [row(e) for e in episodes[:-1] if is_cycle(e)],
        # Ciclo en curso: su suelo es el mínimo hasta hoy (puede no ser el definitivo)
        "current_cycle": {**row(current), "bottom_is_low_so_far": True, "days_since_bottom": (today - current["low"]).days},
        "as_of": today.isoformat(),
    }


BITVIEW = "https://bitview.space/api/series/{series}/day1?start=-{days}"  # Bitcoin Research Kit público, sin clave
STH_LOSS_MEAN = 90
STH_LOSS_PCT_DAYS = 1460  # los ratios, frente a los últimos 4 años (como el score)


def _bitview(series: str, days: int) -> tuple[date, list[float]]:
    """Valores diarios de una serie de bitview hasta el último día completo (el de hoy está en curso) y su fecha."""
    d = get(BITVIEW.format(series=series, days=days + 1))
    values = [float(x or 0) for x in d["data"]][:-1]
    return date(2009, 1, 1) + timedelta(days=d["start"] + len(values) - 1), values


def _vs_mean(values: list[float]) -> dict:
    """El último valor (en miles de millones de dólares) frente a su media de STH_LOSS_MEAN días: el ratio, en qué % de
    los últimos STH_LOSS_PCT_DAYS días fue menor (above_pct_of_days) y el ratio de los últimos 14."""
    ratios = []
    for i in range(STH_LOSS_MEAN - 1, len(values)):
        mean = sum(values[i - STH_LOSS_MEAN + 1:i + 1]) / STH_LOSS_MEAN
        ratios.append(values[i] / mean if mean else None)
    valid = [r for r in ratios[-STH_LOSS_PCT_DAYS:] if r is not None]
    now = ratios[-1]
    return {
        "usd_bn": round(values[-1] / 1e9, 2),
        "mean_90d_usd_bn": round(sum(values[-STH_LOSS_MEAN:]) / STH_LOSS_MEAN / 1e9, 2),
        "ratio_to_90d_mean": None if now is None else round(now, 2),
        "ratio_above_pct_of_days_4y": None if now is None else round(sum(r < now for r in valid) / len(valid) * 100),
        "ratio_last_14d": [None if r is None else round(r, 2) for r in ratios[-14:]],
    }


# Capitulación de los holders de corto plazo, clasificada aquí para que el texto no la exagere (14 nov 2026: "plena
# capitulación" con el ratio alto pero un SOPR de 0,985 y la cuarta parte de pérdida en dólares que en febrero)
CAPITULATION_RATIO = 5  # pérdida realizada, veces su media de 90 días
CAPITULATION_INTENSE_SOPR = 0.97  # SOPR de 24 h igual o por debajo: venden con un 3 % de pérdida o más
CAPITULATION_INTENSE_USD_PCT = 99  # o pérdida en dólares en el 1 % más alto de los últimos 4 años
# Calibrado con las de 2018-2026: así salen intensas marzo de 2020, mayo de 2021, junio de 2022, agosto de 2024 y
# febrero de 2026; con el percentil 90 lo eran casi todos los días con niveles de capitulación (66 de 74)


def capitulation(realized: list[float], ratio: float | None, sopr: float | None) -> dict:
    """none; capitulation_levels (pérdida realizada ≥ CAPITULATION_RATIO veces su media con SOPR por debajo de 1);
    intense_capitulation (además, SOPR ≤ CAPITULATION_INTENSE_SOPR o pérdida en dólares en el 1 % más alto de 4 años)."""
    valid = [v for v in realized[-STH_LOSS_PCT_DAYS:] if v]
    usd_pct = round(sum(v < realized[-1] for v in valid) / len(valid) * 100) if valid else None
    levels = ratio is not None and ratio >= CAPITULATION_RATIO and sopr is not None and sopr < 1
    intense = levels and (sopr <= CAPITULATION_INTENSE_SOPR or (usd_pct is not None and usd_pct >= CAPITULATION_INTENSE_USD_PCT))
    return {"level": "intense_capitulation" if intense else "capitulation_levels" if levels else "none",
            "realized_loss_usd_above_pct_of_days_4y": usd_pct, "sopr_24h": sopr}


def sth_context() -> dict:
    """Holders de corto plazo (monedas movidas hace menos de 155 días): la pérdida no realizada (lo que pierden las que
    aún tienen) y la realizada (lo que perdieron las que vendieron ese día), cada una frente a su media de 90 días, y el
    SOPR diario (precio de venta / precio de compra de lo que se movió: por debajo de 1, venden con pérdidas)."""
    days = STH_LOSS_PCT_DAYS + STH_LOSS_MEAN
    last, unrealized = _bitview("sth_unrealized_loss", days)
    out = {"date": last.isoformat(), "unrealized_loss": _vs_mean(unrealized)}
    try:
        _, realized = _bitview("sth_realized_loss_sum_24h", days)
        out["realized_loss_24h"] = _vs_mean(realized)
        _, sopr = _bitview("sth_sopr_24h", 14)
        out["sopr_24h_last_14d"] = [round(x, 4) if x else None for x in sopr[-14:]]
        out["capitulation"] = capitulation(realized, out["realized_loss_24h"]["ratio_to_90d_mean"], round(sopr[-1], 4) if sopr[-1] else None)
    except Exception as e:  # la pérdida no realizada sirve sola
        log.warning("bitview: sin pérdida realizada o SOPR: %s", e)
    return out


LTH_SPIKE = 5  # pico de pérdida realizada de largo plazo: 5 veces su media de 90 días


def lth_context() -> dict:
    """Holders de largo plazo (monedas movidas hace más de 155 días): la pérdida realizada de cada día frente a su media de
    90 días y el último pico (≥ LTH_SPIKE veces esa media) del último año. En los mercados alcistas es casi cero (quien
    lleva meses suele estar en beneficios), así que su primer pico tras un periodo así es enorme frente a su media.
    Backtest de noviembre de 2026: esos primeros picos tras un techo (abril de 2018, junio de 2021, octubre de 2025)
    abrieron fases bajistas, con el año siguiente peor que la media; solo algunos coincidieron con suelos (marzo de 2020,
    noviembre de 2022)."""
    last, loss = _bitview("lth_realized_loss_sum_24h", STH_LOSS_PCT_DAYS + STH_LOSS_MEAN)
    out = {"date": last.isoformat(), "realized_loss_24h": _vs_mean(loss)}
    spike = None
    for i in range(len(loss) - 365, len(loss)):
        mean = sum(loss[i - STH_LOSS_MEAN + 1:i + 1]) / STH_LOSS_MEAN
        if mean and loss[i] >= LTH_SPIKE * mean:
            spike = (i, loss[i] / mean)
    out["last_spike_365d"] = None if spike is None else {
        "date": (last - timedelta(days=len(loss) - 1 - spike[0])).isoformat(), "days_ago": len(loss) - 1 - spike[0],
        "ratio_to_90d_mean": round(spike[1], 1), "usd_bn": round(loss[spike[0]] / 1e9, 2)}
    return out


def trend_context(raw_1d: list[list]) -> dict:
    """Máximo y mínimo de los últimos 12 meses, con su fecha y su distancia al precio."""
    year = raw_1d[-365:]
    i_hi = max(range(len(year)), key=lambda i: float(year[i][2]))
    i_lo = min(range(len(year)), key=lambda i: float(year[i][3]))
    hi, lo, price = float(year[i_hi][2]), float(year[i_lo][3]), float(year[-1][4])
    return {"high_12m": {"price": round(hi), "date": _day(year[i_hi]), "pct_from_price": round((price / hi - 1) * 100, 1)},
            "low_12m": {"price": round(lo), "date": _day(year[i_lo]), "pct_from_price": round((price / lo - 1) * 100, 1)}}


def _day(row: list) -> str:
    return datetime.fromtimestamp(row[0] / 1000, timezone.utc).strftime("%Y-%m-%d")


def _hlc(raw: list[list]) -> tuple[list[float], list[float], list[float]]:
    return [float(r[2]) for r in raw], [float(r[3]) for r in raw], [float(r[4]) for r in raw]


def _rsi(close: list[float]) -> list[float | None]:
    deltas = [b - a for a, b in zip(close, close[1:])]
    gain = _rma([max(d, 0) for d in deltas], 14)
    loss = _rma([max(-d, 0) for d in deltas], 14)
    return [None] + [100 - 100 / (1 + g / l) if l else 100.0 for g, l in zip(gain, loss)]


def _atr(high: list[float], low: list[float], close: list[float]) -> float:
    tr = [high[0] - low[0]] + [max(h - l, abs(h - c), abs(l - c)) for h, l, c in zip(high[1:], low[1:], close)]
    return _rma(tr, 14)[-1]


def _zigzag(high: list[float], low: list[float], close: list[float], threshold: float) -> tuple[list[tuple[int, str, float]], tuple[int, str, float] | None]:
    """Pivotes alternos (máximo, mínimo…) separados al menos por `threshold`: un extremo se confirma cuando el precio
    se aleja de él esa distancia. Devuelve los confirmados y el extremo en curso (aún sin confirmar).

    Velas amplias que marcan un extremo nuevo y además recorren el umbral hacia el otro lado (el 4 de noviembre de 2026:
    perforó el mínimo y subió 5.460 $ en la misma vela): sin mirarlas, el giro se perdía, porque solo se veía el extremo
    nuevo. El cierre dice el orden: si cierra en la mitad contraria al extremo nuevo, ese extremo fue primero y la vela
    lo confirma como pivote y queda como extremo en curso del otro lado."""
    pivots: list[tuple[int, str, float]] = []
    trend, ext, hi_i, lo_i = None, 0, 0, 0
    for i in range(1, len(high)):
        if trend is None:
            hi_i = i if high[i] > high[hi_i] else hi_i
            lo_i = i if low[i] < low[lo_i] else lo_i
            if high[hi_i] - low[lo_i] >= threshold:
                if hi_i > lo_i:
                    pivots.append((lo_i, "low", low[lo_i]))
                    trend, ext = "up", hi_i
                else:
                    pivots.append((hi_i, "high", high[hi_i]))
                    trend, ext = "down", lo_i
        elif trend == "up":
            if high[i] >= high[ext]:
                ext = i
                if high[i] - low[i] >= threshold and close[i] <= (high[i] + low[i]) / 2:
                    pivots.append((i, "high", high[i]))
                    trend = "down"
            elif high[ext] - low[i] >= threshold:
                pivots.append((ext, "high", high[ext]))
                trend, ext = "down", i
        else:
            if low[i] <= low[ext]:
                ext = i
                if high[i] - low[i] >= threshold and close[i] >= (high[i] + low[i]) / 2:
                    pivots.append((i, "low", low[i]))
                    trend = "up"
            elif high[i] - low[ext] >= threshold:
                pivots.append((ext, "low", low[ext]))
                trend, ext = "up", i
    current = None if trend is None else (ext, "high", high[ext]) if trend == "up" else (ext, "low", low[ext])
    return pivots, current


# Tamaño mínimo de un tramo para contar en la estructura, en ATR de la temporalidad: filtra el ruido
STRUCTURE_ATR = {"1w": 1.5, "1d": 2.0}
# Fibonacci en escala logarítmica (BTC se mueve en porcentajes: en tramos grandes la lineal reparte mal los niveles):
# retrocesos dentro del tramo y extensiones más allá de su final, en el mismo sentido
FIB_RETRACEMENTS = (0.382, 0.5, 0.618, 0.786)
# Solo en diario: el análisis mira horas y 1-2 días, y con fib_legs el tramo diario ya llega al origen del semanal cuando
# el precio pierde su mínimo (en semanal, el modelo se anclaba en objetivos demasiado lejanos y la corrección era la misma)
FIB_TIMEFRAMES = ("1d",)
FIB_EXTENSIONS = (1.272, 1.618)


def _fib(raw: list[list], i0: int, p0: float, i1: int, p1: float, price: float) -> dict:
    """Niveles de Fibonacci de un tramo de p0 a p1 (escala logarítmica): retrocesos hacia p0 y extensiones más allá de p1,
    y qué parte del tramo ha devuelto ya el precio."""
    return {"from": {"date": _day(raw[i0]), "price": round(p0)}, "to": {"date": _day(raw[i1]), "price": round(p1)},
            "direction": "up" if p1 > p0 else "down", "retraced_pct": round(math.log(p1 / price) / math.log(p1 / p0) * 100, 1),
            "retracements": {str(f): round(p1 * (p0 / p1) ** f) for f in FIB_RETRACEMENTS},
            "extensions": {str(f): round(p0 * (p1 / p0) ** f) for f in FIB_EXTENSIONS}}


def fib_legs(raw: list[list], high: list[float], low: list[float], close: list[float], pivots: list) -> dict | None:
    """Los dos tramos de Fibonacci que trazaría un analista:
      main        el movimiento principal: desde el último mínimo de la estructura que ningún cierre ha perdido hasta el
                  máximo posterior (o, en bajada, desde el último máximo que ningún cierre ha superado hasta el mínimo
                  posterior); de los dos, el más grande
      correction  la corrección desde el final de main hasta el extremo posterior, provisional mientras ese extremo no se
                  confirme como pivote (el precio aún puede alargarla): entonces lleva solo los retrocesos, sin extensiones
    Así el tramo nace en el mínimo que protege la subida y llega a su punto más alto, sin cortarse en un pivote intermedio."""
    price, n = close[-1], len(close)

    def candidate(kind: str):
        for i, k, level in reversed(pivots):
            held = all(c >= level for c in close[i + 1:]) if kind == "low" else all(c <= level for c in close[i + 1:])
            if k == kind and held:
                j = max(range(i, n), key=lambda x: high[x]) if kind == "low" else min(range(i, n), key=lambda x: low[x])
                end = high[j] if kind == "low" else low[j]
                return (abs(math.log(end / level)), i, level, j, end) if j > i else None
        return None

    legs = [c for c in (candidate("low"), candidate("high")) if c]
    if not legs:
        return None
    _, i0, p0, i1, p1 = max(legs)
    out = {"scale": "log", "main": _fib(raw, i0, p0, i1, p1, price), "correction": None}
    if i1 < n - 1:
        up = p1 > p0
        k = min(range(i1 + 1, n), key=lambda x: low[x]) if up else max(range(i1 + 1, n), key=lambda x: high[x])
        ext = low[k] if up else high[k]
        if ext != p1:
            provisional = not any(i == k for i, _, _ in pivots)
            out["correction"] = {**_fib(raw, i1, p1, k, ext, price), "provisional": provisional}
            # Sin extremo confirmado (sin un rebote de al menos el umbral de la estructura) la extensión se movería con el
            # precio: no es un objetivo. Los retrocesos sí sirven, como niveles de rebote
            if provisional:
                del out["correction"]["extensions"]
    return out


def structure(raw: list[list], tf: str) -> dict:
    """Estructura de mercado de una temporalidad, calculada (no interpretada): los últimos pivotes con el RSI en cada uno
    y si son máximos o mínimos más altos o más bajos que el anterior, la última ruptura de un pivote por un cierre, las
    divergencias del RSI entre los dos últimos máximos y los dos últimos mínimos, y los niveles de Fibonacci del tramo
    principal y de su corrección (fib_legs). Sirve igual para tendencias alcistas y bajistas."""
    high, low, close = _hlc(raw)
    rsi = _rsi(close)
    pivots, current = _zigzag(high, low, close, STRUCTURE_ATR[tf] * _atr(high, low, close))
    labelled, last = [], {}
    for i, kind, price in pivots:
        prev = last.get(kind)
        label = None if prev is None else ("HH" if price > prev else "LH") if kind == "high" else ("HL" if price > prev else "LL")
        last[kind] = price
        labelled.append({"date": _day(raw[i]), "type": kind, "price": round(price), "rsi14": None if rsi[i] is None else round(rsi[i], 1),
                         "label": label, "_i": i})

    # Última ruptura: el cierre más reciente que superó un máximo o perdió un mínimo de la estructura
    brk = None
    for p in labelled:
        for j in range(p["_i"] + 1, len(close)):
            if (close[j] > p["price"]) if p["type"] == "high" else (close[j] < p["price"]):
                if brk is None or j > brk[0]:
                    brk = (j, p)
                break
    last_break = None if brk is None else {"direction": "up" if brk[1]["type"] == "high" else "down", "broken_pivot_date": brk[1]["date"],
                                           "level": brk[1]["price"], "close_date": _day(raw[brk[0]]), "close": round(close[brk[0]])}

    # Divergencias entre los dos últimos pivotes del mismo tipo, y entre el último y el extremo en curso
    def divergence(a: dict, b: dict, forming: bool) -> dict | None:
        if a["rsi14"] is None or b["rsi14"] is None:
            return None
        hi = a["type"] == "high"
        price_up, rsi_up = b["price"] > a["price"], b["rsi14"] > a["rsi14"]
        if price_up == rsi_up:
            return None
        regular = price_up if hi else not price_up  # máximo más alto con RSI más bajo, o mínimo más bajo con RSI más alto
        return {"type": ("regular" if regular else "hidden") + ("_bearish" if hi == regular else "_bullish"), "forming": forming,
                "from": {"date": a["date"], "price": a["price"], "rsi14": a["rsi14"]},
                "to": {"date": b["date"], "price": b["price"], "rsi14": b["rsi14"]}}

    divergences = []
    cur = None if current is None else {"date": _day(raw[current[0]]), "type": current[1], "price": round(current[2]),
                                         "rsi14": None if rsi[current[0]] is None else round(rsi[current[0]], 1)}
    for kind in ("high", "low"):
        same = [p for p in labelled if p["type"] == kind]
        if len(same) >= 2 and (d := divergence(same[-2], same[-1], False)):
            divergences.append(d)
        if cur and cur["type"] == kind and same and (d := divergence(same[-1], cur, True)):
            divergences.append(d)

    fib = fib_legs(raw, high, low, close, pivots) if tf in FIB_TIMEFRAMES else None
    for p in labelled:
        del p["_i"]
    out = {"pivots": labelled[-8:], "current_extreme": cur, "last_break": last_break, "rsi_divergences": divergences}
    return {**out, "fibonacci": fib} if tf in FIB_TIMEFRAMES else out


# Liquidez pendiente: tamaño mínimo de un tramo para que su extremo cuente (en ATR), tolerancia para dar por iguales dos
# máximos o dos mínimos (en ATR), distancia máxima al precio y cuántos niveles de cada lado
LIQUIDITY_ATR = {"1d": 2.0, "4h": 2.0}
EQUAL_ATR = 0.3
# En 4 h hasta un 12 %: con un 8 % quedaban fuera máximos intermedios del diario que el zigzag diario filtra como ruido
# (el del 29 de octubre de 2026, a un +10 %)
LIQUIDITY_RANGE = {"1d": 0.20, "4h": 0.12}
# Los más cercanos de cada lado; en 4 h uno más, porque el rango es mayor
LIQUIDITY_MAX = {"1d": 3, "4h": 4}


def liquidity_pools(raw: list[list], tf: str) -> list[dict]:
    """Liquidez pendiente: máximos y mínimos de la estructura que el precio no ha vuelto a superar. Por encima de un
    máximo quedan los stops de los cortos y las compras por ruptura; por debajo de un mínimo, los stops de los largos.
    Los que están casi al mismo precio (máximos o mínimos iguales) se agrupan: concentran más órdenes. Los más cercanos
    al precio, por encima y por debajo. Se calcula con las velas, sin suponer nada del apalancamiento."""
    high, low, close = _hlc(raw)
    atr, price = _atr(high, low, close), close[-1]
    pivots, _ = _zigzag(high, low, close, LIQUIDITY_ATR[tf] * atr)
    pools: list[dict] = []
    for i, kind, level in pivots:
        later = range(i + 1, len(raw))
        if any(high[j] > level for j in later) if kind == "high" else any(low[j] < level for j in later):
            continue  # ya barrido
        same = next((p for p in pools if p["kind"] == kind and abs(p["price"] - level) <= EQUAL_ATR * atr), None)
        if same:
            same["price"] = max(same["price"], level) if kind == "high" else min(same["price"], level)
            same["dates"].append(_day(raw[i]))
        else:
            pools.append({"kind": kind, "price": level, "dates": [_day(raw[i])]})
    out = []
    for p in pools:
        if abs(p["price"] / price - 1) > LIQUIDITY_RANGE[tf]:
            continue
        out.append({"side": "above" if p["kind"] == "high" else "below", "price": round(p["price"]), "dates": p["dates"],
                    "equal_levels": len(p["dates"]) > 1, "pct_from_price": round((p["price"] / price - 1) * 100, 2)})
    near = lambda side: sorted((p for p in out if p["side"] == side), key=lambda p: abs(p["pct_from_price"]))[: LIQUIDITY_MAX[tf]]
    return near("above") + near("below")


# Zonas de reacción: pivotes de tramos de al menos REACTION_ATR (más sensible que la estructura, para no perder giros
# intermedios), agrupados mientras la zona no pase de REACTION_WIDTH_ATR de ancho, y los más cercanos de cada lado
REACTION_ATR = {"1d": 1.5, "4h": 2.0}
REACTION_WIDTH_ATR = 1.0
REACTION_RANGE = {"1d": 0.25, "4h": 0.10}
REACTION_MAX = 5


def _crossings(close: list[float], lo: float, hi: float) -> list[int]:
    """Velas en las que el cierre atraviesa la zona de lado a lado: queda al otro lado del último cierre que estuvo fuera
    de ella (los cierres dentro de la zona no cuentan como lado)."""
    out, side = [], 0
    for i, c in enumerate(close):
        s = 1 if c > hi else -1 if c < lo else 0
        if s:
            if side and s != side:
                out.append(i)
            side = s
    return out


def reaction_zones(raw: list[list], tf: str) -> list[dict]:
    """Zonas donde el precio ha girado de verdad: todos los pivotes (máximos y mínimos de tramos relevantes, se hayan
    vuelto a tocar o no) agrupados por cercanía, con cuántas veces ha reaccionado ahí el precio, desde qué lado y cuándo
    fue la última, y cuántas veces la han atravesado los cierres sin girar (en total y desde la última reacción). Son la base de los soportes y resistencias; un mismo nivel puede haber sido soporte y luego
    resistencia (o al revés)."""
    high, low, close = _hlc(raw)
    atr, price = _atr(high, low, close), close[-1]
    pivots, _ = _zigzag(high, low, close, REACTION_ATR[tf] * atr)
    zones: list[dict] = []
    for i, kind, level in sorted(pivots, key=lambda p: p[2]):
        z = zones[-1] if zones and level - zones[-1]["low"] <= REACTION_WIDTH_ATR * atr else None
        if z:
            z["high"] = level
            z["touches"].append((i, kind))
        else:
            zones.append({"low": level, "high": level, "touches": [(i, kind)]})
    out = []
    for z in zones:
        mid = (z["low"] + z["high"]) / 2
        if abs(mid / price - 1) > REACTION_RANGE[tf]:
            continue
        last = max(i for i, _ in z["touches"])
        crossed = _crossings(close, z["low"], z["high"])
        out.append({"low": round(z["low"]), "high": round(z["high"]), "side": "above" if z["low"] > price else "below" if z["high"] < price else "at_price",
                    "reactions": len(z["touches"]), "as_high": sum(k == "high" for _, k in z["touches"]),
                    "as_low": sum(k == "low" for _, k in z["touches"]), "last": _day(raw[last]),
                    "crossings": len(crossed), "crossings_since_last": sum(i > last for i in crossed),
                    "pct_from_price": round((mid / price - 1) * 100, 2)})
    near = lambda side: sorted((z for z in out if z["side"] == side), key=lambda z: abs(z["pct_from_price"]))[:REACTION_MAX]
    return near("above") + near("at_price") + near("below")


# Imbalances: tamaño mínimo (en ATR), distancia máxima al precio y cuántos de cada lado
IMBALANCE_ATR = 0.5
IMBALANCE_RANGE = {"1w": 0.30, "1d": 0.15, "4h": 0.06}
IMBALANCE_MAX = 3


def imbalances(raw: list[list], tf: str) -> list[dict]:
    """Imbalances (fair value gaps) sin rellenar: huecos entre el máximo de una vela y el mínimo de la que va dos después
    (o al revés) que el precio no ha vuelto a cubrir. Si se ha cubierto en parte, queda solo lo que falta. Los más
    cercanos al precio, por encima y por debajo."""
    high, low, close = _hlc(raw)
    price, min_size = close[-1], IMBALANCE_ATR * _atr(high, low, close)
    gaps: list[dict] = []
    # La vela que cierra el hueco (i + 1) tiene que estar cerrada: con la última, en curso, el hueco cambiaba o
    # desaparecía según avanzaba (16 nov 2026: un hueco semanal con el máximo de una semana de unas horas). La vela en
    # curso sí cuenta para rellenarlos
    for i in range(1, len(raw) - 2):
        later = range(i + 2, len(raw))
        if high[i - 1] < low[i + 1]:  # alcista: el precio subió dejando un hueco por debajo
            bottom, top = high[i - 1], low[i + 1]
            top = min([top, *(low[j] for j in later)])
            kind = "bullish"
        elif low[i - 1] > high[i + 1]:  # bajista: hueco por encima
            bottom, top = high[i + 1], low[i - 1]
            bottom = max([bottom, *(high[j] for j in later)])
            kind = "bearish"
        else:
            continue
        if top <= bottom:
            continue  # ya rellenado
        # Huecos en velas seguidas del mismo impulso: uno solo
        prev = gaps[-1] if gaps else None
        if prev and prev["type"] == kind and prev["_i"] == i - 1:
            prev.update(low=min(prev["low"], bottom), high=max(prev["high"], top), _i=i)
        else:
            gaps.append({"type": kind, "date": _day(raw[i]), "low": bottom, "high": top, "_i": i})
    for g in gaps:
        g.update(low=round(g["low"]), high=round(g["high"]), side="above" if g["low"] > price else "below" if g["high"] < price else "at_price")
    gaps = [g for g in gaps if g["high"] - g["low"] >= min_size and abs((g["low"] + g["high"]) / 2 / price - 1) <= IMBALANCE_RANGE[tf]]
    for g in gaps:
        del g["_i"]
    near = lambda side: sorted((g for g in gaps if g["side"] == side), key=lambda g: abs((g["low"] + g["high"]) / 2 - price))[:IMBALANCE_MAX]
    return near("above") + near("at_price") + near("below")


# Zonas candidatas: el script hace lo mecánico (afinar con 4 h, partir en el precio, ver qué niveles caen dentro) y el
# modelo solo elige cuáles importan y su fuerza. Una de 4 h afina una diaria si cae dentro de ella en al menos
# CANDIDATE_INSIDE de su ancho; las de 4 h, con al menos CANDIDATE_MIN_4H reacciones (con una sola no hay zona)
CANDIDATE_INSIDE = 0.7
CANDIDATE_MIN_4H = 2
# Una de 4 h sustituye a la diaria en la que cae solo si es sólida: con al menos REFINE_MIN_REACTIONS reacciones o como
# mucho REFINE_MAX_CROSSINGS cruces desde la última (una débil afinaría mal). Elegirlo el modelo le hacía razonar en bucle
REFINE_MIN_REACTIONS = 3
REFINE_MAX_CROSSINGS = 1
CANDIDATES_PER_SIDE = 4  # las más cercanas al precio: menos opciones, menos razonamiento
ZONE_MIN_ATR = 0.15  # lo mínimo (en ATR diario) que puede quedar de una zona partida en el precio
CONFLUENCE_ATR = 0.1  # margen (en ATR diario) para que un nivel puntual cuente como dentro de una zona


def _zone_stats(z: dict) -> dict:
    return {k: z[k] for k in ("reactions", "as_high", "as_low", "last", "crossings", "crossings_since_last")}


def _inside(q: dict, d: dict) -> bool:
    width = q["high"] - q["low"]
    if not width:
        return d["low"] <= q["low"] <= d["high"]
    return max(0, min(q["high"], d["high"]) - max(q["low"], d["low"])) >= CANDIDATE_INSIDE * width


def _confluences(lo: float, hi: float, data: dict, tol: float) -> list[str]:
    """Los niveles de los datos que caen dentro de la zona: Fibonacci, pivotes, liquidez e imbalances."""
    near = lambda p: lo - tol <= p <= hi + tol
    out = [f"fibonacci {f['leg']} {float(f['ratio']) * 100:g} %: {f['price']}" for f in fib_levels(data) if near(f["price"])]
    for tf, ms in data.get("market_structure", {}).items():
        out += [f"pivot {tf} ({p['type']}, {p['date']}): {p['price']}" for p in ms.get("pivots", []) if near(p["price"])]
        if (cur := ms.get("current_extreme")) and near(cur["price"]):
            out.append(f"current_extreme {tf} (sin confirmar): {cur['price']}")
    for tf, pools in data.get("liquidity_pools", {}).items():
        out += [f"liquidity_pool {tf}{' (iguales)' if p['equal_levels'] else ''}: {p['price']}" for p in pools if near(p["price"])]
    for tf, gaps in data.get("imbalances", {}).items():
        out += [f"imbalance {tf} {g['type']}: {g['low']}-{g['high']}" for g in gaps if g["low"] <= hi and g["high"] >= lo]
    return out


def zone_candidates(data: dict, price: float, atr_1d: float) -> list[dict]:
    """Las zonas entre las que elige el modelo, de la más alta a la más baja, con id Z1, Z2…:
      - cada zona de reacción diaria o, si caen dentro de ella zonas de 4 h sólidas, esas en su lugar (afinadas, con los
        datos de las dos y daily_range, la diaria entera)
      - las de 4 h que no caen dentro de ninguna diaria
      - las que contienen el precio, partidas en él (si lo que queda de un lado es muy estrecho, ese lado no cuenta)
    con su lado respecto al precio y los niveles que caen dentro (confluences); como mucho CANDIDATES_PER_SIDE de cada
    lado, las más cercanas."""
    zones = data.get("reaction_zones", {})
    daily, h4 = zones.get("1d", []), [q for q in zones.get("4h", []) if q["reactions"] >= CANDIDATE_MIN_4H]
    solid = lambda q: q["reactions"] >= REFINE_MIN_REACTIONS or q["crossings_since_last"] <= REFINE_MAX_CROSSINGS
    raw, used = [], set()
    for d in daily:
        inner = [q for q in h4 if _inside(q, d)]
        used.update(id(q) for q in inner)  # dentro de una diaria: no van solas aunque sean débiles
        if refined := [q for q in inner if solid(q)]:
            raw += [{"low": q["low"], "high": q["high"], "timeframe": "1d+4h", "daily_range": [d["low"], d["high"]],
                     "1d": _zone_stats(d), "4h": _zone_stats(q)} for q in refined]
        else:
            raw.append({"low": d["low"], "high": d["high"], "timeframe": "1d", "1d": _zone_stats(d)})
    raw += [{"low": q["low"], "high": q["high"], "timeframe": "4h", "4h": _zone_stats(q)} for q in h4 if id(q) not in used]

    out = []
    for c in raw:
        if c["low"] < price < c["high"]:
            parts = [(c["low"], round(price)), (round(price), c["high"])]
            out += [{**c, "low": lo, "high": hi, "split_at_price": True} for lo, hi in parts if hi - lo >= ZONE_MIN_ATR * atr_1d]
        else:
            out.append(c)
    tol = CONFLUENCE_ATR * atr_1d
    side = lambda c: (c["low"] + c["high"]) / 2 > price
    near = lambda up: sorted((c for c in out if side(c) == up), key=lambda c: abs((c["low"] + c["high"]) / 2 - price))
    out = sorted(near(True)[:CANDIDATES_PER_SIDE] + near(False)[:CANDIDATES_PER_SIDE], key=lambda c: -c["high"])
    for i, c in enumerate(out):
        mid = (c["low"] + c["high"]) / 2
        c.update({"id": f"Z{i + 1}", "side": "above" if mid > price else "below",
                  "pct_from_price": round((mid / price - 1) * 100, 2),
                  "confluences": _confluences(c["low"], c["high"], data, tol)})
    # El id, los bordes y el lado primero: es lo que el modelo usa para elegir
    first = ("id", "low", "high", "side", "pct_from_price", "timeframe")
    return [{**{k: c[k] for k in first}, **{k: v for k, v in c.items() if k not in first}} for c in out]


# Lo que se calcula para la validación pero no se envía al modelo: las zonas de reacción ya van en zone_candidates
# macro_liquidity y stock_panic_vix, solo para el análisis semanal (trend_view): anticipan a meses, no a horas ni días
MODEL_HIDDEN = ("reaction_zones", "macro_liquidity", "stock_panic_vix")


def model_view(data: dict) -> dict:
    return {k: v for k, v in data.items() if k not in MODEL_HIDDEN}


def _rma(values: list[float], period: int) -> list[float]:
    """Media de Wilder (la del RSI y el ATR), como ewm(alpha=1/period) del pipeline."""
    out, acc = [], values[0]
    for v in values:
        acc += (v - acc) / period
        out.append(acc)
    return out


def indicators(raw: list[list]) -> dict:
    """Indicadores de una temporalidad, calculados con sus velas (la última, en curso). Son cálculos, no conclusiones:
    al modelo le cuesta hacer esta aritmética de cabeza con cientos de velas y la estimaba a ojo."""
    high = [float(r[2]) for r in raw]
    low = [float(r[3]) for r in raw]
    close = [float(r[4]) for r in raw]
    price = close[-1]
    deltas = [b - a for a, b in zip(close, close[1:])]
    gain = _rma([max(d, 0) for d in deltas], 14)
    loss = _rma([max(-d, 0) for d in deltas], 14)
    rsi = [None] + [100 - 100 / (1 + g / l) if l else 100.0 for g, l in zip(gain, loss)]
    tr = [high[0] - low[0]] + [max(h - l, abs(h - c), abs(l - c)) for h, l, c in zip(high[1:], low[1:], close)]
    atr = _rma(tr, 14)[-1]
    last20 = close[-20:]
    mean20 = sum(last20) / 20
    sd20 = (sum((x - mean20) ** 2 for x in last20) / 20) ** 0.5
    sma = lambda n: sum(close[-n:]) / n if len(close) >= n else None
    pct = lambda ref: None if ref is None else round((price / ref - 1) * 100, 2)
    # RSI en el máximo y en el mínimo de las últimas 50 velas: con el actual, deja ver las divergencias
    i_hi = max(range(len(raw) - 50, len(raw)), key=lambda i: high[i])
    i_lo = min(range(len(raw) - 50, len(raw)), key=lambda i: low[i])
    return {
        "rsi14": round(rsi[-1], 1),
        "rsi14_at_high_50": round(rsi[i_hi], 1) if rsi[i_hi] is not None else None,
        "rsi14_at_low_50": round(rsi[i_lo], 1) if rsi[i_lo] is not None else None,
        "bollinger_pct_b": round((price - (mean20 - 2 * sd20)) / (4 * sd20), 2) if sd20 else None,
        "pct_vs_sma50": pct(sma(50)),
        "pct_vs_sma200": pct(sma(200)),
        "high_20": round(max(high[-20:])), "low_20": round(min(low[-20:])),
        "high_50": round(high[i_hi]), "low_50": round(low[i_lo]),
        "atr14": round(atr), "atr14_pct": round(atr / price * 100, 2),
    }


def headlines() -> list[dict]:
    """Titulares de impacto medio y alto de las últimas NEWS_MAX_HOURS horas, del news.json del cron de noticias."""
    try:
        items = json.loads((OUT_DIR / "news.json").read_text(encoding="utf-8"))["items"]
    except (FileNotFoundError, KeyError, json.JSONDecodeError) as e:
        log.warning("news.json no disponible: %s", e)
        return []
    now = datetime.now(timezone.utc)
    out = []
    for n in items:
        published = datetime.fromisoformat(n["published"])
        if n["impact"] >= NEWS_MIN_IMPACT and (now - published).total_seconds() <= NEWS_MAX_HOURS * 3600:
            out.append({"published_utc": published.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M"), "source": n["source"],
                        "impact": n["impact"], "title": n["title"]})
    return out


def calendar() -> list[dict]:
    """Eventos de la agenda económica de la semana, del calendar.json de build_calendar.py (los ya publicados con su dato)."""
    try:
        events = json.loads((OUT_DIR / "calendar.json").read_text(encoding="utf-8"))["events"]
    except (FileNotFoundError, KeyError, json.JSONDecodeError) as e:
        log.warning("calendar.json no disponible: %s", e)
        return []
    out = []
    for e in events:
        ev = {"time_utc": datetime.fromisoformat(e["date"]).astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M"),
              "country": e["country"], "event": e["title"]}
        ev.update({k: e[k] for k in ("forecast", "previous", "actual") if e.get(k)})
        out.append(ev)
    return out


KALSHI = "https://api.elections.kalshi.com/trade-api/v2"  # datos de mercado públicos, sin clave
FED_SERIES = "KXFEDDECISION"  # un evento por reunión del FOMC, con un mercado por resultado
FED_MEETINGS = 2  # la próxima reunión y la siguiente


def _kalshi_price(obj: dict, field: str) -> float | None:
    """Precio (probabilidad 0-1) de un campo de Kalshi, en dólares ("x_dollars": "0.4200") o en céntimos ("x": 42)."""
    for key, scale in ((f"{field}_dollars", 1), (field, 100)):
        v = obj.get(key)
        if v not in (None, ""):
            return float(v) / scale
    return None


def _kalshi_prob(obj: dict, prefix: str = "") -> float | None:
    """Mitad de la horquilla compra/venta si la hay (más fiable que el último cruce en mercados poco activos); si no, el
    último precio."""
    bid, ask = _kalshi_price(obj, f"{prefix}yes_bid"), _kalshi_price(obj, f"{prefix}yes_ask")
    if bid and ask and ask >= bid:
        return (bid + ask) / 2
    return _kalshi_price(obj, f"{prefix}price" if prefix else "last_price")


def _kalshi_7d(ticker: str) -> float | None:
    """Probabilidad de hace 7 días: cierre de la vela diaria de ese día."""
    now = int(datetime.now(timezone.utc).timestamp())
    data = get(f"{KALSHI}/series/{FED_SERIES}/markets/{ticker}/candlesticks?period_interval=1440"
               f"&start_ts={now - 9 * 86400}&end_ts={now - 7 * 86400}")
    candles = data.get("candlesticks") or []
    if not candles:
        return None
    c = candles[-1]
    bid, ask = _kalshi_price(c.get("yes_bid") or {}, "close"), _kalshi_price(c.get("yes_ask") or {}, "close")
    if bid and ask and ask >= bid:
        return (bid + ask) / 2
    return _kalshi_price(c.get("price") or {}, "close")


def fed_odds() -> list[dict]:
    """Probabilidades de cada resultado de las próximas reuniones del FOMC según el mercado de predicción Kalshi: ahora,
    hace 24 h y hace 7 días (normalizadas a 100 %). Los cambios muestran cómo reinterpreta el mercado los datos macro."""
    events = get(f"{KALSHI}/events?series_ticker={FED_SERIES}&status=open&with_nested_markets=true&limit=10")["events"]
    meetings = []
    for e in events:
        markets = e.get("markets") or []
        when = min((m.get("close_time") or "" for m in markets), default="")
        if markets and when:
            meetings.append((when, e, markets))
    out = []
    for when, e, markets in sorted(meetings, key=lambda x: x[0])[:FED_MEETINGS]:
        rows = []
        for m in markets:
            name = m.get("yes_sub_title") or " ".join(f"{k} {v}" for k, v in (m.get("custom_strike") or {}).items()) \
                or m["ticker"]
            try:
                week = _kalshi_7d(m["ticker"])
            except Exception as ex:  # sin la vela de hace 7 días se envía el resto
                log.warning("Kalshi: sin histórico de %s: %s", m["ticker"], ex)
                week = None
            rows.append((name, _kalshi_prob(m), _kalshi_price(m, "previous_price"), week))

        def norm(i: int) -> list[float | None]:
            vals = [r[i] for r in rows]
            total = sum(v for v in vals if v)
            return [round(v / total * 100) if v is not None and total else None for v in vals]

        now, day, week = norm(1), norm(2), norm(3)
        outcomes = [{"outcome": r[0], "prob_now_pct": n, "prob_24h_ago_pct": d, "prob_7d_ago_pct": w}
                    for r, n, d, w in zip(rows, now, day, week) if max(x or 0 for x in (n, d, w)) >= 1]
        out.append({"decision_date_utc": when[:10], "title": e.get("title"), "outcomes": outcomes})
    return out


def now_context() -> dict:
    """Día y hora, y si la bolsa de EE. UU. está abierta: fuera de su horario (sobre todo en fin de semana) hay menos
    liquidez, sin flujos de los ETF. Es un dato, no una conclusión: el modelo decide si le da importancia."""
    now = datetime.now(timezone.utc)
    ny = now.astimezone(ZoneInfo("America/New_York"))
    is_open = ny.weekday() < 5 and (9, 30) <= (ny.hour, ny.minute) < (16, 0)
    return {"now_utc": now.strftime("%Y-%m-%d %H:%M"), "weekday": now.strftime("%A"), "us_stock_market_open": is_open}


def market() -> dict:
    """Datos en bruto e indicadores calculados con ellos, sin niveles ni conclusiones: el análisis lo hace el modelo."""
    data: dict = {"context": now_context()}
    for tf, n in CANDLES.items():
        raw = get(f"{SPOT}/klines?symbol=BTCUSDT&interval={tf}&limit={CANDLES_FOR_INDICATORS.get(tf, DEFAULT_FOR_INDICATORS)}")
        data[f"candles_{tf}"] = _rows(raw[-n:], tf)
        data[f"indicators_{tf}"] = indicators(raw)
        if tf == "1d":
            data["trend_context"] = trend_context(raw)
        if tf in STRUCTURE_ATR:
            data.setdefault("market_structure", {})[tf] = structure(raw, tf)
        if tf in IMBALANCE_RANGE:
            data.setdefault("imbalances", {})[tf] = imbalances(raw, tf)
        if tf in LIQUIDITY_RANGE:
            data.setdefault("liquidity_pools", {})[tf] = liquidity_pools(raw, tf)
        if tf in REACTION_RANGE:
            long_raw = get(f"{SPOT}/klines?symbol=BTCUSDT&interval={tf}&limit={REACTION_CANDLES[tf]}") if tf in REACTION_CANDLES else raw
            data.setdefault("reaction_zones", {})[tf] = reaction_zones(long_raw, tf)
    try:
        # Sin funding (11 nov 2026): casi siempre en el 0,01 % neutro de Binance y sin relación con el precio; también se
        # retiró del índice
        oi = get(f"{FUTURES}/futures/data/openInterestHist?symbol=BTCUSDT&period=4h&limit=42")
        data["open_interest_btc_4h"] = [round(float(x["sumOpenInterest"])) for x in oi]
        ls = get(f"{FUTURES}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=4h&limit=42")
        data["accounts_long_pct_4h"] = [round(float(x["longAccount"]) * 100, 1) for x in ls]
        tk = get(f"{FUTURES}/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=4h&limit=42")
        data["taker_buy_sell_ratio_4h"] = [round(float(x["buySellRatio"]), 3) for x in tk]
    except Exception as e:  # sin derivados el análisis sigue, con menos datos
        log.warning("derivados no disponibles: %s", e)
    try:
        data["short_term_holders"] = sth_context()
    except Exception as e:  # sin bitview el análisis sigue sin este dato
        log.warning("bitview no disponible: %s", e)
    try:
        data["long_term_holders"] = lth_context()
    except Exception as e:
        log.warning("bitview: sin pérdida realizada de largo plazo: %s", e)
    try:
        fg = get("https://api.alternative.me/fng/?limit=14")["data"]
        data["fear_greed_14d"] = [int(x["value"]) for x in reversed(fg)]
    except Exception as e:
        log.warning("Fear & Greed no disponible: %s", e)
    news = headlines()
    if news:
        data["news_headlines"] = news
    agenda = calendar()
    if agenda:
        data["economic_calendar_week"] = agenda
    try:
        data["fed_decision_odds"] = fed_odds()
    except Exception as e:  # sin Kalshi el análisis sigue sin este dato
        log.warning("Kalshi no disponible: %s", e)
    try:
        vix = (get(CAPITULATION_URL) or {}).get("vix")
        if vix:
            data["vix"] = {"date": vix["date"], "close": vix["close"], "change_5_sessions": vix.get("change_5d")}
            data["stock_panic_vix"] = stock_panic(vix)
    except Exception as e:  # sin el dato, los análisis siguen sin el VIX
        log.warning("capitulation.json no disponible: %s", e)
    try:
        data["macro_liquidity"] = macro_liquidity(get(LIQUIDITY_URL))
    except Exception as e:  # sin el dato, el análisis semanal sigue sin la liquidez macro
        log.warning("liquidity_scores.json no disponible: %s", e)
    try:
        data["cycle_context"] = cycle_context(get(HISTORY_URL))
    except Exception as e:  # sin el histórico, el análisis sigue sin el contexto de ciclo
        log.warning("history.json no disponible: %s", e)
    try:
        metrics = {m["id"]: m["value"] for c in get(LATEST_URL)["categories"].values() for m in c["metrics"]}
        if metrics.get("etf_flows") is not None:
            data["spot_etf_net_flows_20_sessions_btc"] = round(metrics["etf_flows"])
    except Exception as e:
        log.warning("latest.json no disponible: %s", e)
    data["zone_candidates"] = zone_candidates(data, float(data["candles_1h"][-1][4]), data["indicators_1d"]["atr14"])
    return data


# ---------- Modelos ----------

# ---------- Validación ----------

# Distancia máxima, en ATR diarios, entre un objetivo o invalidación y el nivel de los datos que el modelo dice usar
BASIS_ATR = 0.3


def basis_levels(data: dict) -> list[tuple[str, str, float, float]]:
    """Niveles de los datos como (kind, timeframe, desde, hasta): las zonas e imbalances son rangos; el resto, puntos."""
    out = []
    for tf, zones in data.get("reaction_zones", {}).items():
        out += [("reaction_zone", tf, z["low"], z["high"]) for z in zones]
    for c in data.get("zone_candidates", []):  # incluidas las partidas en el precio y las afinadas ("1d+4h": de las dos)
        out += [("reaction_zone", tf, c["low"], c["high"]) for tf in c["timeframe"].split("+")]
    for tf, pools in data.get("liquidity_pools", {}).items():
        out += [("liquidity_pool", tf, p["price"], p["price"]) for p in pools]
    for tf, gaps in data.get("imbalances", {}).items():
        out += [("imbalance", tf, g["low"], g["high"]) for g in gaps]
    for tf, ms in data.get("market_structure", {}).items():
        out += [("pivot", tf, p["price"], p["price"]) for p in ms.get("pivots", [])]
        # Aparte: vale como base de un objetivo o una invalidación ("pivot"), pero no para anclar una zona
        if cur := ms.get("current_extreme"):
            out.append(("current_extreme", tf, cur["price"], cur["price"]))
        for leg in fib_legs_of(ms):
            out += [("fibonacci", tf, v, v) for v in {**leg.get("retracements", {}), **leg.get("extensions", {})}.values()]
    return out


def fib_legs_of(ms: dict) -> list[dict]:
    """Los tramos de Fibonacci de una estructura, con leg: "main" o "correction"."""
    fib = ms.get("fibonacci") or {}
    return [{**fib[k], "leg": k} for k in ("main", "correction") if fib.get(k)]


def fib_levels(data: dict) -> list[dict]:
    """Los niveles de Fibonacci de los datos, con su temporalidad, su tramo, su ratio ("0.5", "1.272"...) y el día en
    que empieza el tramo (from: desde ahí se dibuja la línea)."""
    out = []
    for tf, ms in data.get("market_structure", {}).items():
        for leg in fib_legs_of(ms):
            out += [{"timeframe": tf, "leg": leg["leg"], "ratio": r, "price": round(v), "from": leg["from"]["date"]}
                    for r, v in {**leg.get("retracements", {}), **leg.get("extensions", {})}.items()]
    return out


def cited_fib(price: float, basis: dict, fibs: list[dict], tolerance: float) -> dict | None:
    """El nivel de Fibonacci del que sale un precio, si el modelo dice que sale de uno y lo hay cerca en esa temporalidad."""
    if basis.get("kind") != "fibonacci" or not basis.get("found"):
        return None
    near = [f for f in fibs if f["timeframe"] == basis.get("timeframe") and abs(f["price"] - price) <= tolerance]
    return min(near, key=lambda f: abs(f["price"] - price)) if near else None


def check_basis(price: float, basis: dict, levels: list, tolerance: float) -> dict:
    """La base que da el modelo, con found: si hay un nivel de ese tipo y temporalidad cerca del precio (si no lo hay,
    nearest: el nivel más cercano de cualquier tipo). Solo se registra: no descarta el análisis."""
    out = {"kind": basis.get("kind"), "timeframe": basis.get("timeframe")}
    if out["kind"] == "atr" or not levels:
        return out
    gap = lambda lv: max(lv[2] - price, price - lv[3], 0)
    kinds = ("pivot", "current_extreme") if out["kind"] == "pivot" else (out["kind"],)
    out["found"] = any(gap(lv) <= tolerance for lv in levels if lv[0] in kinds and lv[1] == out["timeframe"])
    if not out["found"]:
        k, tf, lo, hi = min(levels, key=gap)
        out["nearest"] = {"kind": k, "timeframe": tf, "level": round(lo) if lo == hi else [round(lo), round(hi)],
                          "distance": round(gap((k, tf, lo, hi)))}
    return out

def validate(a: dict, price: float, data: dict | None = None) -> dict:
    """Ordena y filtra las zonas, corrige lo que se puede y lanza ValueError si el análisis no se sostiene (sin los
    textos: van en la segunda llamada, con check_texts). Con `data`
    (los datos que recibió el modelo), comprueba también de qué nivel salen objetivos e invalidaciones."""
    levels = basis_levels(data) if data else []
    fibs = fib_levels(data) if data else []
    cited: list[dict] = []  # niveles de Fibonacci de los que salen objetivos o invalidaciones, para dibujarlos
    atr_1d = (data or {}).get("indicators_1d", {}).get("atr14") or price * 0.03
    said = float(a.get("price") or 0)
    if not said or abs(said / price - 1) > 0.03:
        raise ValueError(f"el modelo da un precio de {said} y en Binance está a {price:.0f}")

    candidates = {c["id"]: c for c in (data or {}).get("zone_candidates", [])}

    def zones(raw: list[dict], kind: str) -> list[dict]:
        out = []
        for z in raw:
            if "low" in z:  # --dry-run: zonas sin candidatas
                lo, hi, source = *sorted((float(z["low"]), float(z["high"]))), None
            elif (c := candidates.get(str(z.get("id")))):
                lo, hi, source = c["low"], c["high"], c["id"]
                if c["side"] != ("below" if kind == "support" else "above"):
                    log.warning("Zona del lado equivocado, se descarta: %s (%s) como %s", c["id"], c["side"], kind)
                    continue
            else:
                log.warning("Zona desconocida: %s", z.get("id"))
                continue
            # El precio puede haberse movido desde los datos: lo que quede al otro lado no es soporte o resistencia, y si
            # lo que queda es muy estrecho, el precio está en la zona y no es ninguna de las dos
            if kind == "support" and hi > price or kind == "resistance" and lo < price:
                clipped = (lo, price) if kind == "support" else (price, hi)
                log.info("Zona recortada al precio (%s %.0f-%.0f → %.0f-%.0f)", kind, lo, hi, *clipped)
                lo, hi = clipped
                if hi - lo < ZONE_MIN_ATR * atr_1d:
                    continue
            mid = (lo + hi) / 2
            near = abs(mid / price - 1) <= 0.25
            if near and hi - lo < price * 0.06:
                out.append({"kind": kind, "low": round(lo), "high": round(hi), "mid": round(mid),
                            "strength": max(1, min(3, int(z.get("strength", 2))))} | ({"candidate": source} if source else {}))
        # Una afinada y su diaria se solapan: si el modelo elige las dos, cuenta la primera que dio
        kept: list[dict] = []
        for z in out:
            if any(z["low"] < k["high"] and k["low"] < z["high"] for k in kept):
                log.warning("Zona solapada con otra elegida, se descarta: %s %s-%s", z.get("candidate"), z["low"], z["high"])
            else:
                kept.append(z)
        out = sorted(kept, key=lambda z: abs(z["mid"] - price))
        for i, z in enumerate(out[:MAX_LEVELS]):
            z["id"] = f"{'S' if kind == 'support' else 'R'}{i + 1}"
        return out[:MAX_LEVELS]

    sup, res = zones(a["supports"], "support"), zones(a["resistances"], "resistance")
    # Un lado puede quedar sin zonas solo si no hay ninguna candidata en él (el precio en mínimos o máximos de años)
    sides = {c["side"] for c in candidates.values()} if candidates else {"below", "above"}
    if (not sup and "below" in sides) or (not res and "above" in sides) or (not sup and not res):
        raise ValueError(f"faltan zonas: {len(sup)} soportes, {len(res)} resistencias")
    if not sup or not res:
        log.warning("Sin candidatas %s del precio: el análisis va sin %s", "por debajo" if not sup else "por encima",
                    "soportes" if not sup else "resistencias")

    def move(m: dict, limit: float) -> dict:
        target = float(m["target"])
        if abs(target / price - 1) > limit:
            raise ValueError(f"objetivo fuera de rango: {target}")
        # La dirección la marca el objetivo: un "alcista" con objetivo por debajo no se sostiene
        d = "lateral" if abs(target / price - 1) < 0.004 else "alcista" if target > price else "bajista"
        out = {"direction": m.get("direction") if m.get("direction") == d or d == "lateral" else d, "target": round(target)}
        if m.get("target_basis"):
            out["target_basis"] = check_basis(target, m["target_basis"], levels, BASIS_ATR * atr_1d)
            cited.append(cited_fib(target, out["target_basis"], fibs, BASIS_ATR * atr_1d))
        if out["direction"] not in ("alcista", "bajista", "lateral"):
            out["direction"] = d
        if "invalidation" in m:
            inv = float(m["invalidation"] or 0)
            other_side = (inv - price) * (target - price) < 0
            out["invalidation"] = round(inv) if inv and other_side and abs(inv / price - 1) <= limit else None
            if out["invalidation"] and m.get("invalidation_basis"):
                out["invalidation_basis"] = check_basis(inv, m["invalidation_basis"], levels, BASIS_ATR * atr_1d)
                cited.append(cited_fib(inv, out["invalidation_basis"], fibs, BASIS_ATR * atr_1d))
        return out

    short, days, alt = move(a["outlook"], MAX_SHORT), move(a["outlook_days"], MAX_DAYS), move(a["alternative"], MAX_SHORT)
    short["horizon_hours"] = max(1, min(24, int(a["outlook"].get("horizon_hours") or 12)))
    for name, m in (("horas", short), ("1-2 días", days), ("alternativo", alt)):
        for field in ("target", "invalidation"):
            b = m.get(f"{field}_basis")
            if b and b.get("found") is False:
                log.warning("Base no encontrada (%s, %s %s): dice %s de %s; lo más cercano: %s", name, field, m[field],
                            b["kind"], b["timeframe"], b["nearest"])
    if short["direction"] == alt["direction"]:
        raise ValueError(f"el escenario alternativo va en la misma dirección que el principal ({short['direction']})")

    result = {
        "bias": a.get("bias") if a.get("bias") in ("alcista", "bajista", "neutral") else "neutral",
        "confidence": max(1, min(3, int(a.get("confidence") or 1))),
        "levels": sup + res,
        "outlook": short,
        "outlook_days": days,
        "alternative": alt,
        # Se dibujan como líneas, no como zonas: son niveles calculados, no sitios donde el precio haya reaccionado
        # Una línea por precio: la corrección semanal y la diaria pueden ser el mismo tramo
        "fibonacci": list({f["price"]: f for f in cited if f}.values()),
    }
    notes = a.get("notes") or {}
    result["notes"] = {"drivers": [str(x).strip() for x in notes.get("drivers", []) if str(x).strip()]}
    return result


# Para saber en qué idioma está un texto: palabras muy frecuentes de cada uno (11 nov 2026: un modelo cruzó los campos y
# publicó el inglés en "es" y el español en "en")
LANG_WORDS = {"es": {"el", "la", "los", "las", "de", "del", "que", "y", "en", "con", "por", "para", "una", "se", "su"},
              "en": {"the", "of", "and", "to", "in", "with", "for", "a", "is", "at", "its", "on", "from", "by", "as"}}


def _lang(text: str) -> str | None:
    words = re.findall(r"[a-záéíóúñü]+", text.lower())
    score = {lang: sum(w in common for w in words) for lang, common in LANG_WORDS.items()}
    return max(score, key=score.get) if max(score.values()) >= 3 and score["es"] != score["en"] else None


def _fix_languages(a: dict) -> None:
    """Si un texto de "es" está en inglés y el mismo de "en" en español, los intercambia; si un idioma está mal sin su
    pareja al revés, lanza ValueError (se prueba el siguiente modelo)."""
    keys = [k for k in a["es"] if k in a["en"]]
    for k in keys:
        es, en = a["es"][k], a["en"][k]
        text = lambda v: " ".join(v) if isinstance(v, list) else str(v)
        got_es, got_en = _lang(text(es)), _lang(text(en))
        if got_es == "en" and got_en == "es":
            a["es"][k], a["en"][k] = en, es
            log.warning("Textos con los idiomas cruzados, se intercambian: %s", k)
        elif got_es == "en" or got_en == "es":
            raise ValueError(f"texto en el idioma equivocado: {k}")


# Palabras como máximo de cada texto (las del prompt): pasarse solo se avisa en el log
TEXT_WORDS = {"headline": 12, "summary": 100, "outlook": 70, "outlook_days": 70, "points": 35}
TEXT_KEYS = ("headline", "summary", "outlook", "outlook_days")
POINT_MAX_WORDS = 50


def check_texts(a: dict) -> dict:
    """Los textos de la segunda llamada, sin campos vacíos y cada uno en su idioma; como mucho 4 claves. Avisa de los que
    se pasan de palabras."""
    _fix_languages(a)
    out = {}
    for lang in ("es", "en"):
        t = a[lang]
        if not all(str(t.get(k, "")).strip() for k in TEXT_KEYS):
            raise ValueError(f"texto vacío ({lang})")
        out[lang] = {k: t[k].strip() for k in TEXT_KEYS}
        out[lang]["points"] = [x.strip() for x in t.get("points", []) if x.strip()][:4]
        long = [f"{k} {len(v.split())}/{TEXT_WORDS[k]}" for k, v in out[lang].items() if k != "points" and len(v.split()) > TEXT_WORDS[k]]
        long += [f"points {len(p.split())}/{TEXT_WORDS['points']}" for p in out[lang]["points"] if len(p.split()) > TEXT_WORDS["points"]]
        if long:
            log.warning("Texto demasiado largo (%s): %s", lang, ", ".join(long))
        # Una clave de casi el doble es otro texto, no una clave: se pide a otro redactor
        if any(len(p.split()) > POINT_MAX_WORDS for p in out[lang]["points"]):
            raise ValueError(f"claves de más de {POINT_MAX_WORDS} palabras ({lang})")
    return out


def text_input(result: dict, data: dict, price: float) -> str:
    """Lo que recibe la redacción: el análisis validado (cada zona con los datos de su candidata) y los datos citables,
    sin las velas ni las candidatas (lo que se necesita de ellas ya va en las zonas elegidas)."""
    candidates = {c["id"]: c for c in data.get("zone_candidates", [])}
    analysis = {"price": round(price), **{k: v for k, v in result.items() if k != "notes"}}
    analysis["levels"] = [{**z, "zone": {k: v for k, v in candidates.get(z.get("candidate"), {}).items() if k not in ("id", "side")}}
                          for z in result["levels"]]
    facts = {k: v for k, v in model_view(data).items() if not k.startswith("candles_") and k != "zone_candidates"}
    return json.dumps({"analysis": analysis, "notes": result.get("notes", {}), "data": facts}, separators=(",", ":"), ensure_ascii=False)


def dry_run(price: float) -> dict:
    """Sin modelo: zonas a distancias fijas del precio, para probar la salida y la web."""
    z = lambda f, s: {"low": price * f - 300, "high": price * f + 300, "strength": s}  # sin candidatas: con bordes
    text = {"headline": "Análisis de prueba (sin modelo)", "summary": "Generado con --dry-run.", "outlook": "Sin modelo.",
            "outlook_days": "Sin modelo.", "points": ["Sin modelo"]}
    return {"price": price, "supports": [z(0.985, 3), z(0.96, 2)], "resistances": [z(1.015, 2), z(1.04, 3)],
            "bias": "neutral", "confidence": 1,
            "outlook": {"direction": "bajista", "target": price * 0.985, "invalidation": price * 1.015, "horizon_hours": 12},
            "outlook_days": {"direction": "alcista", "target": price * 1.04, "invalidation": price * 0.96},
            "alternative": {"direction": "alcista", "target": price * 1.015}, "es": text, "en": text}


# Análisis en sombra (desde el 11 nov 2026): tras publicar, el mismo análisis con otra configuración, que solo se guarda en
# SHADOW_LOG (sin textos ni publicación) para que eval_analysis compare su acierto con el publicado. Ahora, GLM con
# esfuerzo "high": razona unas 6 veces menos, y falta saber si acierta lo mismo. Vacío (ANALYSIS_SHADOW_MODELS=), no se hace
SHADOW_MODELS = llm.models_from_env("ANALYSIS_SHADOW_MODELS", "glm-5.3-flash@high")
SHADOW_LOG = "analysis_shadow_log.jsonl"
LOG_FIELDS = ("generated_at", "model", "price", "levels", "bias", "confidence", "outlook", "outlook_days", "alternative")


def model_name(spec: str) -> str:
    """El modelo con su esfuerzo, si lo lleva ("glm-5.3-flash@high"): eval_analysis los compara por separado."""
    return llm.label(spec) + (f"@{spec.partition('@')[2]}" if "@" in spec else "")


def shadow(data: dict, user: str, published: dict) -> None:
    """El análisis en sombra con los mismos datos que el publicado. Si falla, solo se avisa: no afecta a lo publicado."""
    if not SHADOW_MODELS or published["model"] in map(model_name, SHADOW_MODELS):
        return  # sin sombra, o lo publicado ya salió con esa configuración (el principal falló)
    prices: list[float] = []

    def check(raw: dict) -> dict:
        prices.append(float(get(PRICE_URL)["price"]))
        return validate(raw, prices[-1], data)

    try:
        result, spec = llm.complete(PROMPT, user, SCHEMA, "analisis-sombra", SHADOW_MODELS, check, max_tokens=32000)
    except RuntimeError as e:
        log.warning("Análisis en sombra no disponible: %s", e)
        return
    row = {**result, "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "model": model_name(spec),
           "price": round(prices[-1])}
    with open(STATE_DIR / SHADOW_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps({**{k: row[k] for k in LOG_FIELDS}, "published_at": published["generated_at"],
                            "notes": result.get("notes")}) + "\n")
    log.info("Sombra (%s): %s; horas: %s hacia %s; 1-2 días: %s hacia %s", row["model"], result["bias"],
             result["outlook"]["direction"], result["outlook"]["target"], result["outlook_days"]["direction"],
             result["outlook_days"]["target"])


# ---------- Tendencia de fondo semanal ----------

# Desde el 16 nov 2026 la tendencia de fondo (semanas y meses) se analiza aparte, una vez por semana: el lunes a las
# 08:00 de Madrid, con la vela semanal ya cerrada (a las 00:00 UTC) y unas horas de la nueva. Reescrita en cada análisis
# diario, la conclusión no cambiaba (seis análisis seguidos «bajista de fondo») pero los detalles sí (el suelo del ciclo
# en 58.525 o en 57.800 $, del −41 al −45 % desde el máximo). Se adelanta si un cierre diario supera uno de sus niveles de
# revisión (lo comprueba el script en cada análisis diario) o si no hay ninguna. El análisis diario la recibe como
# contexto (background_trend) y no la reescribe
TREND_FILE = "trend.json"
TREND_LOG = "trend_log.jsonl"
# Lo que ve el modelo: la escala de semanas y meses (sin velas de 4 h y 1 h ni derivados de corto plazo)
TREND_KEYS = ("context", "candles_1w", "candles_1d", "indicators_1w", "indicators_1d", "market_structure", "trend_context",
              "cycle_context", "imbalances", "liquidity_pools", "macro_liquidity", "stock_panic_vix", "long_term_holders",
              "short_term_holders",
              "spot_etf_net_flows_20_sessions_btc", "fear_greed_14d", "fed_decision_odds")
# Distancia de los niveles de revisión al precio, en ATR diarios: ni a un paso (saltaría cada pocos días) ni tan lejos
# que no sirvan
REVIEW_MIN_ATR = 1.0
REVIEW_MAX = 0.35

TREND_PROMPT = """Eres un analista de mercado de Bitcoin. Recibes en JSON datos de mercado en bruto de BTC/USDT y haces \
tu propio análisis de la tendencia de fondo de BTC: semanas y meses, no horas ni días. Se publica una vez por semana \
(el lunes por la mañana, con la vela semanal anterior ya cerrada y la nueva recién empezada) y la usan como contexto \
los análisis diarios, así que tiene que aguantar toda la semana salvo que el precio rompa un nivel clave. Respondes \
solo con un objeto JSON; otro modelo redactará después el texto.

REGLAS

1. Dirección (direction): alcista, bajista o lateral, por la estructura semanal y diaria (máximos y mínimos, rupturas \
confirmadas por cierres, divergencias), la posición frente a sus medias largas y el contexto del ciclo. Lo que pasa en \
pocos días no la cambia por sí solo.
2. Niveles de revisión (review_above y review_below): el precio de un cierre diario por encima o por debajo del cual tu \
lectura dejaría de valer o habría que revisarla, uno a cada lado del precio actual, con su base (basis: {"kind": ..., \
"timeframe": ...}) como en estos datos: "pivot" (de market_structure, en 1w o 1d), "liquidity_pool" (1d), \
"imbalance" (1w o 1d) o "fibonacci" (1d). Usa el precio exacto del nivel. Deben \
estar a una distancia razonable: al menos un ATR diario del precio y no más de un 35 %.
3. Escenarios de las próximas 2-4 semanas: outlook, el más probable, y alternative, el alternativo, en otra dirección. \
Cada uno con su dirección y su objetivo, que sale de un nivel de los datos (target_basis, con las mismas bases que los \
niveles de revisión y su precio exacto) y queda entre los dos niveles de revisión: un escenario que los supera ya no es \
de esta tendencia, sino de su revisión. El más probable puede ir contra la tendencia (un rebote dentro de una bajista, \
por ejemplo) si los datos lo apoyan. Ajusta los objetivos a la volatilidad semanal (ATR de 1w): en 2-4 semanas el \
precio suele moverse del orden de 1-3 ATR semanales.
4. notes, en español: trend, la tendencia de fondo y en qué punto está el precio dentro de ella, en 3 o 4 frases con \
sus precios y fechas exactos de los datos; drivers, de 2 a 4 claves de por qué la lees así, una frase cada una con sus \
cifras. Lenguaje llano, sin abreviaturas ni nombres de campos del JSON (HH, LL, current_extreme…): el redactor tiende \
a copiar tus palabras. Cita los extremos con la fecha y el tipo de dato tal como vienen (un mínimo de mecha no es un \
cierre).

Solo un objeto JSON, sin texto antes ni después:
{
  "price": precio actual de BTC en dólares (número),
  "direction": "alcista" | "bajista" | "lateral",
  "confidence": 1 a 3,
  "review_above": {"price": número, "basis": base},
  "review_below": {"price": número, "basis": base},
  "outlook": {"direction": "alcista" | "bajista" | "lateral", "target": número, "target_basis": base},
  "alternative": {"direction": "alcista" | "bajista" | "lateral", "target": número, "target_basis": base},
  "notes": {"trend": texto, "drivers": [texto, ...]}
}

CÓMO LEER LOS DATOS

- Velas semanales (un año) y diarias (6 meses) ([hora UTC, apertura, máximo, mínimo, cierre, volumen en BTC], la última \
en curso) e indicadores de cada temporalidad: RSI 14, %B de Bollinger, distancia a las medias de 50 y 200 velas, \
máximos y mínimos de 20 y 50 velas y ATR 14.
- market_structure, semanal y diaria: los últimos pivotes (HH, LH, HL, LL, con su RSI), el extremo en curso (aún sin \
confirmar), la última ruptura de un pivote por un cierre, las divergencias del RSI y, en diario, Fibonacci en escala \
logarítmica (main y correction).
- trend_context (máximo y mínimo de 12 meses) y cycle_context (máximo histórico y ciclos anteriores): para encuadrar, \
no para predecir por analogía. pct_from_price es cuánto se aleja el precio del nivel (precio / nivel − 1): +12,8 \
frente al mínimo es que el precio está un 12,8 % por encima de él, no que el mínimo esté un 12,8 % por debajo (lo \
está un 11,4 %).
- imbalances y liquidity_pools: huecos sin rellenar y máximos y mínimos que el precio no ha vuelto a superar.
- long_term_holders y short_term_holders (datos on-chain diarios con un día de retraso): pérdidas realizadas y no \
realizadas frente a su media; capitulation.level ya clasifica la de corto plazo (none, capitulation_levels o \
intense_capitulation). Contexto, no una señal de giro por sí sola.
- macro_liquidity (datos de la Reserva Federal de St. Louis, hoy y hace 4 y 13 semanas): la variación en 13 semanas de \
la liquidez de la Fed, el BCE y el Banco de Japón en dólares (en %), el cambio en 13 semanas del rendimiento del bono a \
2 años de EE. UU. (en puntos: si sube, el mercado descuenta subidas de tipos) y de la diferencia entre el bono a 10 y a \
2 años (si sube, la curva se empina, lo habitual cuando se esperan recortes), y el NFCI de la Fed de Chicago (0 es la \
media; positivo, condiciones financieras más restrictivas). Es el viento de fondo para las próximas semanas y meses: \
más liquidez y tipos esperados a la baja favorecen a BTC. No es una señal de giro: va con retraso respecto al precio, \
y en los suelos suele seguir desfavorable (en 2022 los dos suelos llegaron con la Fed subiendo tipos), así que una \
liquidez restrictiva no basta para esperar más caídas inmediatas; pesa más su cambio de dirección.
- Flujos de los ETF en 20 sesiones, Fear & Greed de 14 días y probabilidades de la Fed según Kalshi: contexto.
- stock_panic_vix: el VIX (Cboe) al último cierre y su nivel (high, 35 o más; extreme, 40 o más). Si pasa del umbral: \
kind (spike: un pico desde la calma; sustained: un miedo que ya llevaba semanas alto), rate_hikes_priced (si el mercado \
descuenta subidas de la Fed: el bono a 2 años sube más de 0,25 puntos en 13 semanas) y similar_cases, lo que hizo BTC \
en los casos parecidos desde 2011 (a 90 y 180 días desde el primer cierre por encima del umbral, y lo que llegó a caer \
antes). Un pánico así ha marcado a menudo zona de suelo de medio plazo, no el día (marzo de 2020: BTC cayó un 44 % más \
antes de girar), sobre todo como pico y sin subidas descontadas; el pánico sostenido con la Fed subiendo tipos (marzo de \
2022) fue seguido de más caídas. Son pocos casos: pésalos como contexto, no como certeza.
- previous_review: la revisión anterior (su fecha y precio, dirección, confianza, escenarios y niveles de revisión). \
La tendencia tiene que aguantar la semana: mantén su dirección y su escenario más probable salvo que los datos hayan \
cambiado de forma clara desde entonces (un nivel roto por un cierre, un cambio de estructura, un dato on-chain o macro \
que gira…). Si cambias la dirección o el escenario más probable, la primera de tus drivers dice qué ha cambiado y por \
qué; si no hay revisión anterior, analiza sin ella."""

TREND_TEXT_PROMPT = """Eres un redactor de análisis de mercado de Bitcoin. Recibes en JSON el análisis de la tendencia \
de fondo de BTC (semanas y meses) de un analista ya revisado (direction, confidence, review_above y review_below: los \
cierres diarios que la harían revisar; outlook y alternative: lo más probable en 2-4 semanas y la alternativa; notes: \
sus claves) y los datos que puedes citar (data). Redactas sus textos para la web, en español de España y en inglés, sin \
cambiar el análisis.

REGLAS

1. Cuenta este análisis: la misma dirección, los mismos escenarios y los mismos niveles, con sus precios. No añadas \
niveles ni cifras que no estén en el análisis, notes o data. Cada texto cuenta algo distinto: no repitas en uno lo que \
ya dice otro.
2. Los niveles de revisión tienen un sentido distinto según la dirección: el que va en contra de la tendencia \
(review_above si es bajista, review_below si es alcista) la pondría en duda; el que va a su favor no la cambia: la \
confirmaría y abriría una nueva pata en su dirección. Si es lateral, cada uno marcaría la salida del rango hacia su \
lado. Lo que cuenta es un cierre diario, no un toque ni una mecha.
3. Precisión con los niveles: si el precio ha perforado un nivel durante la semana (su mínimo o su máximo lo ha \
superado), no digas que se apoya en él o que lo respeta; di que lo ha perforado sin cerrar al otro lado o que está en \
torno a él.
4. Un mismo extremo, con una sola cifra: no describas el mínimo (o el máximo) de un mes con dos precios distintos. Si \
citas una zona y un extremo del mismo periodo, di qué es cada uno ("la zona de X-Y $ donde el precio giró varias veces \
en julio, por encima del mínimo de Z $ del 1 de julio", con las cifras de los datos).
5. Atribuye cada dato a su fuente: la liquidez de los bancos centrales y los tipos (macro_liquidity) son datos de la \
Reserva Federal; las probabilidades de la Fed, del mercado de predicción Kalshi; los holders de corto y largo plazo, \
datos on-chain.
6. Para lectores que no son especialistas: sin jerga ni abreviaturas (HH, LL, SMA200, extremo en curso, extremo sin \
confirmar…): "el mínimo del 15 de noviembre", no "extremo sin confirmar". Soporte, resistencia, Fibonacci, hueco sin \
rellenar o pata sí valen.
7. Probabilidades, no certezas, y sin recomendaciones de compra o venta. Sin frases de cierre genéricas sobre la \
confianza o las probabilidades. Con capitulation_levels, "en niveles de capitulación" (nunca "plena" ni "masiva"); \
solo con intense_capitulation, "capitulación intensa".
8. Precios en dólares redondeados (78.500 $ en español, $78,500 en inglés). Porcentajes con espacio en español \
(47,8 %) y sin él en inglés (47.8%). Nunca "percentil": "mayor que en el 99 % de los días de los últimos cuatro \
años". Los ETF son "al contado" ("spot" en inglés). Las distancias de pct_from_price son las del precio al nivel: \
+12,8 frente a un mínimo es que el precio está un 12,8 % por encima de él.

Solo un objeto JSON, sin texto antes ni después:
{
  "es": {"summary": texto, "outlook": texto, "points": [texto, ...]},
  "en": {"summary": texto, "outlook": texto, "points": [texto, ...]}
}

- summary: la situación de BTC en semanas y meses y por qué la tendencia de fondo es la que es (estructura, ciclo, \
on-chain, liquidez y tipos…), en 3 o 4 frases (90 palabras como máximo). Solo las cifras que explican el porqué \
(como mucho tres o cuatro): el resto de datos va en las claves.
- outlook: lo más probable en las próximas 2-4 semanas (outlook, con su objetivo), en pocas palabras la alternativa, y \
qué supondría un cierre diario más allá de cada nivel de revisión, diciendo qué nivel es cada uno; en 2 o 3 frases (70 \
palabras como máximo).
- points: de 2 a 4 claves (35 palabras como máximo cada una) de por qué el analista lo lee así, a partir de sus notes, \
cada una con sus cifras. No repiten lo que ya dicen summary y outlook (ni los escenarios ni los niveles de revisión): \
aportan el porqué con otros datos. Son de semanas y meses: estructura semanal, ciclo, on-chain, liquidez y tipos, flujos \
de los ETF; lo de horas y días (velas de 4 h, derivados, la agenda de la semana) es del análisis diario. Si la dirección o el escenario más probable han cambiado respecto a la revisión anterior \
(previous_review en data), la primera clave dice qué ha cambiado y por qué."""

REVIEW = {"type": "object", "properties": {"price": {"type": "number"}, "basis": BASIS}, "required": ["price", "basis"],
          "additionalProperties": False}
SCENARIO = {"type": "object", "properties": {"direction": DIRECTION, "target": {"type": "number"}, "target_basis": BASIS},
            "required": ["direction", "target", "target_basis"], "additionalProperties": False}
TREND_SCHEMA = {
    "type": "object",
    "properties": {"price": {"type": "number"}, "direction": DIRECTION, "confidence": {"type": "integer"},
                   "review_above": REVIEW, "review_below": REVIEW, "outlook": SCENARIO, "alternative": SCENARIO,
                   "notes": {"type": "object", "properties": {"trend": {"type": "string"},
                                                              "drivers": {"type": "array", "items": {"type": "string"}}},
                             "required": ["trend", "drivers"], "additionalProperties": False}},
    "required": ["price", "direction", "confidence", "review_above", "review_below", "outlook", "alternative", "notes"],
    "additionalProperties": False,
}
TREND_TEXT = {"type": "object", "properties": {"summary": {"type": "string"}, "outlook": {"type": "string"},
                                              "points": {"type": "array", "items": {"type": "string"}}},
              "required": ["summary", "outlook", "points"], "additionalProperties": False}
TREND_TEXT_SCHEMA = {"type": "object", "properties": {"es": TREND_TEXT, "en": TREND_TEXT}, "required": ["es", "en"],
                     "additionalProperties": False}


def trend_view(data: dict, previous: dict | None = None) -> dict:
    """Los datos que ve el análisis semanal: solo los de semanas y meses, y la revisión anterior (para no cambiar de
    escenario sin motivo)."""
    view = {k: v for k, v in data.items() if k in TREND_KEYS}
    if previous:
        view["previous_review"] = {k: previous.get(k) for k in ("generated_at", "price", "direction", "confidence", "outlook",
                                                                "alternative")}
        view["previous_review"].update(review_above=previous["review_above"]["price"], review_below=previous["review_below"]["price"])
    view["imbalances"] = {tf: v for tf, v in data.get("imbalances", {}).items() if tf in ("1w", "1d")}
    view["liquidity_pools"] = {tf: v for tf, v in data.get("liquidity_pools", {}).items() if tf == "1d"}
    return view


def validate_trend(a: dict, price: float, data: dict) -> dict:
    """Niveles de revisión a cada lado del precio y a una distancia razonable; la base de cada uno solo se registra."""
    said = float(a.get("price") or 0)
    if not said or abs(said / price - 1) > 0.03:
        raise ValueError(f"el modelo da un precio de {said} y en Binance está a {price:.0f}")
    atr = data.get("indicators_1d", {}).get("atr14") or price * 0.03
    above, below = float(a["review_above"]["price"]), float(a["review_below"]["price"])
    if not below < price < above:
        raise ValueError(f"niveles de revisión del lado equivocado: {below} / {price:.0f} / {above}")
    for lv in (above, below):
        if abs(lv - price) < REVIEW_MIN_ATR * atr or abs(lv / price - 1) > REVIEW_MAX:
            raise ValueError(f"nivel de revisión a una distancia poco razonable: {lv} (precio {price:.0f}, ATR {atr:.0f})")
    if a.get("direction") not in ("alcista", "bajista", "lateral") or a.get("confidence") not in (1, 2, 3):
        raise ValueError("dirección o confianza no válidas")
    levels, tol = basis_levels(data), BASIS_ATR * atr
    review = lambda r: {"price": round(float(r["price"])), "basis": check_basis(float(r["price"]), r["basis"], levels, tol)}
    notes = a.get("notes") or {}
    if not str(notes.get("trend", "")).strip():
        raise ValueError("sin texto de tendencia")

    def scenario(sc: dict, name: str) -> dict:
        """Objetivo del lado de su dirección (lateral: cerca del precio) y entre los niveles de revisión."""
        d, target = sc.get("direction"), float(sc.get("target") or 0)
        ok = {"alcista": target > price + 0.5 * atr, "bajista": target < price - 0.5 * atr,
              "lateral": abs(target - price) <= 1.5 * atr}.get(d)
        if not ok:
            raise ValueError(f"{name}: objetivo {target:.0f} incoherente con la dirección {d} (precio {price:.0f})")
        if not below - tol <= target <= above + tol:
            raise ValueError(f"{name}: objetivo {target:.0f} fuera de los niveles de revisión ({below:.0f}-{above:.0f})")
        return {"direction": d, "target": round(target), "target_basis": check_basis(target, sc["target_basis"], levels, tol)}

    outlook, alternative = scenario(a["outlook"], "outlook"), scenario(a["alternative"], "alternative")
    if outlook["direction"] == alternative["direction"]:
        raise ValueError("el escenario alternativo va en la misma dirección que el más probable")
    return {"direction": a["direction"], "confidence": a["confidence"], "review_above": review(a["review_above"]),
            "review_below": review(a["review_below"]), "outlook": outlook, "alternative": alternative,
            "notes": {"trend": str(notes["trend"]).strip(), "drivers": [str(x).strip() for x in notes.get("drivers", []) if str(x).strip()]}}


# Palabras de cada texto de la tendencia: pasarse se avisa; con más del doble (o claves de más de POINT_MAX_WORDS) se pide
# a otro redactor (16 nov 2026: con un solo texto de 150 palabras como máximo, dos redactores seguidos se pasaron y no se
# publicó la revisión)
TREND_WORDS = {"summary": 90, "outlook": 70, "points": 35}


def check_trend_texts(a: dict) -> dict:
    _fix_languages(a)
    out = {}
    for lang in ("es", "en"):
        t = a[lang]
        summary, outlook = str(t.get("summary", "")).strip(), str(t.get("outlook", "")).strip()
        points = [x.strip() for x in t.get("points", []) if str(x).strip()][:4]
        if not summary or not outlook or len(points) < 2:
            raise ValueError(f"texto vacío o menos de 2 claves ({lang})")
        for k, v in (("summary", summary), ("outlook", outlook)):
            n = len(v.split())
            if n > 2 * TREND_WORDS[k]:
                raise ValueError(f"{k} de {n} palabras ({lang}), más del doble de {TREND_WORDS[k]}")
            if n > TREND_WORDS[k]:
                log.warning("Tendencia, %s demasiado largo (%s): %d/%d palabras", k, lang, n, TREND_WORDS[k])
        if any(len(x.split()) > POINT_MAX_WORDS for x in points):
            raise ValueError(f"claves de más de {POINT_MAX_WORDS} palabras ({lang})")
        out[lang] = {"summary": summary, "outlook": outlook, "points": points}
    return out


def load_trend() -> dict | None:
    try:
        return json.loads((OUT_DIR / TREND_FILE).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def review_trigger(trend: dict | None, raw_1d: list[list]) -> dict | None:
    """Por qué hay que revisar ya la tendencia: no la hay, o un cierre diario posterior a su revisión superó uno de sus
    niveles (solo velas cerradas). None si sigue valiendo."""
    if not trend:
        return {"reason": "missing"}
    since = datetime.fromisoformat(trend["generated_at"]).timestamp() * 1000
    now = datetime.now(timezone.utc).timestamp() * 1000
    above, below = trend["review_above"]["price"], trend["review_below"]["price"]
    for r in raw_1d:
        close_time, close = r[6], float(r[4])  # r[6]: hora de cierre de la vela (ms)
        if close_time <= since or close_time > now:
            continue
        if close > above or close < below:
            return {"reason": "close_above" if close > above else "close_below", "date": _day(r), "close": round(close),
                    "level": above if close > above else below}
    return None


def build_trend(data: dict, trigger: dict | None = None) -> dict | None:
    """Analiza y publica la tendencia de fondo (trend.json). Devuelve la publicada o None si ningún modelo sirvió (se
    mantiene la anterior)."""
    previous = load_trend()
    user = json.dumps(trend_view(data, previous), separators=(",", ":"))
    prices: list[float] = []

    def check(raw: dict) -> dict:
        prices.append(float(get(PRICE_URL)["price"]))
        return validate_trend(raw, prices[-1], data)

    try:
        result, spec = llm.complete(TREND_PROMPT, user, TREND_SCHEMA, "tendencia", MODELS, check, max_tokens=32000)
    except RuntimeError:
        log.error("ningún modelo dio una tendencia válida: se mantiene la anterior")
        return None
    price, model = prices[-1], model_name(spec)
    facts = {k: v for k, v in trend_view(data, previous).items() if not k.startswith("candles_")}
    text_user = json.dumps({"analysis": {"price": round(price), **{k: v for k, v in result.items() if k != "notes"}},
                            "notes": result["notes"], "data": facts}, separators=(",", ":"), ensure_ascii=False)
    try:
        texts, spec = llm.complete(TREND_TEXT_PROMPT, text_user, TREND_TEXT_SCHEMA, "tendencia-textos", TEXT_MODELS,
                                   check_trend_texts, max_tokens=16000)
    except RuntimeError:
        log.error("ningún modelo redactó la tendencia: se mantiene la anterior")
        return None
    out = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "model": model,
           "text_model": model_name(spec), "price": round(price),
           # weekly: la revisión de los lunes; early: adelantada por un cierre diario; missing: no había ninguna
           "review": {"reason": "weekly"} if trigger is None else trigger,
           **{k: v for k, v in result.items() if k != "notes"}, **texts,
           # Referencias para el gráfico de la tendencia (calculadas, no del modelo)
           "references": trend_references(data)}
    write_json(OUT_DIR / TREND_FILE, out)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with open(STATE_DIR / TREND_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps({**{k: out[k] for k in ("generated_at", "model", "price", "review", "direction", "confidence",
                                                   "review_above", "review_below", "outlook", "alternative")}, "notes": result["notes"]}) + "\n")
    log.info("trend.json: %s (confianza %s), revisar con un cierre por encima de %s o por debajo de %s (%s; textos, %s)",
             out["direction"], out["confidence"], out["review_above"]["price"], out["review_below"]["price"], model,
             out["text_model"])
    return out


def trend_references(data: dict) -> dict:
    """Máximo histórico (cierre diario) y máximo y mínimo de 12 meses (con mecha) del momento de la revisión."""
    out = {}
    if ath := (data.get("cycle_context") or {}).get("all_time_high"):
        out["all_time_high"] = {"price": ath["close"], "date": ath["date"]}
    for k in ("high_12m", "low_12m"):
        if v := (data.get("trend_context") or {}).get(k):
            out[k] = {"price": v["price"], "date": v["date"]}
    return out


# Liquidez macro para el análisis semanal: los valores en bruto del pipeline (no sus puntuaciones: el análisis es del
# modelo), hoy y hace 4 y 13 semanas. Backtest de noviembre de 2026: la categoría de liquidez anticipa la rentabilidad de
# BTC a 30 días (−0,23) y sobre todo a 90 (−0,46), el plazo del análisis semanal
MACRO_LIQUIDITY = {"global_liquidity_roc": ("global_liquidity_change_13w_pct", 100, 2),
                   "us2y_chg": ("us_2y_yield_change_13w_pp", 1, 2),
                   "curve_chg": ("yield_curve_10y_2y_change_13w_pp", 1, 2),
                   "nfci": ("chicago_fed_financial_conditions_nfci", 1, 3)}


def macro_liquidity(scores: dict) -> dict:
    """De liquidity_scores.json: cada serie hoy y hace 4 y 13 semanas (último dato publicado)."""
    start = datetime.fromisoformat(scores["start"]).date()
    out: dict = {}
    for key, (name, scale, digits) in MACRO_LIQUIDITY.items():
        values = (scores["metrics"].get(key) or {}).get("value") or []
        last = max((i for i, v in enumerate(values) if v is not None), default=None)
        if last is None:
            continue
        at = lambda i: None if i < 0 or values[i] is None else round(values[i] * scale, digits)
        out[name] = {"now": at(last), "4w_ago": at(last - 28), "13w_ago": at(last - 91)}
        out["as_of"] = (start + timedelta(days=last)).isoformat()
    return out


def stock_panic(vix: dict) -> dict:
    """El VIX para el análisis semanal: su nivel y, si pasa del umbral, cómo es el pánico y lo que hizo BTC en los casos
    parecidos ya cerrados (mismo tipo de pánico y mismo contexto de tipos; calculados en el pipeline, metrics.vix_json)."""
    ctx = vix.get("context") or {}
    pct = lambda v: None if v is None else round(v * 100)
    out = {"date": vix["date"], "close": vix["close"], "level": vix["level"], "thresholds": vix.get("thresholds")}
    if vix["level"] != "none" and ctx:
        out.update(kind=ctx.get("kind"), rate_hikes_priced=ctx.get("tightening"), us2y_chg_13w=ctx.get("us2y_chg_13w"))
        out["similar_cases"] = [
            {"start": e["start"], "vix_peak": e["peak"], "btc_90d_pct": pct(e["btc_90d"]), "btc_180d_pct": pct(e["btc_180d"]),
             "btc_max_drop_90d_pct": pct(e["btc_max_drop_90d"])}
            for e in vix.get("episodes", [])
            if e["kind"] == ctx.get("kind") and e["tightening"] == ctx.get("tightening") and e["btc_90d"] is not None]
    return out


def background_trend(trend: dict) -> dict:
    """La tendencia publicada, como la recibe el análisis diario."""
    return {"reviewed_at": trend["generated_at"], "direction": trend["direction"], "confidence": trend["confidence"],
            "text": trend["es"].get("summary") or trend["es"].get("trend", ""), "review_above": trend["review_above"]["price"],
            # Sus claves, para que el análisis diario no repita las mismas métricas (se publican en la misma página)
            **({"points": trend["es"]["points"]} if trend["es"].get("points") else {}),
            "review_below": trend["review_below"]["price"],
            # Lo más probable en 2-4 semanas (ausente en las primeras revisiones)
            **({"outlook_2_4_weeks": {k: trend["outlook"][k] for k in ("direction", "target")}} if trend.get("outlook") else {})}


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="no llama al modelo: zonas de prueba")
    ap.add_argument("--weekly", action="store_true", help="solo la tendencia de fondo semanal (trend.json)")
    args = ap.parse_args()

    if args.weekly:
        if not build_trend(market()):
            raise SystemExit(1)
        return

    if args.dry_run:
        price = float(get(PRICE_URL)["price"])
        raw = dry_run(price)
        result, model, text_model = {**validate(raw, price), **check_texts(raw)}, "dry-run", "dry-run"
    else:
        data = market()
        # La tendencia de fondo semanal, revisada antes si un cierre diario superó uno de sus niveles o si no la hay
        trend = load_trend()
        trigger = review_trigger(trend, get(f"{SPOT}/klines?symbol=BTCUSDT&interval=1d&limit=10"))
        if trigger:
            log.info("Tendencia de fondo: revisión anticipada (%s)", trigger)
            trend = build_trend(data, trigger) or trend
        if trend:
            data["background_trend"] = background_trend(trend)
        user = json.dumps(model_view(data), separators=(",", ":"))
        prices: list[float] = []

        def check(raw: dict) -> dict:
            prices.append(float(get(PRICE_URL)["price"]))  # el del momento de la respuesta
            return validate(raw, prices[-1], data)

        try:
            # Si la respuesta no se sostiene (zonas al lado equivocado, precio que no cuadra…), se prueba el siguiente
            # GLM sin límite de esfuerzo razona hasta 20.000-26.000 tokens: con el límite general (16.000) fallaba a menudo
            result, spec = llm.complete(PROMPT, user, SCHEMA, "analisis", MODELS, check, max_tokens=32000)
        except RuntimeError:
            raise SystemExit("ningún modelo dio un análisis válido: se mantiene el anterior")
        price, model = prices[-1], model_name(spec)
        try:
            texts, spec = llm.complete(TEXT_PROMPT, text_input(result, data, price), TEXT_SCHEMA, "analisis-textos", TEXT_MODELS,
                                       check_texts, max_tokens=16000)
        except RuntimeError:
            raise SystemExit("ningún modelo redactó los textos: se mantiene el análisis anterior")
        result, text_model = {**result, **texts}, model_name(spec)

    # notes (las claves del analista para la redacción) no se publica: solo se guarda en el registro
    out = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "model": model, "text_model": text_model,
           "price": round(price), **{k: v for k, v in result.items() if k != "notes"}}
    # Liquidez pendiente e imbalances del momento del análisis, para dibujarlos en su gráfico (calculados, no del modelo)
    if not args.dry_run:
        out["liquidity"] = {"pools": data.get("liquidity_pools", {}),
                            "imbalances": {tf: v for tf, v in data.get("imbalances", {}).items() if tf in ("1d", "4h")}}
    write_json(OUT_DIR / "analysis.json", out)
    if not args.dry_run:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(STATE_DIR / "analysis_log.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({**{k: out[k] for k in LOG_FIELDS}, "text_model": text_model, "notes": result.get("notes")}) + "\n")
    log.info("analysis.json: %s; horas: %s hacia %s; 1-2 días: %s hacia %s (%s; textos, %s)", result["bias"],
             result["outlook"]["direction"], result["outlook"]["target"], result["outlook_days"]["direction"],
             result["outlook_days"]["target"], model, text_model)
    if not args.dry_run:  # después de publicar: no retrasa lo publicado
        shadow(data, user, out)


if __name__ == "__main__":
    main()
