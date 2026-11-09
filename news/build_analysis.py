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
Uso: python build_analysis.py [--dry-run]   (--dry-run no llama al modelo: zonas de prueba, para probar la web)
"""

import argparse
import json
import logging
import math
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import llm  # noqa: E402
from build_news import OUT_DIR, STATE_DIR, write_json  # noqa: E402

log = logging.getLogger("analysis")

# Por orden de preferencia (llm.py). En las pruebas (31 oct 2026), GLM-5.3 Flash dio el análisis más completo y preciso;
# Gemini 3.5 Flash acertó también pero con menos detalle (queda de respaldo, en el nivel gratuito), y DeepSeek V4 Flash
# confundía tendencias de los derivados. gpt-oss-120b (Groq) no cabe: los datos superan los 8.000 tokens por minuto de su
# nivel gratuito
MODELS = llm.models_from_env("ANALYSIS_MODELS", "glm-5.3-flash,qwen3.5-397b-a17b,gemini:gemini-3.5-flash,gemini:gemini-flash-latest")
SPOT = "https://data-api.binance.vision/api/v3"
FUTURES = "https://fapi.binance.com"
PRICE_URL = f"{SPOT}/ticker/price?symbol=BTCUSDT"
LATEST_URL = os.environ.get("ANALYSIS_LATEST_URL", "https://raw.githubusercontent.com/Jaterli/isbtccheap/main/web/public/data/latest.json")
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}
# Histórico diario de la web (cierres desde 2011), para los techos y suelos de ciclo
HISTORY_URL = LATEST_URL.rsplit("/", 1)[0] + "/history.json"

# Titulares de news.json que se pasan como contexto: los de impacto medio y alto (naranja y rojo en la web) y recientes
NEWS_MIN_IMPACT = 5
NEWS_MAX_HOURS = 48

MAX_LEVELS = 3
# Distancia máxima de un objetivo: un 15 % en horas o un 20 % en 1-2 días ya no es un escenario razonable
MAX_SHORT = 0.15
MAX_DAYS = 0.20

PROMPT = """Eres un analista de mercado de Bitcoin. Recibes en JSON datos de mercado en bruto de BTC/USDT: velas \
semanales (el último año), diarias, de 4 h y de 1 h ([hora UTC, apertura, máximo, mínimo, cierre, volumen en BTC], de la más antigua a la más \
reciente; la última está en curso y su cierre es el precio actual), funding de los perpetuos, open interest, porcentaje \
de cuentas en largo, ratio de compras/ventas a mercado, Fear & Greed, flujos netos de los ETF al contado, y la fecha y \
hora actuales con si la bolsa de EE. UU. (y con ella los ETF) está abierta, y la agenda económica de la semana (datos y \
decisiones de tipos con hora UTC, previsión, dato anterior y dato real si ya se publicó). Para cada temporalidad recibes \
también indicadores ya calculados con sus velas (incluida la que está en curso): RSI 14 y su valor en el máximo y en el \
mínimo de las últimas 50 velas, %B de Bollinger (20, 2), distancia en % a las medias de 50 y 200 velas, máximos y \
mínimos de 20 y 50 velas, y ATR 14 (el rango medio de cada vela, en dólares y en % del precio). En trend_context, el \
máximo y el mínimo de los últimos 12 meses. En cycle_context, con cierres diarios desde 2011: el máximo histórico (fecha, \
días transcurridos y distancia del precio), los techos y suelos de los ciclos anteriores (caída y días del techo al \
suelo) y el ciclo en curso con su mínimo hasta hoy. En market_structure, para semanal y diario y calculado con sus velas: los \
últimos pivotes de la estructura (con el RSI en cada uno y si son más altos o más bajos que el anterior: HH, LH, HL, LL), \
el extremo en curso, la última ruptura de un pivote por un cierre, las divergencias del RSI entre pivotes (clásicas u \
ocultas, alcistas o bajistas, y si se están formando) y los niveles de Fibonacci (en escala logarítmica) del tramo más \
reciente que contiene el precio: retrocesos dentro del tramo y extensiones 1,272 y 1,618 más allá de su final. En imbalances, para semanal, diario y 4 h, los huecos de liquidez (fair value gaps) cercanos que el precio aún \
no ha rellenado. En liquidity_pools, para diario y 4 h, la liquidez pendiente: máximos y mínimos de la estructura que \
el precio no ha vuelto a superar (encima, stops de cortos y compras por ruptura; debajo, stops de largos), marcando los \
máximos o mínimos iguales, que concentran más órdenes. En reaction_zones, para diario y 4 h, las zonas donde el precio \
ha girado de verdad (todos los pivotes cercanos, agrupados): cuántas reacciones ha habido, cuántas como techo y cuántas \
como suelo, y cuándo fue la última. Si hay noticias recientes de impacto medio o alto, también recibes sus titulares (con hora UTC, medio e impacto estimado de 0 a 10) como \
contexto de lo que puede estar moviendo el precio. Haz tu propio análisis de la situación actual de BTC: tú decides qué \
factores pesan más.

