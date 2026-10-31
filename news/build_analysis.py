"""Genera analysis.json: soportes y resistencias inmediatos de BTC, sesgo del mercado y escenarios probables.

Cada ejecución (cron dos veces al día en el droplet):
  1. Descarga velas diarias y de 4 h de Binance, los derivados (funding, open interest, ratios long/short y de compras a
     mercado), el Fear & Greed de Alternative.me y el latest.json del índice (flujos de los ETF, SOPR, score diario).
  2. Calcula los niveles con reglas fijas: máximos y mínimos de giro, zonas de mucho volumen, medias de 50 y 200 y
     números redondos, agrupados en zonas. El modelo nunca inventa precios: elige entre estas zonas por su id.
  3. Pide al modelo el sesgo, las zonas clave y un escenario alcista y otro bajista, con un texto breve en español e
     inglés, y comprueba que la respuesta sea coherente con los niveles antes de publicarla.
Si algo falla se mantiene el analysis.json anterior. Cada análisis publicado se añade a state/analysis_log.jsonl para
poder medir después cuánto acierta.

Variables de entorno (ver .env.example): DO_MODEL_ACCESS_KEY, ANALYSIS_MODEL (opcional), NEWS_OUT_DIR, NEWS_STATE_DIR.
Uso: python build_analysis.py [--dry-run]   (--dry-run no llama al modelo: sesgo por reglas y texto de prueba)
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

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_news import OUT_DIR, STATE_DIR, chat, write_json  # noqa: E402

log = logging.getLogger("analysis")

# Modelo abierto, como el de las noticias; se puede cambiar sin tocar el código (p. ej. glm-5.3 o kimi-k2.6)
MODEL = os.environ.get("ANALYSIS_MODEL", "glm-5.3-flash")
SPOT = "https://data-api.binance.vision/api/v3"
FUTURES = "https://fapi.binance.com"
LATEST_URL = os.environ.get("ANALYSIS_LATEST_URL", "https://raw.githubusercontent.com/Jaterli/isbtccheap/main/web/public/data/latest.json")
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}

LEVELS_PER_SIDE = 4
MAX_DISTANCE = 0.2  # zonas a más de un 20 % del precio no son "inmediatas"
# Peso de cada tipo de nivel al agrupar: los giros diarios y las zonas de volumen pesan más
WEIGHTS = {"swing_1d": 3, "swing_4h": 2, "volume": 2, "ma50_1d": 2, "ma200_1d": 3, "ma200_4h": 1, "round": 1}


def get(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def klines(interval: str, limit: int) -> list[dict]:
    rows = get(f"{SPOT}/klines?symbol=BTCUSDT&interval={interval}&limit={limit}")
    return [{"t": r[0], "o": float(r[1]), "h": float(r[2]), "l": float(r[3]), "c": float(r[4]), "v": float(r[5])} for r in rows]


# ---------- Indicadores ----------

def sma(xs: list[float], n: int) -> float | None:
    return sum(xs[-n:]) / n if len(xs) >= n else None


def rsi(xs: list[float], n: int = 14) -> float | None:
    if len(xs) <= n:
        return None
    gain = loss = 0.0
    for i in range(1, len(xs)):
        d = xs[i] - xs[i - 1]
        g, l = max(d, 0), max(-d, 0)
        if i <= n:
            gain += g / n
            loss += l / n
        else:
            gain = (gain * (n - 1) + g) / n
            loss = (loss * (n - 1) + l) / n
    return 100.0 if loss == 0 else 100 - 100 / (1 + gain / loss)


def pct_b(xs: list[float], n: int = 20, k: float = 2) -> float | None:
    if len(xs) < n:
        return None
    w = xs[-n:]
    m = sum(w) / n
    sd = math.sqrt(sum((x - m) ** 2 for x in w) / n)
    return 50.0 if sd == 0 else (xs[-1] - (m - k * sd)) / (2 * k * sd) * 100


def atr(c: list[dict], n: int = 14) -> float:
    trs = [max(c[i]["h"] - c[i]["l"], abs(c[i]["h"] - c[i - 1]["c"]), abs(c[i]["l"] - c[i - 1]["c"])) for i in range(1, len(c))]
    return sum(trs[-n:]) / n


def pct(a: float | None, b: float | None) -> float | None:
    return None if a is None or not b else round((a / b - 1) * 100, 2)


def technical(c: list[dict], label: str) -> dict:
    closes = [x["c"] for x in c]
    price = closes[-1]
    per_day = 6 if label == "4h" else 1
    return {
        "rsi_14": round(rsi(closes), 1),
        "bollinger_pct_b": round(pct_b(closes), 1),
        "dist_sma20_pct": pct(price, sma(closes, 20)),
        "dist_sma50_pct": pct(price, sma(closes, 50)),
        "dist_sma200_pct": pct(price, sma(closes, 200)),
        "atr_14_pct": round(atr(c) / price * 100, 2),
        "change_1d_pct": pct(price, closes[-1 - per_day]),
        "change_7d_pct": pct(price, closes[-1 - 7 * per_day]),
        "change_30d_pct": pct(price, closes[-1 - 30 * per_day]) if len(closes) > 30 * per_day else None,
        "high_20": round(max(x["h"] for x in c[-20:])),
        "low_20": round(min(x["l"] for x in c[-20:])),
    }


# ---------- Niveles ----------

def swings(c: list[dict], w: int) -> list[float]:
    """Máximos y mínimos de giro: la vela más alta (o más baja) de las w de cada lado."""
    out = []
    for i in range(w, len(c) - w):
        win = c[i - w : i + w + 1]
        if c[i]["h"] == max(x["h"] for x in win):
            out.append(c[i]["h"])
        if c[i]["l"] == min(x["l"] for x in win):
            out.append(c[i]["l"])
    return out


def volume_nodes(c: list[dict], step: float, top: int = 5) -> list[float]:
    """Precios con más volumen negociado: el volumen de cada vela se reparte por igual en su rango."""
    lo = min(x["l"] for x in c)
    bins = [0.0] * (int((max(x["h"] for x in c) - lo) / step) + 1)
    for x in c:
        a, b = int((x["l"] - lo) / step), int((x["h"] - lo) / step)
        for k in range(a, b + 1):
            bins[k] += x["v"] / (b - a + 1)
    peaks = [k for k in range(1, len(bins) - 1) if bins[k] >= bins[k - 1] and bins[k] >= bins[k + 1]]
    peaks.sort(key=lambda k: bins[k], reverse=True)
    return [lo + (k + 0.5) * step for k in peaks[:top]]


def levels(d1: list[dict], h4: list[dict]) -> tuple[list[dict], float]:
    price = h4[-1]["c"]
    a = atr(d1)
    cands = [(p, "swing_1d") for p in swings(d1[-180:], 5)]
    cands += [(p, "swing_4h") for p in swings(h4[-360:], 6)]
    cands += [(p, "volume") for p in volume_nodes(h4[-180:], a * 0.25)]
    closes_d, closes_h = [x["c"] for x in d1], [x["c"] for x in h4]
    for src, v in (("ma50_1d", sma(closes_d, 50)), ("ma200_1d", sma(closes_d, 200)), ("ma200_4h", sma(closes_h, 200))):
        if v:
            cands.append((v, src))
    step = 5000
    cands += [(k * step, "round") for k in range(int(price * (1 - MAX_DISTANCE) / step), int(price * (1 + MAX_DISTANCE) / step) + 2)]
    cands = sorted((p, s) for p, s in cands if abs(p / price - 1) <= MAX_DISTANCE)

    # Se agrupan los precios cercanos, en zonas de 0,7 ATR diarios como máximo (si no, se encadenan sin fin)
    zones: list[list[tuple[float, str]]] = []
    for p, s in cands:
        if zones and p - zones[-1][0][0] < a * 0.7:
            zones[-1].append((p, s))
        else:
            zones.append([(p, s)])
    out = []
    for z in zones:
        ps = [p for p, _ in z]
        strength = sum(WEIGHTS[s] for _, s in z)
        if strength < 3:  # un número redondo o un giro de 4 h sueltos no bastan
            continue
        mid = sum(ps) / len(ps)
        half = max((max(ps) - min(ps)) / 2, a * 0.1)
        out.append({"low": round(mid - half), "high": round(mid + half), "mid": round(mid), "strength": strength,
                    "sources": sorted({s for _, s in z})})

    sup = sorted((z for z in out if z["mid"] < price), key=lambda z: -z["mid"])[:LEVELS_PER_SIDE]
    res = sorted((z for z in out if z["mid"] >= price), key=lambda z: z["mid"])[:LEVELS_PER_SIDE]
    for i, z in enumerate(sup):
        z.update(id=f"S{i + 1}", kind="support")
    for i, z in enumerate(res):
        z.update(id=f"R{i + 1}", kind="resistance")
    return sup + res, a


# ---------- Sentimiento ----------

def sentiment() -> dict:
    out: dict = {}
    try:
        fr = get(f"{FUTURES}/fapi/v1/premiumIndex?symbol=BTCUSDT")
        out["funding_rate_8h_pct"] = round(float(fr["lastFundingRate"]) * 100, 4)
        oi = get(f"{FUTURES}/futures/data/openInterestHist?symbol=BTCUSDT&period=4h&limit=180")
        ois = [float(x["sumOpenInterest"]) for x in oi]
        out["open_interest_btc"] = round(ois[-1])
        out["open_interest_change_1d_pct"] = pct(ois[-1], ois[-7])
        out["open_interest_change_7d_pct"] = pct(ois[-1], ois[-43])
        ls = get(f"{FUTURES}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=4h&limit=6")
        r = float(ls[-1]["longShortRatio"])
        out["accounts_long_pct"] = round(r / (1 + r) * 100, 1)
        tk = get(f"{FUTURES}/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=4h&limit=6")
        rs = [float(x["buySellRatio"]) for x in tk]
        out["taker_buy_pct_24h"] = round(sum(x / (1 + x) for x in rs) / len(rs) * 100, 1)
    except Exception as e:  # sin derivados el análisis sigue, con menos datos
        log.warning("derivados no disponibles: %s", e)
    try:
        fg = get("https://api.alternative.me/fng/?limit=8")["data"]
        out["fear_greed"] = int(fg[0]["value"])
        out["fear_greed_7d_ago"] = int(fg[7]["value"])
    except Exception as e:
        log.warning("Fear & Greed no disponible: %s", e)
    return out


def index_context() -> dict:
    """Score diario y métricas diarias del índice (ETF, SOPR…): del latest.json que publica el pipeline."""
    try:
        latest = get(LATEST_URL)
    except Exception as e:
        log.warning("latest.json no disponible: %s", e)
        return {}
    metrics = {m["id"]: m["value"] for cat in latest["categories"].values() for m in cat["metrics"]}
    return {
        "index_score_1d": latest.get("score_1d"),
        "category_scores": {k: v["score"] for k, v in latest["categories"].items()},
        "etf_flows_20_sessions_btc": metrics.get("etf_flows"),
        "sth_sopr_7d": metrics.get("sth_sopr"),
        "as_of": latest.get("as_of"),
    }


# ---------- Modelo ----------

PROMPT = """Eres un analista de mercado que escribe para una web que estima si Bitcoin está caro o barato. Con los datos \
que recibes en JSON (técnico en velas diarias y de 4 h, sentimiento y derivados, contexto del índice y una lista de \
zonas de soporte S1… y de resistencia R1… ya calculadas, de la más cercana a la más lejana) decides:

