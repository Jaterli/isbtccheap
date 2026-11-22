"""Backtest de la regla de capitulación (pipeline/metrics.py y build_analysis.py, capitulation) con filtros contra los
picos de pérdida realizada que no son ventas (p. ej. el 23 de enero de 2026: pérdida ×7 con el precio plano y sin
liquidaciones). La cadena solo ve monedas que se mueven, no ventas: se confirma con las ventas reales del contado de
Binance (volumen del día frente a su media de 30 días y parte de ventas a mercado) y, como aproximación tosca, con la
caída del precio.

Cada variante lista sus episodios (días seguidos) con lo que hizo BTC después y dos resúmenes: todo el histórico y desde
2018 (con el volumen de Binance, que empieza en agosto de 2017, y sin los precios de pocos dólares de 2011-2013).
Criterio para cambiar la regla: que quite episodios dudosos sin perder los suelos conocidos (dic 2018, mar 2020, jun
2022, nov 2022, ago 2024, abr 2025, feb 2026) y que lo que viene después sea igual o mejor.

Solo librería estándar. Precio: web/public/data/history.json del repositorio. Uso: python3 news/backtest_capitulation.py
"""

import json
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}
RATIO, INTENSE_SOPR, INTENSE_PCT = 5, 0.97, 99
SPOT = "https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1000"
FROM_SUMMARY = date(2018, 1, 1)


def get(url: str):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.loads(r.read())


def bitview(series: str) -> dict[date, float]:
    d = get(f"https://bitview.space/api/series/{series}/day1?start=0")
    start = date(2009, 1, 1) + timedelta(days=d["start"])
    return {start + timedelta(days=i): v for i, v in enumerate(d["data"]) if v and v > 0}


def binance_spot() -> dict[date, tuple[float, float]]:
    """Volumen al contado de BTCUSDT por día (BTC) y la parte de ventas a mercado (0-1), desde agosto de 2017."""
    out: dict[date, tuple[float, float]] = {}
    start = 0
    while True:
        rows = get(f"{SPOT}&startTime={start}")
        for r in rows:
            vol, buy = float(r[5]), float(r[9])
            if vol > 0:
                out[datetime.fromtimestamp(r[0] / 1000, timezone.utc).date()] = (vol, 1 - buy / vol)
        if len(rows) < 1000:
            return out
        start = rows[-1][0] + 1


