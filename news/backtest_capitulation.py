"""Backtest de la regla de capitulación (pipeline/metrics.py y build_analysis.py, capitulation) con filtros contra los
picos de pérdida realizada sin caída de precio (p. ej. el 23 de enero de 2026: pérdida ×6 con el precio plano y sin
liquidaciones, probablemente monedas movidas entre carteras de una misma entidad).

Cada variante lista sus episodios (días seguidos) con lo que hizo BTC después y un resumen. Criterio para cambiar la
regla: que quite episodios dudosos sin perder los suelos conocidos (dic 2018, mar 2020, jun 2022, nov 2022, ago 2024,
feb 2026) y que lo que viene después sea igual o mejor.

Solo librería estándar. Precio: web/public/data/history.json del repositorio. Uso: python3 news/backtest_capitulation.py
"""

import json
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}
RATIO, INTENSE_SOPR, INTENSE_PCT = 5, 0.97, 99


def bitview(series: str) -> dict[date, float]:
    url = f"https://bitview.space/api/series/{series}/day1?start=0"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        d = json.loads(r.read())
    start = date(2009, 1, 1) + timedelta(days=d["start"])
    return {start + timedelta(days=i): v for i, v in enumerate(d["data"]) if v and v > 0}


def main() -> None:
    loss_raw, sopr = bitview("sth_realized_loss_sum_24h"), bitview("sth_sopr_24h")
    h = json.loads((ROOT / "web/public/data/history.json").read_text())
    price = {date.fromisoformat(d): p for d, p in zip(h["dates"], h["price"]) if p}
    # El último día de Bitview va en curso
    days = sorted(d for d in sopr if d in price and d < max(sopr))
    first = min(loss_raw)
    loss = {d: loss_raw.get(d, 0.0) for d in (first + timedelta(days=i) for i in range((max(days) - first).days + 1))}
    ld = sorted(loss)
    pos = {d: i for i, d in enumerate(ld)}
    vals = [loss[d] for d in ld]

    rows = {}
    for d in days:
        if d not in pos:
            continue
        i = pos[d]
        w90 = vals[max(0, i - 89):i + 1]
        ratio = vals[i] / (sum(w90) / len(w90)) if sum(w90) else 0
        w4y = vals[max(0, i - 1459):i]
        pct = sum(x < vals[i] for x in w4y) / len(w4y) * 100 if w4y else 0
        prev = price.get(d - timedelta(days=1))
        hi30 = max((price[x] for x in (d - timedelta(days=k) for k in range(30)) if x in price), default=None)
        fut = lambda n: price.get(d + timedelta(days=n))
        low90 = min((price[x] for x in (d + timedelta(days=k) for k in range(1, 91)) if x in price), default=None)
        rows[d] = {
            "ratio": ratio, "sopr": sopr[d], "pct": pct, "p": price[d],
            "chg": price[d] / prev - 1 if prev else 0, "dd30": price[d] / hi30 - 1 if hi30 else 0,
            "r30": (fut(30) / price[d] - 1) if fut(30) else None, "r90": (fut(90) / price[d] - 1) if fut(90) else None,
            "r180": (fut(180) / price[d] - 1) if fut(180) else None,
            "low90": (low90 / price[d] - 1) if low90 and fut(90) else None,
        }

    base = lambda r: r["ratio"] >= RATIO and r["sopr"] < 1
    intense = lambda r: base(r) and (r["sopr"] <= INTENSE_SOPR or r["pct"] >= INTENSE_PCT)
    variants = {
        "A actual (niveles)": base,
        "A actual (intensa)": intense,
        "B niveles + el precio cae ese día": lambda r: base(r) and r["chg"] < 0,
        "C niveles + el precio cae >= 2 % ese día": lambda r: base(r) and r["chg"] <= -0.02,
        "D niveles + >= 10 % por debajo del máximo de 30 días": lambda r: base(r) and r["dd30"] <= -0.10,
        "E niveles + SOPR diario <= 0,99": lambda r: base(r) and r["sopr"] <= 0.99,
        "F intensa solo por SOPR <= 0,97": lambda r: base(r) and r["sopr"] <= INTENSE_SOPR,
        "G intensa actual + (cae >= 2 % o 10 % bajo máx. 30 d)": lambda r: intense(r) and (r["chg"] <= -0.02 or r["dd30"] <= -0.10),
    }
    f = lambda v: "   —" if v is None else f"{v * 100:+4.0f}%"
    for name, rule in variants.items():
        sel = [d for d in sorted(rows) if rule(rows[d])]
        eps: list[list[date]] = []
        for d in sel:
            if eps and (d - eps[-1][-1]).days <= 1:
                eps[-1].append(d)
            else:
                eps.append([d])
        print(f"\n== {name}: {len(eps)} episodios")
        firsts = [rows[e[0]] for e in eps]
        for e in eps:
            r = rows[e[0]]
            top = max(e, key=lambda d: rows[d]["ratio"])
            print(f"  {e[0]}{'→' + str(e[-1]) if len(e) > 1 else '            '}  {r['p']:>8.0f}$  ×{rows[top]['ratio']:4.1f}  "
                  f"SOPR {min(rows[d]['sopr'] for d in e):.3f}  pct {rows[top]['pct']:3.0f}  día {f(r['chg'])}  30d {f(r['dd30'])}  "
                  f"| r30 {f(r['r30'])} r90 {f(r['r90'])} r180 {f(r['r180'])} caída90 {f(r['low90'])}")
        for k in ("r30", "r90", "r180"):
            xs = [r[k] for r in firsts if r[k] is not None]
            if xs:
                print(f"  {k}: media {sum(xs) / len(xs) * 100:+.0f}%  positivos {sum(x > 0 for x in xs)}/{len(xs)}", end="")
        print()


if __name__ == "__main__":
    main()
