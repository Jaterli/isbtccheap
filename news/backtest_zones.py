"""Backtest de las zonas de soporte y resistencia sin el modelo: cada día (a las 11:00 UTC, como el análisis) se calculan
las zonas candidatas (build_analysis.reaction_zones y zone_candidates) solo con las velas hasta ese momento, y se juzgan
con las reglas de eval_analysis: si el precio las toca en 72 h, si aguantan (rebote del 1,5 % antes de que un cierre de
1 h las atraviese, en 48 h) o se rompen. Su azar: la misma zona (misma distancia al precio, mismo ancho y tipo) en
ZONE_TRIALS momentos al azar de los 30 días antes y después. Una zona solo aporta si aguanta más que su azar.

En el registro (eval_analysis, 74 análisis hasta el 27 nov 2026) las zonas elegidas aguantaban un 40 % frente a un 45 %
de azar, y S1/R1 un 44 % frente a un 44 %: ninguna ventaja. Aquí se prueban variantes del cálculo con años de datos:
  - ancho de las zonas: el actual (0,5 ATR, tope 2,5 %), el anterior (1 ATR) y más estrecho (0,25 ATR)
  - filtros: reacciones mínimas, sin cruces desde la última reacción, reacción reciente
  - otra fuente: liquidez pendiente (build_analysis.liquidity_pools). Los números redondos no se pueden medir así: cada
    zona cuenta una vez, y los mismos niveles (60.000 $, 65.000 $…) solo contaban la primera vez en todo el periodo
Cada zona cuenta una vez (la primera vez que aparece) y solo las dos más cercanas de cada lado (S1, S2, R1, R2), como
en la web. Resúmenes: todo el periodo, por posición y con el precio por encima o por debajo de su media de 200 días.

Resultado (27 nov 2026, 1422 días desde enero de 2023): ninguna variante supera a su azar; todas quedan entre −3 y +1
puntos (la actual, 35 % frente a 37 %; S1/R1, −1,4 y +0,1). Las zonas no anticipan mejor que un nivel cualquiera a la
misma distancia dónde va a rebotar el precio: sirven de referencia de dónde ha girado, no de predicción.

Criterio para cambiar el cálculo: que una variante supere a su azar con claridad (unos 5 puntos o más) en todo el
periodo y en los dos tipos de mercado, sin empeorar el número de zonas alcanzadas.

Solo librería estándar (y build_analysis / eval_analysis, que también lo son salvo los modelos, que no se usan). Las
velas se guardan en news/state/zones_cache/ para no descargarlas otra vez.
Uso: python3 news/backtest_zones.py [--since AAAA-MM-DD] [--variants nombre,nombre...]
"""

import argparse
import bisect
import json
import random
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import build_analysis as ba
import eval_analysis as ev

CACHE = Path(__file__).resolve().parent / "state" / "zones_cache"
KLINES = "https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval={tf}&limit=1000&startTime={start}"
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}
HOUR = 3_600_000
DAY = 24 * HOUR
SINCE = "2023-01-01"
AT_HOUR = 11  # hora UTC del cálculo, la del análisis diario
PER_SIDE = 2  # las que se muestran: S1, S2, R1, R2
ZONE_TRIALS = 30  # momentos al azar por zona para su azar
CHANCE_DAYS = 30
SMA_DAYS = 200
POINT_WIDTH = 0.003  # ancho de una zona hecha de un nivel puntual (liquidez pendiente): ±0,15 %