def main() -> None:
    loss_raw, sopr = bitview("sth_realized_loss_sum_24h"), bitview("sth_sopr_24h")
    spot = binance_spot()
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
        # Contado de Binance: volumen frente a la media de los 30 días anteriores y parte de ventas a mercado
        prev30 = [spot[x][0] for x in (d - timedelta(days=k) for k in range(1, 31)) if x in spot]
        vol = spot[d][0] / (sum(prev30) / len(prev30)) if d in spot and len(prev30) >= 20 else None
        sell = spot[d][1] if d in spot else None
        rows[d] = {
            "ratio": ratio, "sopr": sopr[d], "pct": pct, "p": price[d], "vol": vol, "sell": sell,
            "chg": price[d] / prev - 1 if prev else 0, "dd30": price[d] / hi30 - 1 if hi30 else 0,
            "r30": (fut(30) / price[d] - 1) if fut(30) else None, "r90": (fut(90) / price[d] - 1) if fut(90) else None,
            "r180": (fut(180) / price[d] - 1) if fut(180) else None,
            "low90": (low90 / price[d] - 1) if low90 and fut(90) else None,
        }

    base = lambda r: r["ratio"] >= RATIO and r["sopr"] < 1
    intense = lambda r: base(r) and (r["sopr"] <= INTENSE_SOPR or r["pct"] >= INTENSE_PCT)
    sopr_only = lambda r: base(r) and r["sopr"] <= INTENSE_SOPR
    volx = lambda r, x: r["vol"] is not None and r["vol"] >= x
    sells = lambda r, x: r["sell"] is not None and r["sell"] >= x
    variants = {
        "A actual (niveles)": base,
        "A actual (intensa)": intense,
        "C niveles + el precio cae >= 2 % ese día": lambda r: base(r) and r["chg"] <= -0.02,
        "F intensa solo por SOPR <= 0,97": sopr_only,
        # Ventas reales: volumen al contado alto
        "H niveles + volumen >= 1,3× su media": lambda r: base(r) and volx(r, 1.3),
        "I niveles + volumen >= 1,5× su media": lambda r: base(r) and volx(r, 1.5),
        "J niveles + volumen >= 2× su media": lambda r: base(r) and volx(r, 2),
        # Ventas reales: predominio de ventas a mercado
        "K niveles + ventas a mercado >= 51 %": lambda r: base(r) and sells(r, 0.51),
        "L niveles + ventas a mercado >= 52 %": lambda r: base(r) and sells(r, 0.52),
        # Cualquiera de las dos señales de venta
        "M niveles + (volumen >= 1,5× o ventas >= 52 %)": lambda r: base(r) and (volx(r, 1.5) or sells(r, 0.52)),
        # Con la intensa de F
        "N intensa F + volumen >= 1,5×": lambda r: sopr_only(r) and volx(r, 1.5),
        "O intensa F + (volumen >= 1,5× o ventas >= 52 %)": lambda r: sopr_only(r) and (volx(r, 1.5) or sells(r, 0.52)),
    }
    f = lambda v: "   —" if v is None else f"{v * 100:+4.0f}%"
    summary = []
    for name, rule in variants.items():
        sel = [d for d in sorted(rows) if rule(rows[d])]
        eps: list[list[date]] = []
        for d in sel:
            if eps and (d - eps[-1][-1]).days <= 1:
                eps[-1].append(d)
            else:
                eps.append([d])
        print(f"\n== {name}: {len(eps)} episodios")
        for e in eps:
            r = rows[e[0]]
            top = max(e, key=lambda d: rows[d]["ratio"])
            vol = max((rows[d]["vol"] for d in e if rows[d]["vol"] is not None), default=None)
            sell = max((rows[d]["sell"] for d in e if rows[d]["sell"] is not None), default=None)
            print(f"  {e[0]}{'→' + str(e[-1]) if len(e) > 1 else '            '}  {r['p']:>8.0f}$  ×{rows[top]['ratio']:4.1f}  "
                  f"SOPR {min(rows[d]['sopr'] for d in e):.3f}  pct {rows[top]['pct']:3.0f}  día {f(r['chg'])}  30d {f(r['dd30'])}  "
                  f"vol {'  —' if vol is None else f'{vol:3.1f}×'}  ventas {'  —' if sell is None else f'{sell * 100:2.0f}%'}  "
                  f"| r30 {f(r['r30'])} r90 {f(r['r90'])} r180 {f(r['r180'])} caída90 {f(r['low90'])}")
        for label, es in (("todo", eps), ("desde 2018", [e for e in eps if e[0] >= FROM_SUMMARY])):
            firsts = [rows[e[0]] for e in es]
            parts = [f"{len(es)} episodios"]
            for k in ("r30", "r90", "r180", "low90"):
                xs = [r[k] for r in firsts if r[k] is not None]
                if xs:
                    pos_ = "" if k == "low90" else f" ({sum(x > 0 for x in xs)}/{len(xs)} positivos)"
                    parts.append(f"{'caída90' if k == 'low90' else k} {sum(xs) / len(xs) * 100:+.0f}%{pos_}")
            print(f"  {label}: " + "  ".join(parts))
            if label == "desde 2018":
                summary.append((name, "  ".join(parts)))

    print("\n\n######## Resumen desde 2018")
    for name, line in summary:
        print(f"{name:52s} {line}")


if __name__ == "__main__":
    main()
