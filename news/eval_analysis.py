"""Mide cuánto aciertan los análisis publicados (state/analysis_log.jsonl) con las velas de 1 h de Binance.

Cada escenario se juzga en su plazo (el de las próximas horas en sus horizon_hours; el de 1-2 días, en 48 h):
  acierta       el precio toca el objetivo antes que la invalidación
  falla         toca antes la invalidación
  dudoso        toca los dos en la misma vela de 1 h (no se sabe cuál fue antes)
  sin resolver  no toca ninguno en el plazo (en un lateral, que no toque la invalidación cuenta como acierto)
  pendiente     el plazo aún no ha terminado
El alternativo solo se juzga por si toca su objetivo en el plazo de las próximas horas.

Junto a cada acierto da la referencia del azar: el que tendría un precio que se moviera al azar con esas mismas
distancias al objetivo y a la invalidación (con la invalidación más lejos que el objetivo, acertar es más fácil).
También agrupa el acierto por la base del objetivo (zona de reacción, liquidez, imbalance, pivote, Fibonacci o ATR).
Además compara la distancia a objetivos e invalidaciones con lo que de verdad se movió el precio (calibración) y
cuenta los cambios de dirección entre análisis seguidos con el precio casi igual. No llama a ningún modelo ni modifica
el registro.

Con --shadow compara el análisis publicado con el análisis en sombra de la misma ejecución (state/analysis_shadow_log.jsonl:
otra configuración con los mismos datos, que no se publica), solo en los pares que tienen los dos.

Uso: python eval_analysis.py [--log RUTA] [--since AAAA-MM-DD] [--shadow]
"""

import argparse
import json
import statistics
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone

from build_news import STATE_DIR

KLINES = "https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1000&startTime={start}"
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}
HOUR = 3_600_000
DAYS_HOURS = 48  # plazo del escenario de 1-2 días
# Dos análisis seguidos "con el precio casi igual": separados menos de esto y con el precio a menos de un 0,5 %
FLIP_HOURS = 8
FLIP_PRICE = 0.005


