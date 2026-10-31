"""Genera analysis.json: un análisis breve de la situación de BTC hecho por IA, con sus soportes, resistencias, sesgo y
lo más probable en las próximas horas. El modelo hace su propio análisis: nunca recibe niveles ni conclusiones nuestras.

Dos proveedores (ANALYSIS_PROVIDER):
  - "digitalocean" (por defecto): los modelos abiertos de DigitalOcean no buscan en internet, así que reciben datos de
    mercado en bruto (velas de 1 h, 4 h y diarias, derivados, Fear & Greed y flujos de los ETF) y, como contexto, los
    titulares de impacto alto de las últimas 48 h que ya clasifica build_news.py.
  - "gemini": no recibe ningún dato; busca por su cuenta con la Búsqueda de Google, que exige el nivel de pago de la API
    (5.000 búsquedas gratis al mes; aquí se usan unas 50).
El precio de Binance se usa para comprobar la respuesta (zonas a cada lado del precio, objetivos razonables): si no
cuadra, o si falla la llamada, se mantiene el analysis.json anterior. Cada análisis publicado se añade a
state/analysis_log.jsonl para poder medir después cuánto acierta.

Variables de entorno (ver .env.example): DO_MODEL_ACCESS_KEY o GEMINI_API_KEY, ANALYSIS_PROVIDER, ANALYSIS_MODELS,
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

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_news import OUT_DIR, STATE_DIR, chat, write_json  # noqa: E402

log = logging.getLogger("analysis")

PROVIDER = os.environ.get("ANALYSIS_PROVIDER", "digitalocean")
# Se prueban en orden si el anterior falla o está saturado
DEFAULT_MODELS = {
    # GLM-5.3 Flash fue el más preciso en las pruebas; DeepSeek V4 Flash confundía tendencias de los derivados
    "digitalocean": "glm-5.3-flash,qwen3.5-397b-a17b,deepseek-4-flash",
    "gemini": "gemini-flash-latest,gemini-3.5-flash,gemini-flash-lite-latest",
}
MODELS = [m.strip() for m in os.environ.get("ANALYSIS_MODELS", DEFAULT_MODELS[PROVIDER]).split(",") if m.strip()]
GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
SPOT = "https://data-api.binance.vision/api/v3"
FUTURES = "https://fapi.binance.com"
PRICE_URL = f"{SPOT}/ticker/price?symbol=BTCUSDT"
LATEST_URL = os.environ.get("ANALYSIS_LATEST_URL", "https://raw.githubusercontent.com/Jaterli/isbtccheap/main/web/public/data/latest.json")
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}

# Titulares de news.json que se pasan como contexto: los de impacto alto (rojo en la web) y recientes
NEWS_MIN_IMPACT = 7
NEWS_MAX_HOURS = 48

MAX_LEVELS = 4
MAX_TARGET = 0.15  # un objetivo a más de un 15 % no es "las próximas horas"

SEARCH_INTRO = """Eres un analista de mercado de Bitcoin. Busca la información más reciente que necesites (precio actual de \
BTC, su evolución reciente y lo que esté influyendo en él hoy) y haz tu propio análisis de la situación actual de BTC: \
tú decides qué factores pesan más."""

DATA_INTRO = """Eres un analista de mercado de Bitcoin. Recibes en JSON datos de mercado en bruto de BTC/USDT: velas \
diarias, de 4 h y de 1 h ([hora UTC, apertura, máximo, mínimo, cierre, volumen en BTC], de la más antigua a la más \
reciente; la última está en curso y su cierre es el precio actual), funding de los perpetuos, open interest, porcentaje \
de cuentas en largo, ratio de compras/ventas a mercado, Fear & Greed y flujos netos de los ETF al contado. Si hay \
noticias recientes de impacto alto, también recibes sus titulares (con hora UTC, medio e impacto estimado de 0 a 10) como \
contexto de lo que puede estar moviendo el precio. Haz tu propio análisis de la situación actual de BTC: tú decides qué \
factores pesan más."""

FORMAT = """Responde solo con un objeto JSON, sin texto antes ni después, con esta forma:
{
  "price": precio actual de BTC en dólares (número),
  "supports": [{"low": número, "high": número, "strength": 1 a 3}, ...],
  "resistances": [{"low": número, "high": número, "strength": 1 a 3}, ...],
  "bias": "alcista" | "bajista" | "neutral",
  "confidence": 1 a 3,
  "outlook": {"direction": "alcista" | "bajista" | "lateral", "target": número, "invalidation": número, "horizon_hours": número},
  "alternative": {"direction": "alcista" | "bajista" | "lateral", "target": número},
  "es": {"headline": texto, "summary": texto, "outlook": texto, "points": [texto, ...]},
  "en": {"headline": texto, "summary": texto, "outlook": texto, "points": [texto, ...]}
}