def klines(tf: str, since_ms: int) -> list[list]:
    """Velas de Binance desde `since_ms`, con caché por temporalidad (solo se descargan las que faltan)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{tf}.json"
    rows = json.loads(path.read_text()) if path.exists() else []
    if rows and rows[0][0] > since_ms:
        rows = []  # la caché empieza después: se descarga entera
    start = rows[-2][0] if len(rows) >= 2 else since_ms  # la última puede estar sin cerrar: se repite
    rows = [r for r in rows if r[0] < start]
    while True:
        req = urllib.request.Request(KLINES.format(tf=tf, start=start), headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            batch = json.loads(r.read())
        rows += batch
        if len(batch) < 1000:
            break
        start = batch[-1][0] + 1
    path.write_text(json.dumps(rows))
    return rows


# ---------- Zonas de cada variante ----------

def candidates(d1: list[list], h4: list[list], price: float, atr: float, width_atr: float, width_max: float) -> list[dict]:
    """Las zonas candidatas de build_analysis con el ancho de la variante (por encima y por debajo del precio)."""
    ba.REACTION_WIDTH_ATR, ba.REACTION_WIDTH_MAX = width_atr, width_max
    data = {"reaction_zones": {"1d": ba.reaction_zones(d1, "1d"), "4h": ba.reaction_zones(h4, "4h")}}
    return [c for c in ba.zone_candidates(data, price, atr) if c["side"] != "at_price"]


def stats(c: dict) -> dict:
    """Las reacciones de la zona: las de 4 h si es afinada o de 4 h, si no las diarias."""
    return c.get("4h") or c.get("1d") or {}


def point_zones(levels: list[tuple[str, float]], price: float) -> list[dict]:
    """Niveles puntuales como zonas estrechas."""
    return [{"low": p * (1 - POINT_WIDTH / 2), "high": p * (1 + POINT_WIDTH / 2), "side": side} for side, p in levels]


def nearest(zones: list[dict], price: float) -> list[dict]:
    """Las PER_SIDE más cercanas de cada lado, con su posición (1, 2) y su tipo."""
    out = []
    for side, kind in (("above", "resistance"), ("below", "support")):
        same = sorted((z for z in zones if z["side"] == side), key=lambda z: abs((z["low"] + z["high"]) / 2 - price))
        out += [{**z, "kind": kind, "pos": i + 1} for i, z in enumerate(same[:PER_SIDE])]
    return out


def variants() -> dict:
    """nombre: función (d1, h4, price, atr, day_ms) -> zonas candidatas."""
    now = lambda w, m: (lambda d1, h4, p, a, t: candidates(d1, h4, p, a, w, m))
    recent = lambda days: (lambda d1, h4, p, a, t: [c for c in candidates(d1, h4, p, a, 0.5, 0.025)
                                                     if datetime.fromisoformat(stats(c).get("last", "1970-01-01")).timestamp() * 1000 >= t - days * DAY])

    def pools(d1, h4, p, a, t):
        lv = [(x["side"], x["price"]) for tf, raw in (("1d", d1), ("4h", h4)) for x in ba.liquidity_pools(raw, tf)]
        return point_zones(lv, p)

    return {
        "actual (0,5 ATR, tope 2,5 %)": now(0.5, 0.025),
        "anterior (1 ATR, sin tope)": now(1.0, 9.0),
        "estrecha (0,25 ATR)": now(0.25, 0.025),
        "actual, 3+ reacciones": lambda d1, h4, p, a, t: [c for c in now(0.5, 0.025)(d1, h4, p, a, t) if stats(c).get("reactions", 0) >= 3],
        "actual, sin cruces desde la última": lambda d1, h4, p, a, t: [c for c in now(0.5, 0.025)(d1, h4, p, a, t)
                                                                       if stats(c).get("crossings_since_last", 9) == 0],
        "actual, reacción en 90 días": recent(90),
        "liquidez pendiente (1d y 4h)": pools,
    }


# ---------- Juicio ----------

def judge(bars, times, t0: int, z: dict) -> str:
    i = bisect.bisect_left(times, t0)
    return ev.zone_from(bars, i, t0, z["kind"] == "support", z["low"], z["high"])


def chance(bars, times, closes, t0: int, price: float, z: dict, rng: random.Random) -> Counter:
    """La misma zona en ZONE_TRIALS momentos al azar de los CHANCE_DAYS días antes y después (con su plazo terminado)."""
    lo, hi = bisect.bisect_left(times, t0 - CHANCE_DAYS * DAY), bisect.bisect_left(times, t0 + CHANCE_DAYS * DAY)
    hi = min(hi, len(times) - (ev.ZONE_REACH_HOURS + ev.ZONE_HOLD_HOURS) - 1)
    out: Counter = Counter()
    if hi <= lo:
        return out
    a, b = z["low"] / price, z["high"] / price
    for _ in range(ZONE_TRIALS):
        i = rng.randrange(lo, hi)
        p = closes[i]
        out[ev.zone_from(bars, i + 1, times[i] + HOUR, z["kind"] == "support", a * p, b * p)] += 1
    return out


def held(c: Counter) -> float | None:
    done = c["aguanta"] + c["rota"]
    return c["aguanta"] / done if done else None


def line(name: str, c: Counter, base: Counter) -> str:
    h, hb = held(c), held(base)
    reached = sum(c.values()) - c["no alcanzada"]
    edge = f"{(h - hb) * 100:+5.1f}" if h is not None and hb is not None else "   — "
    pct = lambda x: "  —" if x is None else f"{x:4.0%}"
    return (f"  {name:38} {sum(c.values()):5} zonas, alcanzadas {reached / max(1, sum(c.values())):4.0%} | aguanta {pct(h)}"
            f" | azar {pct(hb)} | ventaja {edge} puntos")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default=SINCE, help="primer día del backtest (AAAA-MM-DD)")
    ap.add_argument("--variants", help="solo estas variantes (por el principio de su nombre, separadas por comas)")
    args = ap.parse_args()
    t_since = int(datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc).timestamp() * 1000)

    print("Descargando velas (con caché)…", file=sys.stderr)
    d1 = klines("1d", t_since - (ba.REACTION_CANDLES["1d"] + 20) * DAY)
    n4 = ba.CANDLES_FOR_INDICATORS.get("4h", ba.DEFAULT_FOR_INDICATORS)
    h4 = klines("4h", t_since - (n4 + 10) * 4 * HOUR)
    h1 = klines("1h", t_since - (CHANCE_DAYS + 2) * DAY)
    bars = [(r[0], float(r[2]), float(r[3]), float(r[4])) for r in h1]
    times, closes = [b[0] for b in bars], [b[3] for b in bars]
    t1d, t4h = [r[0] for r in d1], [r[0] for r in h4]
    d1_close = [float(r[4]) for r in d1]

    chosen = variants()
    if args.variants:
        keys = [k.strip() for k in args.variants.split(",")]
        chosen = {n: f for n, f in chosen.items() if any(n.startswith(k) for k in keys)}
    # El último día con plazo completo para juzgar
    last = times[-1] - (ev.ZONE_REACH_HOURS + ev.ZONE_HOLD_HOURS) * HOUR
    days = []
    t = t_since + AT_HOUR * HOUR
    while t <= last:
        days.append(t)
        t += DAY
    print(f"{len(days)} días del {args.since} al {datetime.fromtimestamp(days[-1] / 1000, timezone.utc):%Y-%m-%d}"
          f" (zonas calculadas a las {AT_HOUR}:00 UTC con las velas hasta entonces; S1, S2, R1 y R2)\n")

    for name, fn in chosen.items():
        rng = random.Random(1)  # el mismo azar en cada variante
        res: dict[str, Counter] = defaultdict(Counter)
        base: dict[str, Counter] = defaultdict(Counter)
        seen = set()
        for t0 in days:
            # Solo velas cerradas antes del momento del cálculo (abiertas como tarde una vela antes)
            e1, e4 = bisect.bisect_right(t1d, t0 - DAY), bisect.bisect_right(t4h, t0 - 4 * HOUR)
            raw1d, raw4h = d1[max(0, e1 - ba.REACTION_CANDLES["1d"]):e1], h4[max(0, e4 - n4):e4]
            i_now = bisect.bisect_left(times, t0) - 1
            if i_now < 0 or len(raw1d) < 60 or len(raw4h) < 60:
                continue
            price = closes[i_now]
            atr = ba.indicators(raw1d[-400:])["atr14"]
            k = e1 - 1
            sma = sum(d1_close[max(0, k - SMA_DAYS + 1):k + 1]) / min(SMA_DAYS, k + 1)
            regime = "precio sobre la media de 200 días" if price > sma else "precio bajo la media de 200 días"
            for z in nearest(fn(raw1d, raw4h, price, atr, t0), price):
                key = (z["kind"], round(z["low"]), round(z["high"]))
                if key in seen:
                    continue
                seen.add(key)
                r, b = judge(bars, times, t0, z), chance(bars, times, closes, t0, price, z, rng)
                for g in ("todas", f"{'S' if z['kind'] == 'support' else 'R'}{z['pos']}", regime,
                          "soportes" if z["kind"] == "support" else "resistencias"):
                    res[g][r] += 1
                    base[g].update(b)
        print(f"== {name}")
        for g in ("todas", "S1", "R1", "S2", "R2", "soportes", "resistencias",
                  "precio sobre la media de 200 días", "precio bajo la media de 200 días"):
            if res[g]:
                print(line(g, res[g], base[g]))
        print()


if __name__ == "__main__":
    main()
