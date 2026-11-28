"""El aviso de riesgo de cascada de largos (web/src/lib/cascade.ts) con más histórico: en velas diarias, que Coinalyze
guarda desde 2020 (cuentas en largo) y 2022 (liquidaciones), en lugar de las de 4 h, que solo guarda unos 8-11 meses
(backtest_cascades.py: enero a noviembre de 2026, casi todo bajista).

Cascadas, dos definiciones:
  A  con liquidaciones (desde octubre de 2022): un día que cae DROP_A o más de la apertura al mínimo, con liquidaciones
     de largos de LIQ_SPIKE veces su media de 90 días o más y el doble que las de cortos (los perpetuos de
     build_liquidations.py)
  B  solo con el precio (desde 2020, con las cuentas en largo): un día que cae DROP_B o más de la apertura al mínimo
El aviso, como en la web, con lo que se sabía al empezar el día: cuentas en largo de Binance (Coinalyze, BTCUSDT
perpetuo) del día anterior en LONGS o más y, además, el precio cerca de su mínimo de 7 días (en el 40 % más cercano de
sus 30 días anteriores) o LONGS o más los 3 días anteriores.
Se mide: qué parte de los días con aviso trae una cascada (frente a todos los días), qué parte de las cascadas avisa, y
desde el primer día de cada racha de avisos, si hubo una en los 7 días siguientes, cuándo y si antes subió. Todo el
periodo y por tipo de mercado (precio sobre o bajo su media de 200 días).

Solo librería estándar. Clave de Coinalyze (COINALYZE_API_KEY) en news/.env, vía news/run.sh.
Uso: news/run.sh backtest_cascades_daily.py
"""

import json
import os
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date, datetime, timedelta, timezone

from build_liquidations import SYMBOLS

UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}
SPOT = "https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1000&startTime={start}"
DROP_A = 0.05
DROP_B = 0.07
LIQ_SPIKE = 3
LONGS = 70
NEAR_PCT = 0.4
FOLLOW = 7
RISE = 0.03


def get(url: str):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def coinalyze(ep: str, symbols: list[str], **extra) -> list:
    q = urllib.parse.urlencode({"symbols": ",".join(symbols), "interval": "daily", "from": 0, "to": int(time.time()),
                                "api_key": os.environ["COINALYZE_API_KEY"], **extra})
    out = get(f"https://api.coinalyze.net/v1/{ep}?{q}")
    time.sleep(1.5)
    return out


def day(ts: float) -> date:
    return datetime.fromtimestamp(ts, timezone.utc).date()


def load():
    rows, start = [], int(datetime(2019, 9, 1, tzinfo=timezone.utc).timestamp() * 1000)
    while True:
        batch = get(SPOT.format(start=start))
        rows += batch
        if len(batch) < 1000:
            break
        start = batch[-1][0] + 1
    today = datetime.now(timezone.utc).date()
    bars = {day(r[0] / 1000): {"o": float(r[1]), "h": float(r[2]), "l": float(r[3]), "c": float(r[4])} for r in rows}
    bars = {d: b for d, b in bars.items() if d < today}
    longs, shorts = {}, {}
    for s in coinalyze("liquidation-history", SYMBOLS, convert_to_usd="true"):
        for x in s["history"]:
            d = day(x["t"])
            longs[d] = longs.get(d, 0) + x["l"]
            shorts[d] = shorts.get(d, 0) + x["s"]
    ls = {day(x["t"]): x["l"] for x in coinalyze("long-short-ratio-history", ["BTCUSDT_PERP.A"])[0]["history"]}
    return bars, longs, shorts, ls