- supports y resistances: de 2 a 4 zonas inmediatas de cada lado del precio actual, como rangos [low, high] de anchura \
realista, de la más cercana a la más lejana; strength de 1 (débil) a 3 (fuerte). Soportes por debajo del precio y \
resistencias por encima.
- bias: el sesgo de corto plazo y confidence, tu confianza en él, de 1 (baja) a 3 (alta).
- outlook: lo más probable en las próximas horas (horizon_hours entre 4 y 24): dirección, precio objetivo y precio que \
invalidaría ese escenario (al otro lado del precio actual). alternative: el escenario alternativo menos probable, en una \
dirección distinta de la de outlook. Los precios y la dirección de outlook deben coincidir con lo que dicen los textos.
- es y en: el mismo análisis en español de España y en inglés. headline: una frase de 12 palabras como máximo. summary: \
la situación de BTC hoy en 2 o 3 frases (70 palabras como máximo). outlook: lo más probable en las próximas horas y qué \
lo invalidaría, en 1 o 2 frases. points: de 2 a 4 claves breves (25 palabras como máximo) de lo que está moviendo el \
precio.

Precios en dólares redondeados en los textos (78.500 $ en español, $78,500 en inglés). Habla de probabilidades y \
escenarios, nunca de certezas, y no des recomendaciones de compra o venta."""

ZONE = {"type": "object", "properties": {"low": {"type": "number"}, "high": {"type": "number"}, "strength": {"type": "integer"}},
        "required": ["low", "high", "strength"], "additionalProperties": False}
DIRECTION = {"type": "string", "enum": ["alcista", "bajista", "lateral"]}
TEXT = {"type": "object", "properties": {"headline": {"type": "string"}, "summary": {"type": "string"}, "outlook": {"type": "string"},
                                          "points": {"type": "array", "items": {"type": "string"}}},
        "required": ["headline", "summary", "outlook", "points"], "additionalProperties": False}
# Esquema estricto de la API de DigitalOcean (compatible con OpenAI): todos los campos obligatorios
SCHEMA = {
    "type": "object",
    "properties": {
        "price": {"type": "number"},
        "supports": {"type": "array", "items": ZONE},
        "resistances": {"type": "array", "items": ZONE},
        "bias": {"type": "string", "enum": ["alcista", "bajista", "neutral"]},
        "confidence": {"type": "integer"},
        "outlook": {"type": "object", "properties": {"direction": DIRECTION, "target": {"type": "number"}, "invalidation": {"type": "number"},
                                                     "horizon_hours": {"type": "integer"}},
                    "required": ["direction", "target", "invalidation", "horizon_hours"], "additionalProperties": False},
        "alternative": {"type": "object", "properties": {"direction": DIRECTION, "target": {"type": "number"}},
                        "required": ["direction", "target"], "additionalProperties": False},
        "es": TEXT,
        "en": TEXT,
    },
    "required": ["price", "supports", "resistances", "bias", "confidence", "outlook", "alternative", "es", "en"],
    "additionalProperties": False,
}


def klines(interval: str, limit: int) -> list[list]:
    """[hora UTC, apertura, máximo, mínimo, cierre, volumen en BTC], redondeado para gastar menos tokens."""
    rows = get(f"{SPOT}/klines?symbol=BTCUSDT&interval={interval}&limit={limit}")
    fmt = "%Y-%m-%d" if interval == "1d" else "%Y-%m-%d %H:%M"
    return [[datetime.fromtimestamp(r[0] / 1000, timezone.utc).strftime(fmt), *(round(float(x)) for x in r[1:6])] for r in rows]


def market() -> dict:
    """Datos en bruto, sin indicadores ni niveles: el análisis lo hace el modelo."""
    data: dict = {"candles_1d": klines("1d", 180), "candles_4h": klines("4h", 120), "candles_1h": klines("1h", 72)}
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
        data["news_headlines_high_impact"] = news
    try:
        metrics = {m["id"]: m["value"] for c in get(LATEST_URL)["categories"].values() for m in c["metrics"]}
        if metrics.get("etf_flows") is not None:
            data["spot_etf_net_flows_20_sessions_btc"] = round(metrics["etf_flows"])
    except Exception as e:
        log.warning("latest.json no disponible: %s", e)
    return data


def headlines() -> list[dict]:
    """Titulares de impacto alto de las últimas NEWS_MAX_HOURS horas, del news.json del cron de noticias."""
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


def digitalocean() -> tuple[dict, str, list[dict], str | None]:
    """Análisis del primer modelo de MODELS que conteste, con los datos de mercado en el mensaje."""
    data = json.dumps(market(), separators=(",", ":"))
    last: Exception | None = None
    for model in MODELS:
        try:
            return chat(f"{DATA_INTRO}\n\n{FORMAT}", data, SCHEMA, "analisis", model=model), model, [], None
        except Exception as e:  # el modelo siguiente puede responder
            last = e
            log.warning("%s: %s", model, e)
    raise RuntimeError(f"ningún modelo respondió: {last}")


def get(url: str):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as res:
        return json.loads(res.read())


def parse_json(text: str) -> dict:
    """El JSON de la respuesta, aunque venga entre ```json ... ``` o con texto alrededor."""
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("la respuesta no contiene JSON")
    return json.loads(m.group(0))


def gemini() -> tuple[dict, str, list[dict], str | None]:
    """(análisis, modelo, fuentes, sugerencias de búsqueda) del primer modelo de MODELS que conteste.
    Reintenta la saturación (429/503) y los errores del servidor."""
    body = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": f"{SEARCH_INTRO}\n\n{FORMAT}"}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {"temperature": 0.4},
    }).encode()
    last: Exception | None = None
    for model in MODELS:
        req = urllib.request.Request(GEMINI.format(model=model.strip()), data=body, method="POST", headers={
            "Content-Type": "application/json", "X-goog-api-key": os.environ["GEMINI_API_KEY"]})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=240) as res:
                    data = json.loads(res.read())
                cand = data["candidates"][0]
                if cand.get("finishReason") != "STOP":
                    raise RuntimeError(f"respuesta incompleta: finishReason={cand.get('finishReason')}")
                usage = data.get("usageMetadata", {})
                g = cand.get("groundingMetadata", {})
                log.info("%s (%s): %s tokens de entrada, %s de salida, %s de razonamiento; búsquedas: %s", model,
                         data.get("modelVersion"), usage.get("promptTokenCount"), usage.get("candidatesTokenCount"),
                         usage.get("thoughtsTokenCount"), g.get("webSearchQueries"))
                text = "".join(p.get("text", "") for p in cand["content"]["parts"] if not p.get("thought"))
                sources = [{"title": c["web"].get("title", ""), "uri": c["web"]["uri"]} for c in g.get("groundingChunks", []) if "web" in c]
                suggestions = g.get("searchEntryPoint", {}).get("renderedContent")
                return parse_json(text), data.get("modelVersion") or model, sources[:8], suggestions
            except urllib.error.HTTPError as e:
                try:
                    msg = json.loads(e.read())["error"]["message"]
                except Exception:
                    msg = ""
                last = RuntimeError(f"{model}: HTTP {e.code} {msg[:120]}")
                if e.code not in (429, 500, 502, 503, 504):
                    break  # modelo inexistente o petición inválida: se pasa al siguiente
            except (urllib.error.URLError, TimeoutError, RuntimeError, KeyError, ValueError) as e:
                last = RuntimeError(f"{model}: {e}")
            log.warning("%s", last)
            time.sleep(5 * 2**attempt)
    raise RuntimeError(f"ningún modelo respondió: {last}")


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

    def move(m: dict) -> dict:
        target = float(m["target"])
        if abs(target / price - 1) > MAX_TARGET:
            raise ValueError(f"objetivo fuera de rango: {target}")
        # La dirección la marca el objetivo: un "alcista" con objetivo por debajo no se sostiene
        d = "lateral" if abs(target / price - 1) < 0.004 else "alcista" if target > price else "bajista"
        out = {"direction": m.get("direction") if m.get("direction") == d or d == "lateral" else d, "target": round(target)}
        if out["direction"] not in ("alcista", "bajista", "lateral"):
            out["direction"] = d
        if "invalidation" in m:
            inv = float(m["invalidation"] or 0)
            other_side = (inv - price) * (target - price) < 0
            out["invalidation"] = round(inv) if inv and other_side and abs(inv / price - 1) <= MAX_TARGET else None
            out["horizon_hours"] = max(1, min(48, int(m.get("horizon_hours") or 24)))
        return out

    bias = a.get("bias") if a.get("bias") in ("alcista", "bajista", "neutral") else "neutral"
    main, alt = move(a["outlook"]), move(a["alternative"])
    if main["direction"] == alt["direction"]:
        raise ValueError(f"el escenario alternativo va en la misma dirección que el principal ({main['direction']})")
    result = {
        "bias": bias,
        "confidence": max(1, min(3, int(a.get("confidence") or 1))),
        "levels": sup + res,
        "outlook": main,
        "alternative": alt,
    }
    for lang in ("es", "en"):
        t = a[lang]
        if not all(str(t.get(k, "")).strip() for k in ("headline", "summary", "outlook")):
            raise ValueError(f"texto vacío ({lang})")
        result[lang] = {k: t[k].strip() for k in ("headline", "summary", "outlook")}
        result[lang]["points"] = [x.strip() for x in t.get("points", []) if x.strip()][:4]
    return result


def dry_run(price: float) -> dict:
    """Sin modelo: zonas a distancias fijas del precio, para probar la salida y la web."""
    z = lambda f, s: {"low": price * f - 300, "high": price * f + 300, "strength": s}
    text = {"headline": "Análisis de prueba (sin modelo)", "summary": "Generado con --dry-run.", "outlook": "Sin modelo.",
            "points": ["Sin modelo"]}
    return {"price": price, "supports": [z(0.985, 3), z(0.96, 2)], "resistances": [z(1.015, 2), z(1.04, 3)],
            "bias": "neutral", "confidence": 1,
            "outlook": {"direction": "bajista", "target": price * 0.985, "invalidation": price * 1.015, "horizon_hours": 12},
            "alternative": {"direction": "alcista", "target": price * 1.015}, "es": text, "en": text}


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="no llama al modelo: zonas de prueba")
    args = ap.parse_args()

    if args.dry_run:
        price = float(get(PRICE_URL)["price"])
        raw, model, sources, suggestions = dry_run(price), "dry-run", [], None
    else:
        raw, model, sources, suggestions = gemini() if PROVIDER == "gemini" else digitalocean()
        price = float(get(PRICE_URL)["price"])  # después: el precio del momento de la respuesta
    result = validate(raw, price)

    out = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "model": model, "price": round(price),
           **result, "sources": sources, "search_suggestions": suggestions}
    write_json(OUT_DIR / "analysis.json", out)
    if not args.dry_run:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(STATE_DIR / "analysis_log.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({k: out[k] for k in ("generated_at", "model", "price", "levels", "bias", "confidence", "outlook", "alternative")}) + "\n")
    log.info("analysis.json: %s, %s hacia %s (%s)", result["bias"], result["outlook"]["direction"], result["outlook"]["target"], model)


if __name__ == "__main__":
    main()
