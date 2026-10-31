"""Genera analysis.json: un análisis breve de la situación de BTC hecho por IA, con sus soportes, resistencias, sesgo, lo
más probable en las próximas horas y en 1-2 días, y un escenario alternativo.

El modelo recibe datos de mercado en bruto (velas de 1 h, 4 h y diarias, derivados, Fear & Greed y flujos de los ETF),
la hora actual y si la bolsa de EE. UU. está abierta (en fin de semana la liquidez es menor) y, como contexto, los
titulares de impacto medio y alto de las últimas 48 h que ya clasifica build_news.py. Nunca recibe niveles ni conclusiones
nuestras: el análisis es suyo.

Los modelos de ANALYSIS_MODELS se prueban en orden: si uno falla o su respuesta no se sostiene (zonas al lado equivocado
del precio, objetivos fuera de rango, escenarios incoherentes), se pasa al siguiente. Los que empiezan por "gemini:" van
a la API de Gemini; el resto, a la inferencia de DigitalOcean. Si ninguno sirve se mantiene el analysis.json anterior.
Cada análisis publicado se añade a state/analysis_log.jsonl para poder medir después cuánto acierta.

Variables de entorno (ver .env.example): DO_MODEL_ACCESS_KEY, GEMINI_API_KEY (para los gemini:), ANALYSIS_MODELS,
NEWS_OUT_DIR, NEWS_STATE_DIR.
Uso: python build_analysis.py [--dry-run]   (--dry-run no llama al modelo: zonas de prueba, para probar la web)
"""

import argparse
import json
import logging
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_news import OUT_DIR, STATE_DIR, chat, write_json  # noqa: E402

log = logging.getLogger("analysis")

# En las pruebas (31 oct 2026), GLM-5.3 Flash dio el análisis más completo y preciso; Gemini 3.5 Flash acertó también pero
# con menos detalle (queda de respaldo, en el nivel gratuito), y DeepSeek V4 Flash confundía tendencias de los derivados
MODELS = [m.strip() for m in os.environ.get(
    "ANALYSIS_MODELS", "glm-5.3-flash,qwen3.5-397b-a17b,gemini:gemini-3.5-flash,gemini:gemini-flash-latest").split(",") if m.strip()]
GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
SPOT = "https://data-api.binance.vision/api/v3"
FUTURES = "https://fapi.binance.com"
PRICE_URL = f"{SPOT}/ticker/price?symbol=BTCUSDT"
LATEST_URL = os.environ.get("ANALYSIS_LATEST_URL", "https://raw.githubusercontent.com/Jaterli/isbtccheap/main/web/public/data/latest.json")
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}

# Titulares de news.json que se pasan como contexto: los de impacto medio y alto (naranja y rojo en la web) y recientes
NEWS_MIN_IMPACT = 5
NEWS_MAX_HOURS = 48

MAX_LEVELS = 3
# Distancia máxima de un objetivo: un 15 % en horas o un 20 % en 1-2 días ya no es un escenario razonable
MAX_SHORT = 0.15
MAX_DAYS = 0.20

PROMPT = """Eres un analista de mercado de Bitcoin. Recibes en JSON datos de mercado en bruto de BTC/USDT: velas \
diarias, de 4 h y de 1 h ([hora UTC, apertura, máximo, mínimo, cierre, volumen en BTC], de la más antigua a la más \
reciente; la última está en curso y su cierre es el precio actual), funding de los perpetuos, open interest, porcentaje \
de cuentas en largo, ratio de compras/ventas a mercado, Fear & Greed, flujos netos de los ETF al contado, y la fecha y \
hora actuales con si la bolsa de EE. UU. (y con ella los ETF) está abierta. Si hay noticias recientes de impacto medio o alto, también recibes sus titulares (con hora UTC, medio e impacto estimado de 0 a 10) como \
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
  "es": {"headline": texto, "summary": texto, "outlook": texto, "outlook_days": texto, "points": [texto, ...]},
  "en": {"headline": texto, "summary": texto, "outlook": texto, "outlook_days": texto, "points": [texto, ...]}
}

- supports y resistances: de 1 a 3 zonas de cada lado del precio actual, solo las realmente relevantes, como rangos \
[low, high] de anchura realista, de la más cercana a la más lejana; strength de 1 (débil) a 3 (fuerte). Soportes por \
debajo del precio y resistencias por encima.
- bias: el sesgo de corto plazo y confidence, tu confianza en él, de 1 (baja) a 3 (alta).
- outlook: lo más probable en las próximas horas (horizon_hours entre 4 y 24): dirección, precio objetivo y precio que \
invalidaría ese escenario (al otro lado del precio actual).
- outlook_days: lo más probable en 1-2 días, con su dirección, objetivo e invalidación (al otro lado del precio actual). \
Puede coincidir o no con el de las próximas horas.
- alternative: el escenario alternativo de las próximas horas, menos probable y en una dirección distinta de la de \
outlook.
- Los precios y las direcciones deben coincidir con lo que dicen los textos.
- es y en: el mismo análisis en español de España y en inglés. headline: una frase de 12 palabras como máximo. summary: \
la situación de BTC hoy en 2 o 3 frases (70 palabras como máximo). outlook: lo más probable en las próximas horas y qué \
lo invalidaría, en 1 o 2 frases. outlook_days: lo mismo para 1-2 días. points: de 2 a 4 claves breves (25 palabras como \
máximo) de lo que está moviendo el precio.

Precios en dólares redondeados en los textos (78.500 $ en español, $78,500 en inglés). Habla de probabilidades y \
escenarios, nunca de certezas, y no des recomendaciones de compra o venta."""