def candles(since_ms: int) -> list[tuple[int, float, float]]:
    """(apertura, máximo, mínimo) de las velas de 1 h desde `since_ms`, paginando de 1000 en 1000."""
    out: list[tuple[int, float, float]] = []
    start = since_ms
    while True:
        req = urllib.request.Request(KLINES.format(start=start), headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            rows = json.loads(r.read())
        out += [(row[0], float(row[2]), float(row[3])) for row in rows]
        if len(rows) < 1000:
            return out
        start = rows[-1][0] + 1


def judge(bars, start: int, hours: float, price: float, direction: str, target: float, inval: float | None) -> str:
    end = start + hours * HOUR
    for t, high, low in bars:
        if t + HOUR <= start:
            continue
        if t >= end:
            break
        if direction == "lateral":
            if inval is not None and ((inval < price and low <= inval) or (inval > price and high >= inval)):
                return "falla"
            continue
        up = direction == "alcista"
        hit_target = high >= target if up else low <= target
        hit_inval = inval is not None and (low <= inval if up else high >= inval)
        if hit_target and hit_inval:
            return "dudoso"
        if hit_target:
            return "acierta"
        if hit_inval:
            return "falla"
    if end > bars[-1][0] + HOUR:
        return "pendiente"
    return "acierta" if direction == "lateral" else "sin resolver"


def excursion(bars, start: int, hours: float, price: float) -> tuple[float, float] | None:
    """Subida y bajada máximas (en % del precio) dentro del plazo, si ya ha terminado."""
    end = start + hours * HOUR
    if end > bars[-1][0] + HOUR:
        return None
    win = [b for b in bars if b[0] + HOUR > start and b[0] < end]
    return (max(b[1] for b in win) / price - 1) * 100, (min(b[2] for b in win) / price - 1) * 100


def chance(price: float, direction: str, target: float, inval: float | None) -> float | None:
    """Probabilidad de tocar antes el objetivo que la invalidación si el precio se moviera al azar (paseo aleatorio sin
    tendencia): distancia a la invalidación / (distancia al objetivo + distancia a la invalidación). Un objetivo cerca
    y una invalidación lejos aciertan a menudo sin saber nada; el acierto solo aporta si supera esta referencia."""
    if direction == "lateral" or not inval:
        return None
    up, down = abs(target - price), abs(inval - price)
    return down / (up + down) if up + down else None


def count(c: Counter, res: str, base: float | None) -> None:
    """Suma el resultado y, si está resuelto, la referencia del azar de ese escenario."""
    c[res] += 1
    if res in ("acierta", "falla") and base is not None:
        c["_azar"] += base
        c["_azar_n"] += 1


def total_of(c: Counter) -> int:
    return sum(c[k] for k in ("acierta", "falla", "sin resolver", "dudoso", "pendiente"))


def summary(c: Counter) -> str:
    resolved = c["acierta"] + c["falla"]
    rate = f"{c['acierta'] / resolved * 100:.0f} % de acierto ({c['acierta']}/{resolved} resueltos)" if resolved else "sin resueltos"
    if c["_azar_n"]:
        rate += f", azar {c['_azar'] / c['_azar_n'] * 100:.0f} %"
    rest = ", ".join(f"{k} {c[k]}" for k in ("sin resolver", "dudoso", "pendiente") if c[k])
    return rate + (f"; {rest}" if rest else "")


def when(r: dict) -> int:
    return int(datetime.fromisoformat(r["generated_at"]).timestamp() * 1000)


def compare_shadow(main_log: str, since: str | None) -> None:
    """El publicado frente a la sombra de la misma ejecución: acierto de cada uno y en cuántas coinciden las direcciones."""
    load = lambda path: [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]
    published = {r["generated_at"]: r for r in load(main_log) if "outlook" in r}
    pairs = [(published[s["published_at"]], s) for s in load(str(STATE_DIR / "analysis_shadow_log.jsonl"))
             if s.get("published_at") in published and (not since or s["published_at"] >= since)]
    if not pairs:
        sys.exit("No hay análisis en sombra con su publicado que comparar.")
    bars = candles(min(when(p) for p, _ in pairs) - HOUR)
    print(f"{len(pairs)} pares (publicado y sombra con los mismos datos), del {pairs[0][0]['generated_at'][:10]} al "
          f"{pairs[-1][0]['generated_at'][:10]}\n")
    for label, horizon in (("Próximas horas", "outlook"), ("1-2 días", "outlook_days")):
        print(f"{label}:")
        for side in (0, 1):
            c, names = Counter(), Counter()
            for pair in pairs:
                r = pair[side]
                o = r[horizon]
                hours = (o.get("horizon_hours") or 24) if horizon == "outlook" else DAYS_HOURS
                count(c, judge(bars, when(r), hours, r["price"], o["direction"], o["target"], o.get("invalidation")),
                      chance(r["price"], o["direction"], o["target"], o.get("invalidation")))
                names[r["model"]] += 1
            print(f"  {'publicado' if side == 0 else 'sombra':10} {', '.join(names):34} {summary(c)}")
        same = sum(p[horizon]["direction"] == s[horizon]["direction"] for p, s in pairs)
        print(f"  misma dirección en {same} de {len(pairs)}\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--log", default=str(STATE_DIR / "analysis_log.jsonl"), help="registro de análisis")
    ap.add_argument("--since", help="solo los análisis desde esta fecha (AAAA-MM-DD)")
    ap.add_argument("--shadow", action="store_true", help="compara el publicado con el análisis en sombra")
    args = ap.parse_args()
    if args.shadow:
        return compare_shadow(args.log, args.since)

    rows = [json.loads(line) for line in open(args.log, encoding="utf-8") if line.strip()]
    rows = [r for r in rows if not args.since or r["generated_at"] >= args.since]
    old = sum(1 for r in rows if "outlook" not in r)
    rows = [r for r in rows if "outlook" in r]
    if not rows:
        sys.exit("No hay análisis que evaluar.")
    bars = candles(when(rows[0]) - HOUR)
    print(f"{len(rows)} análisis del {rows[0]['generated_at'][:10]} al {rows[-1]['generated_at'][:10]}"
          + (f" ({old} de una versión antigua, sin escenarios, no se cuentan)" if old else "")
          + f"; velas hasta {datetime.fromtimestamp(bars[-1][0] / 1000, timezone.utc):%Y-%m-%d %H:%M} UTC\n")

    total = {"Próximas horas": Counter(), "1-2 días": Counter(), "Alternativo (toca su objetivo)": Counter()}
    by_model: dict[str, Counter] = defaultdict(Counter)
    by_week: dict[str, Counter] = defaultdict(Counter)
    by_basis: dict[str, Counter] = defaultdict(Counter)
    calib: dict[str, list[float]] = defaultdict(list)
    for r in rows:
        t, p, o, d, alt = when(r), r["price"], r["outlook"], r.get("outlook_days"), r["alternative"]
        hours = o.get("horizon_hours") or 24
        res = judge(bars, t, hours, p, o["direction"], o["target"], o.get("invalidation"))
        base = chance(p, o["direction"], o["target"], o.get("invalidation"))
        count(total["Próximas horas"], res, base)
        count(by_model[r["model"]], res, base)
        count(by_week[datetime.fromisoformat(r["generated_at"]).strftime("%G-S%V")], res, base)
        if b := o.get("target_basis"):  # de qué nivel sale el objetivo (desde el 10 nov 2026)
            count(by_basis[f"{b['kind']} {b['timeframe']}" + (" (sin nivel cerca)" if b.get("found") is False else "")], res, base)
        if d:
            count(total["1-2 días"], judge(bars, t, DAYS_HOURS, p, d["direction"], d["target"], d.get("invalidation")),
                  chance(p, d["direction"], d["target"], d.get("invalidation")))
        total["Alternativo (toca su objetivo)"][judge(bars, t, hours, p, alt["direction"], alt["target"], None)] += 1
        if (ex := excursion(bars, t, hours, p)) and o["direction"] != "lateral":
            calib["objetivo"].append(abs(o["target"] / p - 1) * 100)
            if o.get("invalidation"):
                calib["invalidación"].append(abs(o["invalidation"] / p - 1) * 100)
            calib["movimiento real (mayor de subida o bajada)"].append(max(ex[0], -ex[1]))

    print("Acierto por escenario (azar: el que tendría el precio moviéndose al azar con esos objetivos e invalidaciones;"
          " el análisis solo aporta si lo supera):")
    for name, c in total.items():
        print(f"  {name:32} {summary(c)}")
    print("\nPróximas horas, por modelo:")
    for model, c in sorted(by_model.items(), key=lambda kv: -total_of(kv[1])):
        print(f"  {model:32} {summary(c)}")
    print("\nPróximas horas, por semana:")
    for week, c in sorted(by_week.items()):
        print(f"  {week:32} {summary(c)}")

    if by_basis:
        print("\nPróximas horas, por la base del objetivo:")
        for basis, c in sorted(by_basis.items(), key=lambda kv: -total_of(kv[1])):
            print(f"  {basis:32} {summary(c)}")

    if calib["objetivo"]:
        print("\nCalibración de las próximas horas (mediana, en % del precio, de los plazos ya terminados):")
        for k, v in calib.items():
            print(f"  {k:44} {statistics.median(v):.2f} %  ({len(v)} análisis)")
        ratio = statistics.median(calib["objetivo"]) / max(statistics.median(calib["movimiento real (mayor de subida o bajada)"]), 1e-9)
        print(f"  → los objetivos están a {ratio:.1f} veces lo que se movió el precio" + (" (demasiado lejos)" if ratio > 1.5 else ""))

    flips = sum(1 for a, b in zip(rows, rows[1:])
                if when(b) - when(a) < FLIP_HOURS * HOUR and abs(b["price"] / a["price"] - 1) < FLIP_PRICE
                and a["outlook"]["direction"] != b["outlook"]["direction"])
    pairs = sum(1 for a, b in zip(rows, rows[1:]) if when(b) - when(a) < FLIP_HOURS * HOUR and abs(b["price"] / a["price"] - 1) < FLIP_PRICE)
    print(f"\nCambios de dirección entre análisis seguidos (< {FLIP_HOURS} h y precio a < {FLIP_PRICE:.1%}): {flips} de {pairs}")


if __name__ == "__main__":
    main()
