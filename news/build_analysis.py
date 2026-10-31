"""Genera analysis.json: análisis de BTC hecho por Gemini, con sus soportes, resistencias, sesgo y lo más probable en las
próximas horas.

Cada ejecución (cron dos veces al día en el droplet):
  1. Descarga datos de mercado en bruto: velas de 1 h, 4 h y diarias de Binance, derivados (funding, open interest,
     cuentas en largo y compras a mercado), el Fear & Greed de Alternative.me y los flujos de los ETF del índice.
  2. Se los pasa a Gemini sin niveles ni sesgo calculados por nosotros: el modelo hace su propio análisis y devuelve las
     zonas, el sesgo, el movimiento más probable y uno alternativo, con un texto en español e inglés.
  3. Comprueba que la respuesta sea coherente con el precio (zonas a su lado, objetivos razonables) antes de publicarla.
Si algo falla se mantiene el analysis.json anterior. Cada análisis publicado se añade a state/analysis_log.jsonl para
poder medir después cuánto acierta.

Variables de entorno (ver .env.example): GEMINI_API_KEY, ANALYSIS_MODELS (opcional), NEWS_OUT_DIR, NEWS_STATE_DIR.
Uso: python build_analysis.py [--dry-run]   (--dry-run no llama al modelo: niveles por reglas simples, para probar la web)
"""

import argparse
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_news import OUT_DIR, STATE_DIR, write_json  # noqa: E402

log = logging.getLogger("analysis")

# Se prueban en orden: los "latest" de Google a veces responden 503 por saturación
MODELS = os.environ.get("ANALYSIS_MODELS", "gemini-flash-latest,gemini-3.5-flash,gemini-flash-lite-latest").split(",")
GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
SPOT = "https://data-api.binance.vision/api/v3"
FUTURES = "https://fapi.binance.com"
LATEST_URL = os.environ.get("ANALYSIS_LATEST_URL", "https://raw.githubusercontent.com/Jaterli/isbtccheap/main/web/public/data/latest.json")
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}

MAX_LEVELS = 4
MAX_TARGET = 0.15  # un objetivo a más de un 15 % no es "las próximas horas"