ZONE = {"type": "object", "properties": {"low": {"type": "number"}, "high": {"type": "number"}, "strength": {"type": "integer"}},
        "required": ["low", "high", "strength"], "additionalProperties": False}
DIRECTION = {"type": "string", "enum": ["alcista", "bajista", "lateral"]}
TEXT = {"type": "object",
        "properties": {"headline": {"type": "string"}, "summary": {"type": "string"}, "outlook": {"type": "string"},
                       "outlook_days": {"type": "string"}, "points": {"type": "array", "items": {"type": "string"}}},
        "required": ["headline", "summary", "outlook", "outlook_days", "points"], "additionalProperties": False}
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


def klines(interval: str, limit: int) -> list[list]:
    """[hora UTC, apertura, máximo, mínimo, cierre, volumen en BTC], redondeado para gastar menos tokens."""
    rows = get(f"{SPOT}/klines?symbol=BTCUSDT&interval={interval}&limit={limit}")
    fmt = "%Y-%m-%d" if interval == "1d" else "%Y-%m-%d %H:%M"
    return [[datetime.fromtimestamp(r[0] / 1000, timezone.utc).strftime(fmt), *(round(float(x)) for x in r[1:6])] for r in rows]


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


def now_context() -> dict:
    """Día y hora, y si la bolsa de EE. UU. está abierta: fuera de su horario (sobre todo en fin de semana) hay menos
    liquidez, sin flujos de los ETF. Es un dato, no una conclusión: el modelo decide si le da importancia."""
    now = datetime.now(timezone.utc)
    ny = now.astimezone(ZoneInfo("America/New_York"))
    is_open = ny.weekday() < 5 and (9, 30) <= (ny.hour, ny.minute) < (16, 0)
    return {"now_utc": now.strftime("%Y-%m-%d %H:%M"), "weekday": now.strftime("%A"), "us_stock_market_open": is_open}


def market() -> dict:
    """Datos en bruto, sin indicadores ni niveles: el análisis lo hace el modelo."""
    data: dict = {"context": now_context(), "candles_1d": klines("1d", 180), "candles_4h": klines("4h", 120),
                  "candles_1h": klines("1h", 72)}
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
    try:
        metrics = {m["id"]: m["value"] for c in get(LATEST_URL)["categories"].values() for m in c["metrics"]}
        if metrics.get("etf_flows") is not None:
            data["spot_etf_net_flows_20_sessions_btc"] = round(metrics["etf_flows"])
    except Exception as e:
        log.warning("latest.json no disponible: %s", e)
    return data


# ---------- Modelos ----------

def gemini(model: str, user: str) -> dict:
    """Llamada a la API de Gemini con respuesta JSON según SCHEMA. Reintenta la saturación (429/503)."""
    body = json.dumps({
        "systemInstruction": {"parts": [{"text": PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": SCHEMA, "temperature": 0.4},
    }).encode()
    req = urllib.request.Request(GEMINI.format(model=model), data=body, method="POST", headers={
        "Content-Type": "application/json", "X-goog-api-key": os.environ["GEMINI_API_KEY"]})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=240) as res:
                data = json.loads(res.read())
            break
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read())["error"]["message"]
            except Exception:
                msg = ""
            if e.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise RuntimeError(f"HTTP {e.code} {msg[:120]}") from None
        time.sleep(5 * 2**attempt)
    cand = data["candidates"][0]
    if cand.get("finishReason") != "STOP":
        raise RuntimeError(f"respuesta incompleta: finishReason={cand.get('finishReason')}")
    usage = data.get("usageMetadata", {})
    log.info("%s (%s): %s tokens de entrada, %s de salida, %s de razonamiento", model, data.get("modelVersion"),
             usage.get("promptTokenCount"), usage.get("candidatesTokenCount"), usage.get("thoughtsTokenCount"))
    text = "".join(p.get("text", "") for p in cand["content"]["parts"] if not p.get("thought"))
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("la respuesta no contiene JSON")
    return json.loads(m.group(0))


def ask(model: str, user: str) -> dict:
    if model.startswith("gemini:"):
        return gemini(model.removeprefix("gemini:"), user)
    return chat(PROMPT, user, SCHEMA, "analisis", model=model)


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
        if not all(str(t.get(k, "")).strip() for k in ("headline", "summary", "outlook", "outlook_days")):
            raise ValueError(f"texto vacío ({lang})")
        result[lang] = {k: t[k].strip() for k in ("headline", "summary", "outlook", "outlook_days")}
        result[lang]["points"] = [x.strip() for x in t.get("points", []) if x.strip()][:4]
    return result


def dry_run(price: float) -> dict:
    """Sin modelo: zonas a distancias fijas del precio, para probar la salida y la web."""
    z = lambda f, s: {"low": price * f - 300, "high": price * f + 300, "strength": s}
    text = {"headline": "Análisis de prueba (sin modelo)", "summary": "Generado con --dry-run.", "outlook": "Sin modelo.",
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
        user = json.dumps(market(), separators=(",", ":"))
        result = model = None
        for m in MODELS:
            try:
                raw = ask(m, user)
                price = float(get(PRICE_URL)["price"])  # el del momento de la respuesta
                result, model = validate(raw, price), m.removeprefix("gemini:")
                break
            except Exception as e:  # el modelo siguiente puede servir
                log.warning("%s: %s", m, e)
        if result is None:
            raise SystemExit("ningún modelo dio un análisis válido: se mantiene el anterior")

    out = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "model": model, "price": round(price), **result}
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