Responde solo con un objeto JSON, sin texto antes ni después, con esta forma:
{
  "price": precio actual de BTC en dólares (número),
  "supports": [{"low": número, "high": número, "strength": 1 a 3}, ...],
  "resistances": [{"low": número, "high": número, "strength": 1 a 3}, ...],
  "bias": "alcista" | "bajista" | "neutral",
  "confidence": 1 a 3,
  "outlook": {"direction": "alcista" | "bajista" | "lateral", "target": número, "invalidation": número, "horizon_hours": número},
  "outlook_days": {"direction": "alcista" | "bajista" | "lateral", "target": número, "invalidation": número},
  "alternative": {"direction": "alcista" | "bajista" | "lateral", "target": número},
  "es": {"headline": texto, "summary": texto, "trend": texto, "outlook": texto, "outlook_days": texto, "points": [texto, ...]},
  "en": {"headline": texto, "summary": texto, "trend": texto, "outlook": texto, "outlook_days": texto, "points": [texto, ...]}
}

- supports y resistances: de 1 a 3 zonas de cada lado del precio actual, solo las realmente relevantes, como rangos \
[low, high] de anchura realista, de la más cercana a la más lejana; strength de 1 (débil) a 3 (fuerte). Soportes por \
debajo del precio y resistencias por encima. Cada zona tiene que estar donde el precio haya reaccionado de verdad: \
reaction_zones (da más fuerza a las de más reacciones y más recientes), los pivotes de market_structure o la liquidez \
pendiente. Un nivel de Fibonacci por sí solo no es una zona.
- bias: el sesgo de corto plazo y confidence, tu confianza en él, de 1 (baja) a 3 (alta).
- outlook: lo más probable en las próximas horas (horizon_hours entre 4 y 24): dirección, precio objetivo y precio que \
invalidaría ese escenario (al otro lado del precio actual).
- outlook_days: lo más probable en 1-2 días, con su dirección, objetivo e invalidación (al otro lado del precio actual). \
Puede coincidir o no con el de las próximas horas.
- alternative: el escenario alternativo de las próximas horas, menos probable y en una dirección distinta de la de \
outlook.
- Los precios y las direcciones deben coincidir con lo que dicen los textos.
- Ajusta objetivos e invalidaciones a la volatilidad reciente (ATR): en las próximas horas el precio suele moverse unos \
pocos ATR de 1 h, y en 1-2 días, del orden de 1-2 ATR diarios. Un objetivo mucho más lejano es poco probable en ese plazo.
- Ten en cuenta la tendencia de fondo (semanas y meses: velas semanales y diarias, sus indicadores, market_structure y \
trend_context) al elegir lo más probable a horas y a 1-2 días: un movimiento de pocas horas no la cambia por sí solo. La \
estructura y las divergencias son referencias para el sesgo, no certezas. La liquidez pendiente y los imbalances cercanos \
son objetivos habituales del precio (suele ir a barrerlos o a rellenarlos antes de girar). Fibonacci sirve para estimar \
hasta dónde puede llegar el precio cuando atraviesa un tramo sin zonas de reacción, como un imbalance grande: úsalo \
para los objetivos en ese caso, no para situar las zonas. cycle_context \
sirve para encuadrar la tendencia de fondo (dónde está BTC frente a su máximo histórico y a ciclos anteriores), no para \
predecir las próximas horas o días por analogía con otros ciclos.
- es y en: el mismo análisis en español de España y en inglés. headline: una frase de 12 palabras como máximo. summary: \
la situación de BTC hoy en 2 o 3 frases (70 palabras como máximo). trend: la tendencia de fondo (semanas y meses: \
estructura, rupturas, divergencias) y en qué punto está el precio dentro de ella, en 1 o 2 frases (50 palabras como \
máximo). outlook: lo más probable en las \
próximas horas y qué \
lo invalidaría, en 1 o 2 frases. outlook_days: lo mismo para 1-2 días. points: de 2 a 4 claves breves (25 palabras como \
máximo) de lo que está moviendo el precio.

