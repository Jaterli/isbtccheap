"""Mide cuánto aciertan los análisis publicados (state/analysis_log.jsonl) con las velas de 1 h de Binance.

Cada escenario se juzga en su plazo (el de las próximas horas en sus horizon_hours; el de 1-2 días, en 48 h):
  acierta       el precio toca el objetivo antes que la invalidación
  falla         toca antes la invalidación
  dudoso        toca los dos en la misma vela de 1 h (no se sabe cuál fue antes)
  sin resolver  no toca ninguno en el plazo (en un lateral, que no toque la invalidación cuenta como acierto)
  pendiente     el plazo aún no ha terminado
Un lateral con rango (análisis en sombra v2) acierta si ningún cierre de 1 h sale del rango en el plazo y falla si sale;
su azar es empírico: la parte de los plazos iguales del histórico (desde RANGE_HISTORY_DAYS antes) en que el precio se
quedó entre esas mismas distancias.
El alternativo solo se juzga por si toca su objetivo en el plazo de las próximas horas.

Junto a cada acierto da la referencia del azar: el que tendría un precio que se moviera al azar con esas mismas
distancias al objetivo y a la invalidación (con la invalidación más lejos que el objetivo, acertar es más fácil).
También agrupa el acierto por la base del objetivo (zona de reacción, liquidez, imbalance, pivote, Fibonacci o ATR).
Además compara la distancia a objetivos e invalidaciones con lo que de verdad se movió el precio (calibración) y
cuenta los cambios de dirección entre análisis seguidos con el precio casi igual. No llama a ningún modelo ni modifica
el registro.

Zonas: cada soporte o resistencia, la primera vez que aparece (las que se repiten en análisis seguidos cuentan una vez),
por su fuerza, su posición (S1/R1, S2/R2, S3/R3) y su ancho:
  no alcanzada  el precio no la toca en ZONE_REACH_HOURS
  aguanta       tras tocarla, rebota ZONE_BOUNCE desde su borde antes de que un cierre de 1 h la atraviese, en
                ZONE_HOLD_HOURS
  rota          un cierre de 1 h la atraviesa antes
  sin resolver  ni una cosa ni la otra en el plazo
  pendiente     el plazo aún no ha terminado
con su azar: la misma zona (la misma distancia al precio, el mismo ancho y el mismo tipo) colocada en puntos de los
ZONE_CHANCE_DAYS días antes y después del análisis (el mismo tipo de mercado; solo los ya resueltos). Si las zonas
elegidas no aguantan más que esas, no aportan.

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
# Histórico para el azar de los laterales con rango, y cada cuántas velas se toma un punto de partida
RANGE_HISTORY_DAYS = 60
RANGE_STEP = 3
# Azar de las zonas: días antes y después de cada análisis (centrado: con solo los anteriores, en un cambio de tendencia
# se comparaba con otro mercado)
ZONE_CHANCE_DAYS = 30
# Zonas: plazo para llegar a ellas, plazo para resolverse desde el primer toque y rebote que cuenta como «aguanta»
ZONE_REACH_HOURS = 72
ZONE_HOLD_HOURS = 48
ZONE_BOUNCE = 0.015


def candles(since_ms: int) -> list[tuple[int, float, float, float]]:
    """(apertura, máximo, mínimo, cierre) de las velas de 1 h desde `since_ms`, paginando de 1000 en 1000."""
    out: list[tuple[int, float, float, float]] = []
    start = since_ms
    while True:
        req = urllib.request.Request(KLINES.format(start=start), headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            rows = json.loads(r.read())
        out += [(row[0], float(row[2]), float(row[3]), float(row[4])) for row in rows]
        if len(rows) < 1000:
            return out
        start = rows[-1][0] + 1


def judge(bars, start: int, hours: float, price: float, direction: str, target: float, inval: float | None,
          rng: list[float] | None = None) -> str:
    end = start + hours * HOUR
    for t, high, low, close in bars:
        if t + HOUR <= start:
            continue
        if t >= end:
            break
        if rng:  # lateral con rango: falla con un cierre fuera
            if not rng[0] <= close <= rng[1]:
                return "falla"
            continue
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


def range_chance(bars, start: int, price: float, rng: list[float], hours: float) -> float | None:
    """Azar de un lateral con rango: en qué parte de los plazos iguales anteriores al análisis el precio se quedó (en
    cierres de 1 h) entre las mismas distancias a su precio de partida."""
    lo, hi, n = rng[0] / price, rng[1] / price, int(hours)
    first = start - RANGE_HISTORY_DAYS * 24 * HOUR
    idx = [i for i, b in enumerate(bars) if first <= b[0] and b[0] + n * HOUR <= start]
    if not idx:
        return None
    closes = [b[3] for b in bars]
    starts = idx[::RANGE_STEP]
    inside = sum(all(lo <= c / closes[i] <= hi for c in closes[i + 1:i + 1 + n]) for i in starts)
    return inside / len(starts)


def judge_move(bars, r: dict, o: dict, hours: float) -> tuple[str, float | None]:
    """El resultado de un escenario y su referencia del azar."""
    t, p = when(r), r["price"]
    if rng := o.get("range"):
        return judge(bars, t, hours, p, "lateral", o["target"], None, rng), range_chance(bars, t, p, rng, hours)
    return (judge(bars, t, hours, p, o["direction"], o["target"], o.get("invalidation")),
            chance(p, o["direction"], o["target"], o.get("invalidation")))


def flips(rows: list[dict], horizon: str = "outlook") -> tuple[int, int]:
    """Cambios de dirección entre análisis seguidos con el precio casi igual, y cuántos pares así hay."""
    close = [(a, b) for a, b in zip(rows, rows[1:])
             if when(b) - when(a) < FLIP_HOURS * HOUR and abs(b["price"] / a["price"] - 1) < FLIP_PRICE]
    return sum(a[horizon]["direction"] != b[horizon]["direction"] for a, b in close), len(close)


def judge_zone(bars, start: int, z: dict) -> str:
    """Qué hizo el precio con una zona desde el análisis (ver el docstring del módulo)."""
    first = next((i for i, b in enumerate(bars) if b[0] + HOUR > start), None)
    if first is None:
        return "pendiente"
    return zone_from(bars, first, start, z["kind"] == "support", z["low"], z["high"])


def zone_chance(bars, start: int, price: float, z: dict) -> Counter:
    """Azar de una zona: la misma, a la misma distancia relativa del precio, en puntos de los ZONE_CHANCE_DAYS días antes
    y después del análisis (cada RANGE_STEP * 2 velas, con su plazo ya terminado), juzgada igual."""
    out: Counter = Counter()
    sup, lo, hi = z["kind"] == "support", z["low"] / price, z["high"] / price
    first = start - ZONE_CHANCE_DAYS * 24 * HOUR
    end = min(start + ZONE_CHANCE_DAYS * 24 * HOUR, bars[-1][0] - (ZONE_REACH_HOURS + ZONE_HOLD_HOURS) * HOUR)
    for i in range(0, len(bars), RANGE_STEP * 2):
        t = bars[i][0]
        if t < first:
            continue
        if t > end:
            break
        p = bars[i][3]
        out[zone_from(bars, i + 1, t + HOUR, sup, lo * p, hi * p)] += 1
    return out


def zone_from(bars, first: int, start: int, sup: bool, lo: float, hi: float) -> str:
    """judge_zone desde la vela `first` (la primera tras el análisis)."""
    reach_end, touched = start + ZONE_REACH_HOURS * HOUR, None
    for i in range(first, len(bars)):
        t, high, low, _ = bars[i]
        if t >= reach_end:
            break
        if (low <= hi) if sup else (high >= lo):
            touched = i
            break
    if touched is None:
        return "pendiente" if reach_end > bars[-1][0] + HOUR else "no alcanzada"
    end = bars[touched][0] + ZONE_HOLD_HOURS * HOUR
    for t, high, low, close in bars[touched:]:
        if t >= end:
            return "sin resolver"
        if close < lo if sup else close > hi:
            return "rota"
        # El rebote, desde el borde de la zona y sin contar la vela del toque (en ella no se sabe qué fue antes)
        if t > bars[touched][0] and (high >= hi * (1 + ZONE_BOUNCE) if sup else low <= lo * (1 - ZONE_BOUNCE)):
            return "aguanta"
    return "pendiente"


def zone_summary(c: Counter, base: Counter | None = None) -> str:
    done = c["aguanta"] + c["rota"]
    held = f"aguanta {c['aguanta'] / done:.0%} de las resueltas" if done else "sin resueltas"
    if base and (bd := base["aguanta"] + base["rota"]):
        held += f", azar {base['aguanta'] / bd:.0%}"
    rest = ", ".join(f"{k} {c[k]}" for k in ("aguanta", "rota", "sin resolver", "no alcanzada", "pendiente") if c[k])
    return f"{sum(c.values()):3} zonas: {held} ({rest})"


def zones_report(rows: list[dict], bars) -> None:
    by: dict[str, dict[str, Counter]] = {"Por fuerza": defaultdict(Counter), "Por posición": defaultdict(Counter),
                                         "Por ancho": defaultdict(Counter), "Por tipo": defaultdict(Counter)}
    base: dict[str, dict[str, Counter]] = {k: defaultdict(Counter) for k in by}
    total, total_base = Counter(), Counter()
    seen = set()
    for r in rows:
        for z in r.get("levels", []):
            key = (z["kind"], z["low"], z["high"])
            if key in seen:
                continue
            seen.add(key)
            res = judge_zone(bars, when(r), z)
            chance_z = zone_chance(bars, when(r), r["price"], z)
            width = (z["high"] - z["low"]) / ((z["high"] + z["low"]) / 2) * 100
            groups = {"Por fuerza": f"fuerza {z['strength']}", "Por posición": z["id"][1:] if "id" in z else "?",
                      "Por ancho": "1: < 2 %" if width < 2 else "2: 2-3 %" if width < 3 else "3: ≥ 3 %",
                      "Por tipo": "soporte" if z["kind"] == "support" else "resistencia"}
            for title, name in groups.items():
                by[title][name][res] += 1
                base[title][name].update(chance_z)
            total[res] += 1
            total_base.update(chance_z)
    if not seen:
        return
    print(f"\nZonas (cada una la primera vez que aparece; toque en {ZONE_REACH_HOURS} h, rebote del {ZONE_BOUNCE:.1%}"
          f" antes de que un cierre de 1 h la atraviese, en {ZONE_HOLD_HOURS} h; azar: la misma zona en los"
          f" {ZONE_CHANCE_DAYS} días antes y después):")
    print(f"  {'todas':16} {zone_summary(total, total_base)}")
    for title, groups in by.items():
        print(f"  {title}:")
        for name, c in sorted(groups.items()):
            # El prefijo de los anchos solo sirve para ordenarlos
            label = f"S{name}/R{name}" if title == "Por posición" else name.split(": ")[-1]
            print(f"    {label:14} {zone_summary(c, base[title][name])}")


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
    # Con histórico antes del primero: el azar de los laterales con rango se mide en los plazos anteriores
    bars = candles(min(when(p) for p, _ in pairs) - RANGE_HISTORY_DAYS * 24 * HOUR - HOUR)
    variants = Counter(s.get("variant", "v1: otra configuración, mismas reglas") for _, s in pairs)
    print(f"{len(pairs)} pares (publicado y sombra con los mismos datos), del {pairs[0][0]['generated_at'][:10]} al "
          f"{pairs[-1][0]['generated_at'][:10]}")
    print("Variantes de la sombra: " + "; ".join(f"{v} ({n})" for v, n in variants.items()) + "\n")
    for variant in variants:
        sub = [(p, s) for p, s in pairs if s.get("variant", "v1: otra configuración, mismas reglas") == variant]
        print(f"== {variant}: {len(sub)} pares")
        for label, horizon in (("Próximas horas", "outlook"), ("1-2 días", "outlook_days")):
            print(f"{label}:")
            for side in (0, 1):
                c, names, dirs = Counter(), Counter(), Counter()
                for pair in sub:
                    r = pair[side]
                    o = r[horizon]
                    hours = (o.get("horizon_hours") or 24) if horizon == "outlook" else DAYS_HOURS
                    count(c, *judge_move(bars, r, o, hours))
                    names[r["model"]] += 1
                    dirs[o["direction"]] += 1
                print(f"  {'publicado' if side == 0 else 'sombra':10} {', '.join(names):34} {summary(c)}")
                print(f"  {'':10} direcciones: " + ", ".join(f"{d} {n}" for d, n in dirs.most_common()))
                # Los laterales aparte: su acierto frente a su azar
                lat = Counter()
                for pair in sub:
                    r, o = pair[side], pair[side][horizon]
                    if o.get("range"):
                        count(lat, *judge_move(bars, r, o, (o.get("horizon_hours") or 24) if horizon == "outlook" else DAYS_HOURS))
                if lat:
                    print(f"  {'':10} solo los laterales con rango: {summary(lat)}")
            same = sum(p[horizon]["direction"] == s[horizon]["direction"] for p, s in sub)
            print(f"  misma dirección en {same} de {len(sub)}")
            for side in (0, 1):
                f, n = flips([pair[side] for pair in sub], horizon)
                print(f"  cambios de dirección entre análisis seguidos ({'publicado' if side == 0 else 'sombra'}): {f} de {n}")
            print()
        changes = [s["notes"]["direction_change"] for _, s in sub if (s.get("notes") or {}).get("direction_change")]
        if changes:
            print(f"Motivos de los cambios de dirección de la sombra ({len(changes)}):")
            for x in changes[-5:]:
                print(f"  - {x}")
            print()


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
    bars = candles(when(rows[0]) - RANGE_HISTORY_DAYS * 24 * HOUR - HOUR)
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
        res, base = judge_move(bars, r, o, hours)
        count(total["Próximas horas"], res, base)
        count(by_model[r["model"]], res, base)
        count(by_week[datetime.fromisoformat(r["generated_at"]).strftime("%G-S%V")], res, base)
        if b := o.get("target_basis"):  # de qué nivel sale el objetivo (desde el 10 nov 2026)
            count(by_basis[f"{b['kind']} {b['timeframe']}" + (" (sin nivel cerca)" if b.get("found") is False else "")], res, base)
        if d:
            count(total["1-2 días"], *judge_move(bars, r, d, DAYS_HOURS))
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

    flipped, pairs = flips(rows)
    print(f"\nCambios de dirección entre análisis seguidos (< {FLIP_HOURS} h y precio a < {FLIP_PRICE:.1%}): {flipped} de {pairs}")
    zones_report(rows, bars)


if __name__ == "__main__":
    main()
