"""¿Se pueden anticipar las cascadas de liquidaciones de largos? (como la del 27 nov 2026: −3,8 % en 30 minutos a la
apertura de Wall Street, con unos 40 M$ de largos liquidados y el 70 % de las cuentas en largo)

Cascada: una vela de 4 h que cae CASCADE_DROP o más desde su apertura hasta su mínimo, con liquidaciones de largos de al
menos LIQ_SPIKE veces su media de los 30 días anteriores y el doble que las de cortos (Coinalyze, la suma de los mismos
perpetuos que build_liquidations.py). Para comparar, también el caso contrario (estrujón de cortos).

Lo que se sabía al abrir cada vela (velas anteriores), en su percentil frente a los 30 días anteriores:
  - cuentas en largo (Coinalyze, perpetuo de Binance)
  - variación del interés abierto en 24 h
  - financiación pagada antes de la vela (Binance)
  - volatilidad de las últimas 24 h frente a la de 30 días (comprimida o no)
  - distancia al mínimo de 7 días (cerca: hay stops justo debajo)
  - compras a mercado del contado de Binance en la vela anterior
  - prima de Coinbase frente a Binance en la vela anterior (negativa: venden más en EE. UU.)
y la hora (la vela de las 12:00 UTC contiene la apertura de Wall Street) y si es fin de semana.
Para cada una, con su valor en el 20 % más alto o más bajo: qué parte de las velas trae una cascada, frente a todas.
Después, combinaciones como alerta: qué parte de las cascadas avisa (cobertura) y qué parte de sus avisos acaba en una
(precisión). Hay pocos meses de datos intradía en Coinalyze (unos 8 de liquidaciones en 4 h): los resultados son una
primera pista, no una regla.

Además:
  - qué hizo el precio tras cada aviso (desde la primera vela de cada racha de avisos): si hubo cascada en los días
    siguientes y cuánto tardó, si antes subió (lo contrario de lo esperado) o se quedó en rango, y cómo acabó, frente a
    los mismos plazos desde cualquier vela
  - el aviso con un umbral absoluto de cuentas en largo (65 % y 70 %), que no se acostumbra a una racha larga de largos
    (el 27 nov 2026 el 70 % era poco frente a un mes entero así, y el aviso relativo no saltó)
  - la liquidez: festivos y medios días de la bolsa de EE. UU., fines de semana y velas de poco volumen, solos y con el
    aviso ya encendido (¿esperan los grandes a un día de poco volumen para provocar la cascada?)

Solo librería estándar. Clave de Coinalyze (COINALYZE_API_KEY) en news/.env, vía news/run.sh.
Uso: news/run.sh backtest_cascades.py
"""

import json
import math
import os
import statistics
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from build_liquidations import SYMBOLS

UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}
COINALYZE = "https://api.coinalyze.net/v1/{ep}"
SPOT = "https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval={tf}&limit=1000&startTime={start}"
COINBASE = "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=3600&start={start}&end={end}"
FUNDING = "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1000&startTime={start}"
H4 = 4 * 3600
CASCADE_DROP = 0.03
LIQ_SPIKE = 3
WINDOW = 180  # velas de 4 h: 30 días
EXTREME = 0.20
US_OPEN_BAR = 12  # la vela de 4 h de las 12:00 a las 16:00 UTC (Wall Street abre a las 13:30 o 14:30)
# Festivos y medios días de la bolsa de Nueva York (NYSE) en el periodo con datos
US_HOLIDAYS = {"2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03",
               "2026-09-07", "2026-11-26", "2026-12-25", "2025-12-25", "2025-12-31"}
US_HALF_DAYS = {"2026-11-27", "2026-12-24", "2025-12-24", "2025-12-26"}
ABS_LONGS = (65, 70)  # umbrales absolutos de cuentas en largo
FOLLOW_BARS = 42  # tras un aviso, los 7 días siguientes
RANGE_MOVE = 0.03  # «se queda en rango»: ni sube ni baja un 3 % en esos días antes de la cascada


def get(url: str):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def coinalyze(ep: str, symbols: list[str], **extra) -> list:
    q = urllib.parse.urlencode({"symbols": ",".join(symbols), "interval": "4hour", "from": 0, "to": int(time.time()),
                                "api_key": os.environ["COINALYZE_API_KEY"], **extra})
    out = get(f"{COINALYZE.format(ep=ep)}?{q}")
    time.sleep(1.5)  # límite de la API gratuita
    return out


def paged(url: str, start_ms: int, key) -> list:
    out = []
    while True:
        rows = get(url.format(start=start_ms, tf="4h"))
        out += rows
        if len(rows) < 1000:
            return out
        start_ms = key(rows[-1]) + 1