def get(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def klines(interval: str, limit: int) -> list[list]:
    """[hora UTC, apertura, máximo, mínimo, cierre, volumen en BTC], redondeado para gastar menos tokens."""
    rows = get(f"{SPOT}/klines?symbol=BTCUSDT&interval={interval}&limit={limit}")
    fmt = "%Y-%m-%d" if interval == "1d" else "%Y-%m-%d %H:%M"
    return [[datetime.fromtimestamp(r[0] / 1000, timezone.utc).strftime(fmt), *(round(float(x)) for x in r[1:6])] for r in rows]


def market() -> dict:
    """Datos en bruto, sin indicadores ni niveles: el análisis lo hace el modelo."""
    data: dict = {
        "candles_1d": klines("1d", 180),
        "candles_4h": klines("4h", 120),
        "candles_1h": klines("1h", 72),
    }
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
    try:
        metrics = {m["id"]: m["value"] for c in get(LATEST_URL)["categories"].values() for m in c["metrics"]}
        if metrics.get("etf_flows") is not None:
            data["spot_etf_net_flows_20_sessions_btc"] = round(metrics["etf_flows"])
    except Exception as e:
        log.warning("latest.json no disponible: %s", e)
    return data


# ---------- Modelo ----------

PROMPT = """Eres un analista técnico de Bitcoin. Recibes en JSON datos de mercado en bruto de BTC/USDT: velas diarias, de \
4 h y de 1 h ([hora UTC, apertura, máximo, mínimo, cierre, volumen en BTC], de la más antigua a la más reciente), \
funding de los perpetuos, open interest, porcentaje de cuentas en largo, ratio de compras/ventas a mercado, Fear & \
Greed y flujos de los ETF al contado. La última vela de cada serie está en curso: su cierre es el precio actual.

Haz tu propio análisis (estructura de mercado, tendencia, máximos y mínimos relevantes, volumen, medias, impulso, \
posicionamiento en derivados, sentimiento) y devuelve:
- supports y resistances: de 2 a 4 zonas inmediatas de cada lado del precio actual, como rangos de precio [low, high] \
de anchura realista, de la más cercana a la más lejana, con strength de 1 (débil) a 3 (fuerte). Soportes por debajo \
del precio actual y resistencias por encima.
- bias: el sesgo de corto plazo, "alcista", "bajista" o "neutral", y confidence de 1 (baja) a 3 (alta).
- outlook: lo más probable en las próximas horas (horizon_hours entre 4 y 24): direction ("alcista", "bajista" o \
"lateral"), target (precio al que es más probable que vaya) e invalidation (precio que, si se alcanza, invalidaría ese \
escenario, al otro lado del precio actual).
- alternative: el escenario alternativo menos probable, con su direction y su target.
- es y en: el mismo análisis en español de España y en inglés. headline: una frase de 12 palabras como máximo. summary: \
la situación de BTC hoy en 2 o 3 frases (70 palabras como máximo). outlook: lo más probable en las próximas horas y qué \
lo invalidaría, en 1 o 2 frases. technical y sentiment: 2 a 4 puntos breves cada uno (25 palabras como máximo) con las \
cifras que los justifican.

Reglas: básate solo en los datos recibidos; precios en dólares redondeados (78.500 $ en español, $78,500 en inglés). \
Habla en términos de probabilidad y escenarios, nunca de certezas, y no des recomendaciones de compra o venta."""

ZONE = {"type": "OBJECT", "properties": {"low": {"type": "NUMBER"}, "high": {"type": "NUMBER"}, "strength": {"type": "INTEGER"}},
        "required": ["low", "high", "strength"]}
DIRECTION = {"type": "STRING", "enum": ["alcista", "bajista", "lateral"]}
TEXT = {
    "type": "OBJECT",
    "properties": {
        "headline": {"type": "STRING"},
        "summary": {"type": "STRING"},
        "outlook": {"type": "STRING"},
        "technical": {"type": "ARRAY", "items": {"type": "STRING"}},
        "sentiment": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["headline", "summary", "outlook", "technical", "sentiment"],
}
SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "supports": {"type": "ARRAY", "items": ZONE},
        "resistances": {"type": "ARRAY", "items": ZONE},
        "bias": {"type": "STRING", "enum": ["alcista", "bajista", "neutral"]},
        "confidence": {"type": "INTEGER"},
        "outlook": {
            "type": "OBJECT",
            "properties": {"direction": DIRECTION, "target": {"type": "NUMBER"}, "invalidation": {"type": "NUMBER"},
                           "horizon_hours": {"type": "INTEGER"}},
            "required": ["direction", "target", "invalidation", "horizon_hours"],
        },
        "alternative": {"type": "OBJECT", "properties": {"direction": DIRECTION, "target": {"type": "NUMBER"}},
                        "required": ["direction", "target"]},
        "es": TEXT,
        "en": TEXT,
    },
    "required": ["supports", "resistances", "bias", "confidence", "outlook", "alternative", "es", "en"],
    "propertyOrdering": ["supports", "resistances", "bias", "confidence", "outlook", "alternative", "es", "en"],
}