- bias: el sesgo de corto plazo (próximos días): "alcista", "bajista" o "neutral". confidence: 1 (débil) a 3 (fuerte).
- key_supports y key_resistances: los ids de las 1 o 2 zonas más relevantes de cada lado. Solo ids de la lista.
- bull: el escenario alcista. trigger es la resistencia cuya ruptura lo activaría y target la resistencia siguiente a \
la que podría ir (más lejana que trigger). bear: igual con soportes (target más lejano que trigger).
- primary: el escenario más probable ("bull" o "bear"), coherente con bias; con bias neutral, el que veas algo más \
probable.
- es y en: el mismo análisis en español de España y en inglés. headline: una frase de 12 palabras como máximo. \
summary: 2 o 3 frases (60 palabras como máximo). technical y sentiment: 2 a 4 puntos breves cada uno (25 palabras como \
máximo), citando las cifras que los justifican.

Reglas: usa solo los datos recibidos; no inventes precios, menciona niveles por su precio redondeado (p. ej. 78.500 $ \
en español y $78,500 en inglés). Habla en condicional y de escenarios, nunca de certezas, y no des recomendaciones de \
compra o venta."""

TEXT = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "summary": {"type": "string"},
        "technical": {"type": "array", "items": {"type": "string"}},
        "sentiment": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["headline", "summary", "technical", "sentiment"],
    "additionalProperties": False,
}
SCENARIO = {
    "type": "object",
    "properties": {"trigger": {"type": "string"}, "target": {"type": "string"}},
    "required": ["trigger", "target"],
    "additionalProperties": False,
}
SCHEMA = {
    "type": "object",
    "properties": {
        "bias": {"type": "string", "enum": ["alcista", "bajista", "neutral"]},
        "confidence": {"type": "integer"},
        "key_supports": {"type": "array", "items": {"type": "string"}},
        "key_resistances": {"type": "array", "items": {"type": "string"}},
        "bull": SCENARIO,
        "bear": SCENARIO,
        "primary": {"type": "string", "enum": ["bull", "bear"]},
        "es": TEXT,
        "en": TEXT,
    },
    "required": ["bias", "confidence", "key_supports", "key_resistances", "bull", "bear", "primary", "es", "en"],
    "additionalProperties": False,
}


def validate(a: dict, lv: list[dict]) -> dict:
    """Corrige lo que se puede (ids desconocidos, primary incoherente) y lanza ValueError si el análisis no se sostiene."""
    sup = [z["id"] for z in lv if z["kind"] == "support"]
    res = [z["id"] for z in lv if z["kind"] == "resistance"]

    def scenario(s: dict, side: list[str]) -> dict:
        if s["trigger"] not in side:
            raise ValueError(f"nivel desconocido: {s}")
        i = side.index(s["trigger"])
        j = side.index(s["target"]) if s["target"] in side else i + 1
        if j <= i:  # el objetivo ha de estar más lejos que el disparador
            j = i + 1
        return {"trigger": s["trigger"], "target": side[j] if j < len(side) else None}

    out = {
        "bias": a["bias"],
        "confidence": max(1, min(3, int(a["confidence"]))),
        "key_supports": [x for x in a["key_supports"] if x in sup][:2] or sup[:1],
        "key_resistances": [x for x in a["key_resistances"] if x in res][:2] or res[:1],
        "bull": scenario(a["bull"], res),
        "bear": scenario(a["bear"], sup),
        "primary": {"alcista": "bull", "bajista": "bear"}.get(a["bias"], a["primary"]),
    }
    for lang in ("es", "en"):
        t = a[lang]
        if not t["headline"].strip() or not t["summary"].strip():
            raise ValueError(f"texto vacío ({lang})")
        out[lang] = {"headline": t["headline"].strip(), "summary": t["summary"].strip(),
                     "technical": [x.strip() for x in t["technical"] if x.strip()][:4],
                     "sentiment": [x.strip() for x in t["sentiment"] if x.strip()][:4]}
    return out


def dry_run(data: dict, lv: list[dict]) -> dict:
    """Sin modelo: sesgo por el RSI diario y la media de 50, para probar la salida y la web."""
    t = data["technical"]["1d"]
    up = (t["rsi_14"] or 50) > 50 and (t["dist_sma50_pct"] or 0) > 0
    down = (t["rsi_14"] or 50) < 45 and (t["dist_sma50_pct"] or 0) < 0
    sup = [z["id"] for z in lv if z["kind"] == "support"]
    res = [z["id"] for z in lv if z["kind"] == "resistance"]
    text = {"headline": "Análisis de prueba (sin modelo)", "summary": "Generado con --dry-run: el sesgo sale de reglas fijas.",
            "technical": [f"RSI diario {t['rsi_14']}"], "sentiment": ["Sin modelo"]}
    return {"bias": "alcista" if up else "bajista" if down else "neutral", "confidence": 1,
            "key_supports": sup[:1], "key_resistances": res[:1],
            "bull": {"trigger": res[0], "target": res[1]}, "bear": {"trigger": sup[0], "target": sup[1]},
            "primary": "bull" if up else "bear", "es": text, "en": {**text, "headline": "Test analysis (no model)"}}


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="no llama al modelo: sesgo por reglas y texto de prueba")
    args = ap.parse_args()

    d1, h4 = klines("1d", 400), klines("4h", 500)
    price = h4[-1]["c"]
    lv, a = levels(d1, h4)
    if len([z for z in lv if z["kind"] == "support"]) < 2 or len([z for z in lv if z["kind"] == "resistance"]) < 2:
        raise SystemExit("no hay niveles suficientes a cada lado del precio")
    data = {
        "price": round(price),
        "time_utc": datetime.fromtimestamp(h4[-1]["t"] / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "technical": {"1d": technical(d1, "1d"), "4h": technical(h4, "4h")},
        "sentiment": sentiment(),
        "index": index_context(),
        "zones": [{k: z[k] for k in ("id", "low", "high", "strength", "sources")} for z in lv],
    }
    raw = dry_run(data, lv) if args.dry_run else chat(PROMPT, json.dumps(data, ensure_ascii=False), SCHEMA, "analisis", model=MODEL)
    result = validate(raw, lv)

    now = datetime.now(timezone.utc)
    out = {
        "generated_at": now.isoformat(timespec="seconds"),
        "model": "dry-run" if args.dry_run else MODEL,
        "price": round(price),
        "atr_1d": round(a),
        "levels": lv,
        **result,
        "inputs": {"technical": data["technical"], "sentiment": data["sentiment"], "index": data["index"]},
    }
    write_json(OUT_DIR / "analysis.json", out)
    if not args.dry_run:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(STATE_DIR / "analysis_log.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({k: out[k] for k in ("generated_at", "model", "price", "levels", "bias", "confidence", "bull", "bear", "primary")}) + "\n")
    log.info("analysis.json: %s (%s), %d niveles", result["bias"], result["primary"], len(lv))


if __name__ == "__main__":
    main()