def coinbase_hourly(start: int, end: int) -> dict[int, float]:
    """Cierre horario de Coinbase (BTC-USD), de 300 en 300 velas."""
    out, t = {}, start
    while t < end:
        e = min(end, t + 300 * 3600)
        iso = lambda s: datetime.fromtimestamp(s, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        for r in get(COINBASE.format(start=iso(t), end=iso(e))):
            out[r[0]] = r[4]
        t = e
        time.sleep(0.2)
    return out


def load():
    liq = coinalyze("liquidation-history", SYMBOLS, convert_to_usd="true")
    longs, shorts = {}, {}
    for s in liq:
        for h in s["history"]:
            longs[h["t"]] = longs.get(h["t"], 0) + h["l"]
            shorts[h["t"]] = shorts.get(h["t"], 0) + h["s"]
    oi = {h["t"]: h["c"] for h in coinalyze("open-interest-history", ["BTCUSDT_PERP.A"], convert_to_usd="false")[0]["history"]}
    ls = {h["t"]: h["l"] for h in coinalyze("long-short-ratio-history", ["BTCUSDT_PERP.A"])[0]["history"]}
    first = min(min(longs), min(oi), min(ls)) - WINDOW * H4
    k = paged(SPOT, first * 1000, lambda r: r[0])
    bars = {r[0] // 1000: {"o": float(r[1]), "h": float(r[2]), "l": float(r[3]), "c": float(r[4]), "v": float(r[5]),
                           "buy": float(r[9]) / float(r[5]) if float(r[5]) else None} for r in k}
    now = int(time.time())
    bars = {t: b for t, b in bars.items() if t + H4 <= now}  # solo velas cerradas
    fund = sorted((x["fundingTime"] // 1000, float(x["fundingRate"])) for x in paged(FUNDING, first * 1000, lambda r: r["fundingTime"]))
    cb = coinbase_hourly(min(longs) - WINDOW * H4, now)
    return bars, longs, shorts, oi, ls, fund, cb


def pct_rank(values: list[float], v: float) -> float:
    return sum(x < v for x in values) / len(values)


def follow_up(sel, ts, idx, bars, ev, rules) -> None:
    """Qué hizo el precio en los FOLLOW_BARS siguientes a la primera vela de cada racha de avisos, frente a cualquier
    vela: cascada en esos días y cuánto tardó, si antes subió o se quedó en rango, y cómo acabó."""
    evs = set(ev)
    in_sel = set(sel)

    def path(t: int) -> dict | None:
        i = idx[t]
        if i + FOLLOW_BARS >= len(ts):
            return None
        o = bars[t]["o"]
        nxt = [ts[j] for j in range(i, i + FOLLOW_BARS)]
        first = next((k for k, x in enumerate(nxt) if x in evs), None)
        before = nxt[:first] if first is not None else nxt
        up = max((bars[x]["h"] for x in before), default=o) / o - 1
        down = min((bars[x]["l"] for x in before), default=o) / o - 1
        return {"cascade": first, "up_before": up, "down_before": down, "end": bars[nxt[-1]]["c"] / o - 1}

    def summary(name: str, starts: list[int]) -> None:
        ps = [p for p in map(path, starts) if p]
        if not ps:
            return
        cas = [p for p in ps if p["cascade"] is not None]
        first_up = [p for p in cas if p["up_before"] >= RANGE_MOVE]
        flat = [p for p in cas if p["up_before"] < RANGE_MOVE and p["down_before"] > -RANGE_MOVE]
        hours = sorted(p["cascade"] * 4 for p in cas)
        med = f"{hours[len(hours) // 2]} h" if hours else "—"
        ends = sorted(p["end"] for p in ps)
        print(f"    {name:40} {len(ps):4} | cascada en 7 días: {len(cas) / len(ps):4.0%} (mediana a las {med});"
              f" de ellas, subió antes un {RANGE_MOVE:.0%}: {len(first_up)}, en rango antes: {len(flat)} |"
              f" a 7 días: mediana {ends[len(ends) // 2]:+.1%}, sube {sum(e > 0 for e in ends) / len(ends):.0%}")

    print(f"  Después del aviso (desde la primera vela de cada racha; los {FOLLOW_BARS // 6} días siguientes):")
    summary("cualquier vela (referencia)", [t for t in sel][::6])
    for name, rule in rules.items():
        starts = [t for t in sel if rule(t) and not (idx[t] > 0 and ts[idx[t] - 1] in in_sel and rule(ts[idx[t] - 1]))]
        summary(name.strip() + " (rachas)", starts)


def main() -> None:
    bars, longs, shorts, oi, ls, fund, cb = load()
    ts = sorted(bars)
    idx = {t: i for i, t in enumerate(ts)}
    # Prima de Coinbase de cada vela de 4 h: su último cierre horario frente al de Binance
    prem = {t: cb[t + H4 - 3600] / bars[t]["c"] - 1 for t in ts if t + H4 - 3600 in cb}
    raw: dict[str, dict[int, float]] = {k: {} for k in (
        "cuentas en largo", "interés abierto (24 h)", "financiación", "volatilidad 24 h / 30 d", "distancia al mínimo de 7 días",
        "compras a mercado (vela anterior)", "prima de Coinbase (vela anterior)", "volumen (vela anterior)")}
    for t in ts:
        i = idx[t]
        if i < WINDOW + 1:
            continue
        p = ts[i - 1]
        if p in ls:
            raw["cuentas en largo"][t] = ls[p]
        if p in oi and ts[i - 7] in oi and oi[ts[i - 7]]:
            raw["interés abierto (24 h)"][t] = oi[p] / oi[ts[i - 7]] - 1
        paid = [r for ft, r in fund if ft <= t]
        if paid:
            raw["financiación"][t] = paid[-1]
        rets = [math.log(bars[ts[j]]["c"] / bars[ts[j - 1]]["c"]) for j in range(i - WINDOW, i)]
        if statistics.pstdev(rets):
            raw["volatilidad 24 h / 30 d"][t] = statistics.pstdev(rets[-6:]) / statistics.pstdev(rets)
        raw["distancia al mínimo de 7 días"][t] = bars[p]["c"] / min(bars[ts[j]]["l"] for j in range(i - 42, i)) - 1
        if bars[p]["buy"] is not None:
            raw["compras a mercado (vela anterior)"][t] = bars[p]["buy"]
        if p in prem:
            raw["prima de Coinbase (vela anterior)"][t] = prem[p]
        raw["volumen (vela anterior)"][t] = bars[p]["v"]
    # Percentil de cada valor frente a las WINDOW velas anteriores
    pct: dict[str, dict[int, float]] = {}
    for name, series in raw.items():
        pct[name] = {}
        for t, v in series.items():
            past = [series[ts[j]] for j in range(idx[t] - WINDOW, idx[t]) if ts[j] in series]
            if len(past) >= WINDOW * 0.8:
                pct[name][t] = pct_rank(past, v)

    def event(t: int, side: int) -> bool:
        """side 1: cascada de largos; -1: estrujón de cortos."""
        i = idx[t]
        own, other = (longs, shorts) if side == 1 else (shorts, longs)
        past = [own.get(ts[j], 0) for j in range(i - WINDOW, i)]
        mean = sum(past) / len(past) if past else 0
        b = bars[t]
        move = b["l"] / b["o"] - 1 if side == 1 else b["h"] / b["o"] - 1
        big = move <= -CASCADE_DROP if side == 1 else move >= CASCADE_DROP
        return big and mean > 0 and own.get(t, 0) >= LIQ_SPIKE * mean and own.get(t, 0) >= 2 * other.get(t, 0)

    sel = [t for t in ts if t in longs and t in pct["cuentas en largo"] and idx[t] >= WINDOW + 1]
    if not sel:
        raise SystemExit("Sin datos suficientes")
    f = lambda t: datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d %H:%M")
    for side, label in ((1, "Cascadas de largos"), (-1, "Estrujones de cortos")):
        ev = [t for t in sel if event(t, side)]
        base = len(ev) / len(sel)
        print(f"== {label}: {len(ev)} de {len(sel)} velas de 4 h ({base:.1%}), del {f(sel[0])} al {f(sel[-1])} UTC")
        if side == 1:
            for t in ev:
                vals = ", ".join(f"{n.split(' (')[0]} {pct[n][t]:.0%}" for n in pct if t in pct[n])
                print(f"   {f(t)}  {bars[t]['l'] / bars[t]['o'] - 1:+.1%}, largos {longs[t] / 1e6:.0f} M$ | percentiles: {vals}")
        print(f"  {'al abrir la vela (percentil de sus 30 días)':44} {'bajo: velas':>12} {'con evento':>11}   {'alto: velas':>12} {'con evento':>11}")

        def cell(group: list[int]) -> str:
            if len(group) < 30:
                return f"{len(group):12} {'—':>11}"
            r = sum(t in ev for t in group) / len(group)
            z = (r - base) / math.sqrt(base * (1 - base) / len(group)) if 0 < base < 1 else 0
            return f"{len(group):12} {r:10.1%}{'*' if abs(z) >= 2 else ' '}"
        for name, p in pct.items():
            lo = [t for t in sel if t in p and p[t] <= EXTREME]
            hi = [t for t in sel if t in p and p[t] >= 1 - EXTREME]
            print(f"  {name:44} {cell(lo)}   {cell(hi)}")
        us = [t for t in sel if datetime.fromtimestamp(t, timezone.utc).hour == US_OPEN_BAR]
        rest = [t for t in sel if datetime.fromtimestamp(t, timezone.utc).hour != US_OPEN_BAR]
        wk = [t for t in sel if datetime.fromtimestamp(t, timezone.utc).weekday() >= 5]
        day = lambda t: datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d")
        hol = [t for t in sel if day(t) in US_HOLIDAYS]
        half = [t for t in sel if day(t) in US_HALF_DAYS]
        print(f"  {'vela de la apertura de Wall Street / resto':44} {cell(us)}   {cell(rest)}")
        print(f"  {'fin de semana':44} {cell(wk)}")
        print(f"  {'festivo / medio día en la bolsa de EE. UU.':44} {cell(hol)}   {cell(half)}")
        print(f"     (con menos de 30 velas no se da porcentaje; cascadas en festivos: {sum(t in ev for t in hol)},"
              f" en medios días: {sum(t in ev for t in half)})")
        # Alertas: combinaciones sencillas. Cobertura: parte de las cascadas avisadas; precisión: parte de los avisos
        # que acaban en una (frente a la frecuencia de base)
        hi = lambda n, q=1 - EXTREME: (lambda t: t in pct[n] and pct[n][t] >= q)
        lo = lambda n, q=EXTREME: (lambda t: t in pct[n] and pct[n][t] <= q)
        crowd = "cuentas en largo" if side == 1 else None
        if crowd:
            rules = {
                "cuentas en largo altas": hi(crowd),
                "  y interés abierto subiendo": lambda t: hi(crowd)(t) and hi("interés abierto (24 h)", 0.6)(t),
                "  y cerca del mínimo de 7 días": lambda t: hi(crowd)(t) and lo("distancia al mínimo de 7 días", 0.4)(t),
                "  y volatilidad comprimida": lambda t: hi(crowd)(t) and lo("volatilidad 24 h / 30 d", 0.4)(t),
                "  y prima de Coinbase baja": lambda t: hi(crowd)(t) and lo("prima de Coinbase (vela anterior)", 0.4)(t),
                "  y vela de la apertura de Wall Street": lambda t: hi(crowd)(t) and datetime.fromtimestamp(t, timezone.utc).hour == US_OPEN_BAR,
                **{f"cuentas en largo ≥ {a} % (absoluto)": (lambda a: lambda t: ls.get(ts[idx[t] - 1], 0) >= a)(a) for a in ABS_LONGS},
                "≥ 70 % y cerca del mínimo de 7 días": lambda t: ls.get(ts[idx[t] - 1], 0) >= 70 and lo("distancia al mínimo de 7 días", 0.4)(t),
                "≥ 70 % y volumen bajo (vela anterior)": lambda t: ls.get(ts[idx[t] - 1], 0) >= 70 and lo("volumen (vela anterior)", 0.3)(t),
                "≥ 70 % y fin de semana o festivo": lambda t: ls.get(ts[idx[t] - 1], 0) >= 70 and (
                    datetime.fromtimestamp(t, timezone.utc).weekday() >= 5 or day(t) in US_HOLIDAYS | US_HALF_DAYS),
                "≥ 70 % durante 3 días seguidos o más": lambda t: all(ls.get(ts[idx[t] - k], 0) >= 70 for k in range(1, 19)),
            }
            print("  Alertas (cobertura: cascadas avisadas; precisión: avisos con cascada, frente a la base):")
            for name, rule in rules.items():
                alerts = [t for t in sel if rule(t)]
                hit = [t for t in alerts if t in ev]
                cov = len(hit) / len(ev) if ev else 0
                prec = len(hit) / len(alerts) if alerts else 0
                print(f"    {name:40} {len(alerts):5} avisos, cubren {len(hit)}/{len(ev)} ({cov:.0%}), precisión {prec:.1%}"
                      f" ({prec / base:.1f} veces la base)" if base and alerts else f"    {name:40} sin avisos")
            follow_up(sel, ts, idx, bars, ev, {k: rules[k] for k in ("cuentas en largo altas", "  y cerca del mínimo de 7 días",
                                                                    "cuentas en largo ≥ 70 % (absoluto)", "≥ 70 % y cerca del mínimo de 7 días")})
        print()


if __name__ == "__main__":
    main()