Precios en dólares redondeados en los textos (78.500 $ en español, $78,500 en inglés). Habla de probabilidades y \
escenarios, nunca de certezas, y no des recomendaciones de compra o venta."""

ZONE = {"type": "object", "properties": {"low": {"type": "number"}, "high": {"type": "number"}, "strength": {"type": "integer"}},
        "required": ["low", "high", "strength"], "additionalProperties": False}
DIRECTION = {"type": "string", "enum": ["alcista", "bajista", "lateral"]}
TEXT = {"type": "object",
        "properties": {"headline": {"type": "string"}, "summary": {"type": "string"}, "trend": {"type": "string"},
                       "outlook": {"type": "string"}, "outlook_days": {"type": "string"},
                       "points": {"type": "array", "items": {"type": "string"}}},
        "required": ["headline", "summary", "trend", "outlook", "outlook_days", "points"], "additionalProperties": False}
MOVE = {"type": "object", "properties": {"direction": DIRECTION, "target": {"type": "number"}, "invalidation": {"type": "number"}},
        "required": ["direction", "target", "invalidation"], "additionalProperties": False}
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
        "alternative": {"type": "object", "properties": {"direction": DIRECTION, "target": {"type": "number"}},
                        "required": ["direction", "target"], "additionalProperties": False},
        "es": TEXT,
        "en": TEXT,
    },
    "required": ["price", "supports", "resistances", "bias", "confidence", "outlook", "outlook_days", "alternative", "es", "en"],
    "additionalProperties": False,
}


# ---------- Datos ----------

def get(url: str):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as res:
        return json.loads(res.read())


# Velas que ve el modelo por temporalidad (las semanales, para la tendencia de fondo) y las que se descargan para los
# indicadores (medias de 200) y, en diario, para el contexto de los últimos 12 meses
CANDLES = {"1w": 52, "1d": 180, "4h": 120, "1h": 72}
CANDLES_FOR_INDICATORS = {"1d": 400}
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


def _zigzag(high: list[float], low: list[float], threshold: float) -> tuple[list[tuple[int, str, float]], tuple[int, str, float] | None]:
    """Pivotes alternos (máximo, mínimo…) separados al menos por `threshold`: un extremo se confirma cuando el precio
    se aleja de él esa distancia. Devuelve los confirmados y el extremo en curso (aún sin confirmar)."""
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
            elif high[ext] - low[i] >= threshold:
                pivots.append((ext, "high", high[ext]))
                trend, ext = "down", i
        else:
            if low[i] <= low[ext]:
                ext = i
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
FIB_EXTENSIONS = (1.272, 1.618)


def structure(raw: list[list], tf: str) -> dict:
    """Estructura de mercado de una temporalidad, calculada (no interpretada): los últimos pivotes con el RSI en cada uno
    y si son máximos o mínimos más altos o más bajos que el anterior, la última ruptura de un pivote por un cierre, las
    divergencias del RSI entre los dos últimos máximos y los dos últimos mínimos, y los niveles de Fibonacci del último
    tramo completo. Sirve igual para tendencias alcistas y bajistas."""
    high, low, close = _hlc(raw)
    rsi = _rsi(close)
    pivots, current = _zigzag(high, low, STRUCTURE_ATR[tf] * _atr(high, low, close))
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

    # Fibonacci del tramo más reciente entre dos pivotes que aún contiene el precio (si ya lo ha devuelto entero, sus
    # niveles no sirven) y qué parte ha devuelto, todo en escala logarítmica
    fib = None
    for a, b in reversed(list(zip(labelled, labelled[1:]))):
        p0, p1 = a["price"], b["price"]
        if min(p0, p1) <= close[-1] <= max(p0, p1) and p0 != p1:
            fib = {"scale": "log", "from": {"date": a["date"], "price": p0}, "to": {"date": b["date"], "price": p1},
                   "retraced_pct": round(math.log(p1 / close[-1]) / math.log(p1 / p0) * 100, 1),
                   "retracements": {str(f): round(p1 * (p0 / p1) ** f) for f in FIB_RETRACEMENTS},
                   "extensions": {str(f): round(p0 * (p1 / p0) ** f) for f in FIB_EXTENSIONS}}
            break
    for p in labelled:
        del p["_i"]
    return {"pivots": labelled[-8:], "current_extreme": cur, "last_break": last_break, "rsi_divergences": divergences,
            "fibonacci_leg_containing_price": fib}


# Liquidez pendiente: tamaño mínimo de un tramo para que su extremo cuente (en ATR), tolerancia para dar por iguales dos
# máximos o dos mínimos (en ATR), distancia máxima al precio y cuántos niveles de cada lado
LIQUIDITY_ATR = {"1d": 2.0, "4h": 2.0}
EQUAL_ATR = 0.3
LIQUIDITY_RANGE = {"1d": 0.20, "4h": 0.08}
LIQUIDITY_MAX = 3


def liquidity_pools(raw: list[list], tf: str) -> list[dict]:
    """Liquidez pendiente: máximos y mínimos de la estructura que el precio no ha vuelto a superar. Por encima de un
    máximo quedan los stops de los cortos y las compras por ruptura; por debajo de un mínimo, los stops de los largos.
    Los que están casi al mismo precio (máximos o mínimos iguales) se agrupan: concentran más órdenes. Los más cercanos
    al precio, por encima y por debajo. Se calcula con las velas, sin suponer nada del apalancamiento."""
    high, low, close = _hlc(raw)
    atr, price = _atr(high, low, close), close[-1]
    pivots, _ = _zigzag(high, low, LIQUIDITY_ATR[tf] * atr)
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
    near = lambda side: sorted((p for p in out if p["side"] == side), key=lambda p: abs(p["pct_from_price"]))[:LIQUIDITY_MAX]
    return near("above") + near("below")


# Zonas de reacción: pivotes de tramos de al menos REACTION_ATR (más sensible que la estructura, para no perder giros
# intermedios), agrupados mientras la zona no pase de REACTION_WIDTH_ATR de ancho, y los más cercanos de cada lado
REACTION_ATR = {"1d": 1.5, "4h": 2.0}
REACTION_WIDTH_ATR = 1.0
REACTION_RANGE = {"1d": 0.25, "4h": 0.10}
REACTION_MAX = 5


def reaction_zones(raw: list[list], tf: str) -> list[dict]:
    """Zonas donde el precio ha girado de verdad: todos los pivotes (máximos y mínimos de tramos relevantes, se hayan
    vuelto a tocar o no) agrupados por cercanía, con cuántas veces ha reaccionado ahí el precio, desde qué lado y cuándo
    fue la última. Son la base de los soportes y resistencias; un mismo nivel puede haber sido soporte y luego
    resistencia (o al revés)."""
    high, low, close = _hlc(raw)
    atr, price = _atr(high, low, close), close[-1]
    pivots, _ = _zigzag(high, low, REACTION_ATR[tf] * atr)
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
        out.append({"low": round(z["low"]), "high": round(z["high"]), "side": "above" if z["low"] > price else "below" if z["high"] < price else "at_price",
                    "reactions": len(z["touches"]), "as_high": sum(k == "high" for _, k in z["touches"]),
                    "as_low": sum(k == "low" for _, k in z["touches"]), "last": _day(raw[last]),
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
    for i in range(1, len(raw) - 1):
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
            data.setdefault("reaction_zones", {})[tf] = reaction_zones(raw, tf)
    try:
        fr = get(f"{FUTURES}/fapi/v1/fundingRate?symbol=BTCUSDT&limit=21")
        data["funding_rate_8h_pct"] = [round(float(x["fundingRate"]) * 100, 4) for x in fr]
        oi = get(f"{FUTURES}/futures/data/openInterestHist?symbol=BTCUSDT&period=4h&limit=42")
        data["open_interest_btc_4h"] = [round(float(x["sumOpenInterest"])) for x in oi]
        ls = get(f"{FUTURES}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=4h&limit=42")
        data["accounts_long_pct_4h"] = [round(float(x["longAccount"]) * 100, 1) for x in ls]
        tk = get(f"{FUTURES}/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=4h&limit=42")
        data["taker_buy_sell_ratio_4h"] = [round(float(x["buySellRatio"]), 3) for x in tk]
    except Exception as e:  # sin derivados el análisis sigue, con menos datos
        log.warning("derivados no disponibles: %s", e)
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
        data["cycle_context"] = cycle_context(get(HISTORY_URL))
    except Exception as e:  # sin el histórico, el análisis sigue sin el contexto de ciclo
        log.warning("history.json no disponible: %s", e)
    try:
        metrics = {m["id"]: m["value"] for c in get(LATEST_URL)["categories"].values() for m in c["metrics"]}
        if metrics.get("etf_flows") is not None:
            data["spot_etf_net_flows_20_sessions_btc"] = round(metrics["etf_flows"])
    except Exception as e:
        log.warning("latest.json no disponible: %s", e)
    return data


# ---------- Modelos ----------

# ---------- Validación ----------

def validate(a: dict, price: float) -> dict:
    """Ordena y filtra las zonas, corrige lo que se puede y lanza ValueError si el análisis no se sostiene."""
    said = float(a.get("price") or 0)
    if not said or abs(said / price - 1) > 0.03:
        raise ValueError(f"el modelo da un precio de {said} y en Binance está a {price:.0f}")

    def zones(raw: list[dict], kind: str) -> list[dict]:
        out = []
        for z in raw:
            lo, hi = sorted((float(z["low"]), float(z["high"])))
            mid = (lo + hi) / 2
            near = abs(mid / price - 1) <= 0.25
            side = mid < price * 1.005 if kind == "support" else mid > price * 0.995
            if near and side and hi - lo < price * 0.06:
                out.append({"kind": kind, "low": round(lo), "high": round(hi), "mid": round(mid),
                            "strength": max(1, min(3, int(z.get("strength", 2))))})
        out.sort(key=lambda z: abs(z["mid"] - price))
        for i, z in enumerate(out[:MAX_LEVELS]):
            z["id"] = f"{'S' if kind == 'support' else 'R'}{i + 1}"
        return out[:MAX_LEVELS]

    sup, res = zones(a["supports"], "support"), zones(a["resistances"], "resistance")
    if not sup or not res:
        raise ValueError(f"faltan zonas: {len(sup)} soportes, {len(res)} resistencias")

    def move(m: dict, limit: float) -> dict:
        target = float(m["target"])
        if abs(target / price - 1) > limit:
            raise ValueError(f"objetivo fuera de rango: {target}")
        # La dirección la marca el objetivo: un "alcista" con objetivo por debajo no se sostiene
        d = "lateral" if abs(target / price - 1) < 0.004 else "alcista" if target > price else "bajista"
        out = {"direction": m.get("direction") if m.get("direction") == d or d == "lateral" else d, "target": round(target)}
        if out["direction"] not in ("alcista", "bajista", "lateral"):
            out["direction"] = d
        if "invalidation" in m:
            inv = float(m["invalidation"] or 0)
            other_side = (inv - price) * (target - price) < 0
            out["invalidation"] = round(inv) if inv and other_side and abs(inv / price - 1) <= limit else None
        return out

    short, days, alt = move(a["outlook"], MAX_SHORT), move(a["outlook_days"], MAX_DAYS), move(a["alternative"], MAX_SHORT)
    short["horizon_hours"] = max(1, min(24, int(a["outlook"].get("horizon_hours") or 12)))
    if short["direction"] == alt["direction"]:
        raise ValueError(f"el escenario alternativo va en la misma dirección que el principal ({short['direction']})")

    result = {
        "bias": a.get("bias") if a.get("bias") in ("alcista", "bajista", "neutral") else "neutral",
        "confidence": max(1, min(3, int(a.get("confidence") or 1))),
        "levels": sup + res,
        "outlook": short,
        "outlook_days": days,
        "alternative": alt,
    }
    for lang in ("es", "en"):
        t = a[lang]
        if not all(str(t.get(k, "")).strip() for k in ("headline", "summary", "trend", "outlook", "outlook_days")):
            raise ValueError(f"texto vacío ({lang})")
        result[lang] = {k: t[k].strip() for k in ("headline", "summary", "trend", "outlook", "outlook_days")}
        result[lang]["points"] = [x.strip() for x in t.get("points", []) if x.strip()][:4]
    return result


def dry_run(price: float) -> dict:
    """Sin modelo: zonas a distancias fijas del precio, para probar la salida y la web."""
    z = lambda f, s: {"low": price * f - 300, "high": price * f + 300, "strength": s}
    text = {"headline": "Análisis de prueba (sin modelo)", "summary": "Generado con --dry-run.", "trend": "Sin modelo.", "outlook": "Sin modelo.",
            "outlook_days": "Sin modelo.", "points": ["Sin modelo"]}
    return {"price": price, "supports": [z(0.985, 3), z(0.96, 2)], "resistances": [z(1.015, 2), z(1.04, 3)],
            "bias": "neutral", "confidence": 1,
            "outlook": {"direction": "bajista", "target": price * 0.985, "invalidation": price * 1.015, "horizon_hours": 12},
            "outlook_days": {"direction": "alcista", "target": price * 1.04, "invalidation": price * 0.96},
            "alternative": {"direction": "alcista", "target": price * 1.015}, "es": text, "en": text}


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="no llama al modelo: zonas de prueba")
    args = ap.parse_args()

    if args.dry_run:
        price = float(get(PRICE_URL)["price"])
        result, model = validate(dry_run(price), price), "dry-run"
    else:
        data = market()
        user = json.dumps(data, separators=(",", ":"))
        prices: list[float] = []

        def check(raw: dict) -> dict:
            prices.append(float(get(PRICE_URL)["price"]))  # el del momento de la respuesta
            return validate(raw, prices[-1])

        try:
            # Si la respuesta no se sostiene (zonas al lado equivocado, precio que no cuadra…), se prueba el siguiente
            result, spec = llm.complete(PROMPT, user, SCHEMA, "analisis", MODELS, check)
        except RuntimeError:
            raise SystemExit("ningún modelo dio un análisis válido: se mantiene el anterior")
        price, model = prices[-1], llm.label(spec)

    out = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "model": model, "price": round(price), **result}
    # Liquidez pendiente e imbalances del momento del análisis, para dibujarlos en su gráfico (calculados, no del modelo)
    if not args.dry_run:
        out["liquidity"] = {"pools": data.get("liquidity_pools", {}),
                            "imbalances": {tf: v for tf, v in data.get("imbalances", {}).items() if tf in ("1d", "4h")}}
    write_json(OUT_DIR / "analysis.json", out)
    if not args.dry_run:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(STATE_DIR / "analysis_log.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({k: out[k] for k in ("generated_at", "model", "price", "levels", "bias", "confidence", "outlook",
                                                    "outlook_days", "alternative")}) + "\n")
    log.info("analysis.json: %s; horas: %s hacia %s; 1-2 días: %s hacia %s (%s)", result["bias"], result["outlook"]["direction"],
             result["outlook"]["target"], result["outlook_days"]["direction"], result["outlook_days"]["target"], model)


if __name__ == "__main__":
    main()