def main() -> None:
    bars, longs, shorts, ls = load()
    days = sorted(bars)
    idx = {d: i for i, d in enumerate(days)}
    liq_start = min(longs)

    def cascade_a(d: date) -> bool:
        past = [longs.get(d - timedelta(k), 0) for k in range(1, 91)]
        mean = sum(past) / 90
        b = bars[d]
        return (d >= liq_start + timedelta(90) and b["l"] / b["o"] - 1 <= -DROP_A and mean > 0
                and longs.get(d, 0) >= LIQ_SPIKE * mean and longs.get(d, 0) >= 2 * shorts.get(d, 0))

    def cascade_b(d: date) -> bool:
        b = bars[d]
        return b["l"] / b["o"] - 1 <= -DROP_B

    def near_low(d: date) -> bool | None:
        i = idx[d]
        if i < 38:
            return None
        dist = lambda j: bars[days[j]]["c"] / min(bars[days[k]]["l"] for k in range(j - 6, j + 1)) - 1
        now = dist(i - 1)  # con el cierre de ayer
        past = [dist(j) for j in range(i - 31, i - 1)]
        return sum(x < now for x in past) / len(past) <= NEAR_PCT

    def sma200(d: date) -> float | None:
        i = idx[d]
        return None if i < 200 else sum(bars[days[j]]["c"] for j in range(i - 200, i)) / 200

    def alert(d: date) -> tuple[bool, bool, bool] | None:
        prev = [ls.get(d - timedelta(k)) for k in (1, 2, 3)]
        if prev[0] is None:
            return None
        high = prev[0] >= LONGS
        persistent = all(v is not None and v >= LONGS for v in prev)
        near = near_low(d)
        return high, bool(high and near), high and persistent

    print("Cuentas en largo de Binance (Coinalyze, diario) por año: mediana y días en el 70 % o más")
    by_year: dict[int, list[float]] = {}
    for d, v in ls.items():
        by_year.setdefault(d.year, []).append(v)
    for y, vs in sorted(by_year.items()):
        vs.sort()
        print(f"  {y}: mediana {vs[len(vs) // 2]:.1f} %, ≥ 70 %: {sum(v >= LONGS for v in vs)} de {len(vs)} días")
    print()

    for label, is_cascade, first in (("A: con liquidaciones (caída del 5 % y largos ×3 su media)", cascade_a, liq_start + timedelta(90)),
                                     ("B: solo con el precio (caída del 7 % en el día)", cascade_b, min(ls) + timedelta(3))):
        sel = [d for d in days if d >= first and alert(d) is not None and near_low(d) is not None]
        ev = {d for d in sel if is_cascade(d)}
        base = len(ev) / len(sel)
        print(f"== {label}: {len(ev)} cascadas en {len(sel)} días ({base:.1%}), del {sel[0]} al {sel[-1]}")
        for regime, cond in (("todo", lambda d: True),
                             ("precio sobre la media de 200 días", lambda d: (m := sma200(d)) is not None and bars[d]["o"] > m),
                             ("precio bajo la media de 200 días", lambda d: (m := sma200(d)) is not None and bars[d]["o"] <= m)):
            sub = [d for d in sel if cond(d)]
            if not sub:
                continue
            evs = [d for d in sub if d in ev]
            b0 = len(evs) / len(sub)
            print(f"  -- {regime}: {len(evs)} cascadas en {len(sub)} días ({b0:.1%})")
            rules = {
                "cuentas en largo ≥ 70 %": lambda d: alert(d)[0],
                "≥ 70 % y cerca del mínimo de 7 días": lambda d: alert(d)[1],
                "≥ 70 % durante 3 días": lambda d: alert(d)[2],
                "aviso de la web (cerca del mínimo o 3 días)": lambda d: alert(d)[1] or alert(d)[2],
            }
            for name, rule in rules.items():
                on = [d for d in sub if rule(d)]
                hit = [d for d in on if d in ev]
                prec = len(hit) / len(on) if on else 0
                print(f"     {name:44} {len(on):5} días, precisión {prec:5.1%} ({prec / b0 if b0 else 0:4.1f} veces la base),"
                      f" cubre {len(hit)}/{len(evs)} cascadas")
            # Tras el primer día de cada racha del aviso de la web, frente a cualquier día
            web = rules["aviso de la web (cerca del mínimo o 3 días)"]
            starts = [d for d in sub if web(d) and not (d - timedelta(1) in idx and d - timedelta(1) in set(sub) and web(d - timedelta(1)))]

            def follow(ds: list[date]) -> str:
                res = Counter()
                waits, rose = [], 0
                for d in ds:
                    i = idx[d]
                    nxt = [days[j] for j in range(i, min(len(days), i + FOLLOW))]
                    if len(nxt) < FOLLOW:
                        continue
                    res["n"] += 1
                    k = next((n for n, x in enumerate(nxt) if x in ev), None)
                    if k is not None:
                        res["cascada"] += 1
                        waits.append(k)
                        if max(bars[x]["h"] for x in nxt[: k + 1]) / bars[d]["o"] - 1 >= RISE:
                            rose += 1
                if not res["n"]:
                    return "—"
                waits.sort()
                med = f", mediana el día {waits[len(waits) // 2] + 1}" if waits else ""
                return (f"{res['n']:4} | cascada en {FOLLOW} días: {res['cascada'] / res['n']:4.0%}{med};"
                        f" subió un {RISE:.0%} antes en {rose} de {res['cascada']}")
            print(f"     tras el primer día de cada racha del aviso: {follow(starts)}")
            print(f"     desde cualquier día (referencia):           {follow(sub[::3])}")
        print()


if __name__ == "__main__":
    main()