def gemini(user: str) -> tuple[dict, str]:
    """Respuesta JSON del primer modelo de MODELS que conteste. Reintenta saturación (429/503) y errores del servidor."""
    body = json.dumps({
        "systemInstruction": {"parts": [{"text": PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"responseMimeType": "application/json", "responseSchema": SCHEMA, "temperature": 0.4},
    }).encode()
    last: Exception | None = None
    for model in MODELS:
        req = urllib.request.Request(GEMINI.format(model=model.strip()), data=body, method="POST", headers={
            "Content-Type": "application/json", "X-goog-api-key": os.environ["GEMINI_API_KEY"]})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=180) as res:
                    data = json.loads(res.read())
                cand = data["candidates"][0]
                if cand.get("finishReason") != "STOP":
                    raise RuntimeError(f"respuesta incompleta: finishReason={cand.get('finishReason')}")
                usage = data.get("usageMetadata", {})
                log.info("%s (%s): %s tokens de entrada, %s de salida, %s de razonamiento", model, data.get("modelVersion"),
                         usage.get("promptTokenCount"), usage.get("candidatesTokenCount"), usage.get("thoughtsTokenCount"))
                text = "".join(p.get("text", "") for p in cand["content"]["parts"] if not p.get("thought"))
                return json.loads(text), data.get("modelVersion") or model
            except urllib.error.HTTPError as e:
                try:
                    msg = json.loads(e.read())["error"]["message"]
                except Exception:
                    msg = ""
                last = RuntimeError(f"{model}: HTTP {e.code} {msg[:120]}")
                if e.code not in (429, 500, 502, 503, 504):
                    break  # modelo inexistente o petición inválida: se pasa al siguiente
            except (urllib.error.URLError, TimeoutError, RuntimeError, KeyError, json.JSONDecodeError) as e:
                last = RuntimeError(f"{model}: {e}")
            log.warning("%s", last)
            time.sleep(5 * 2**attempt)
    raise RuntimeError(f"ningún modelo respondió: {last}")


def validate(a: dict, price: float) -> dict:
    """Ordena y filtra las zonas, corrige lo que se puede y lanza ValueError si el análisis no se sostiene."""
    def zones(raw: list[dict], kind: str) -> list[dict]:
        out = []
        for z in raw:
            lo, hi = sorted((float(z["low"]), float(z["high"])))
            mid = (lo + hi) / 2
            near = abs(mid / price - 1) <= 0.25
            side = mid < price * 1.005 if kind == "support" else mid > price * 0.995
            if near and side and hi - lo < price * 0.06:
                out.append({"kind": kind, "low": round(lo), "high": round(hi), "mid": round(mid),
                            "strength": max(1, min(3, int(z["strength"])))})
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
        out = {"direction": m["direction"] if m["direction"] == d or d == "lateral" else d, "target": round(target)}
        if "invalidation" in m:
            inv = float(m["invalidation"])
            other_side = (inv - price) * (target - price) < 0
            out["invalidation"] = round(inv) if other_side and abs(inv / price - 1) <= MAX_TARGET else None
            out["horizon_hours"] = max(1, min(48, int(m.get("horizon_hours", 24))))
        return out

    result = {
        "bias": a["bias"],
        "confidence": max(1, min(3, int(a["confidence"]))),
        "levels": sup + res,
        "outlook": move(a["outlook"]),
        "alternative": move(a["alternative"]),
    }
    for lang in ("es", "en"):
        t = a[lang]
        if not all(t[k].strip() for k in ("headline", "summary", "outlook")):
            raise ValueError(f"texto vacío ({lang})")
        result[lang] = {k: t[k].strip() for k in ("headline", "summary", "outlook")} | {
            k: [x.strip() for x in t[k] if x.strip()][:4] for k in ("technical", "sentiment")}
    return result


def dry_run(data: dict, price: float) -> dict:
    """Sin modelo: mínimos y máximos recientes como zonas, para probar la salida y la web."""
    c4 = data["candles_4h"]
    lows = sorted({c[3] for c in c4 if c[3] < price}, reverse=True)
    highs = sorted({c[2] for c in c4 if c[2] > price})
    pick = lambda xs: [xs[min(i * 8, len(xs) - 1)] for i in range(3)]
    sup = [{"low": p - 300, "high": p + 300, "strength": 2} for p in pick(lows)]
    res = [{"low": p - 300, "high": p + 300, "strength": 2} for p in pick(highs)]
    text = {"headline": "Análisis de prueba (sin modelo)", "summary": "Generado con --dry-run.", "outlook": "Sin modelo.",
            "technical": ["Sin modelo"], "sentiment": ["Sin modelo"]}
    return {"supports": sup, "resistances": res, "bias": "neutral", "confidence": 1,
            "outlook": {"direction": "bajista", "target": sup[0]["low"], "invalidation": res[0]["high"], "horizon_hours": 12},
            "alternative": {"direction": "alcista", "target": res[0]["high"]}, "es": text, "en": text}


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="no llama al modelo: niveles por reglas simples")
    args = ap.parse_args()

    data = market()
    price = float(data["candles_1h"][-1][4])
    if args.dry_run:
        raw, model = dry_run(data, price), "dry-run"
    else:
        raw, model = gemini(json.dumps(data, separators=(",", ":")))
    result = validate(raw, price)

    out = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "model": model, "price": round(price), **result}
    write_json(OUT_DIR / "analysis.json", out)
    if not args.dry_run:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(STATE_DIR / "analysis_log.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({k: out[k] for k in ("generated_at", "model", "price", "levels", "bias", "confidence", "outlook", "alternative")}) + "\n")
    log.info("analysis.json: %s, %s hacia %s (%s)", result["bias"], result["outlook"]["direction"], result["outlook"]["target"], model)


if __name__ == "__main__":
    main()
