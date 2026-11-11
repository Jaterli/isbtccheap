"""Guarda el histórico de los derivados de Binance que usa el sentimiento del índice en 1 h y 4 h.

Binance solo guarda 30 días de open interest, cuentas en largo y compras a mercado (y da como mucho 500 puntos: unos 20
días en 1 h), así que no hay histórico con el que comprobar si el sentimiento de 1 h y 4 h anticipa el precio. Este
script lo va formando: cada ejecución descarga lo que da Binance y añade a state/derivatives_{1h,4h}.csv las velas que
aún no tiene. Basta con que corra una vez cada pocos días para no perder nada; el cron lo lanza cada 6 h (ver README).

Columnas: hora UTC de inicio de la vela (ms), cierre de BTCUSDT al contado, open interest (BTC), cuentas en largo / en
corto, % de cuentas en largo, ratio de compras / ventas a mercado y volúmenes de compra y venta a mercado (BTC).
No llama a ningún modelo. Uso: python collect_derivatives.py
"""

import csv
import json
import logging
import urllib.request

from build_news import STATE_DIR

log = logging.getLogger("derivatives")

SPOT = "https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval={tf}&limit=500"
FUTURES = "https://fapi.binance.com/futures/data/{path}?symbol=BTCUSDT&period={tf}&limit=500"
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}
TIMEFRAMES = ("1h", "4h")
FIELDS = ["time", "close", "open_interest_btc", "long_short_ratio", "long_account_pct", "taker_buy_sell_ratio",
          "taker_buy_btc", "taker_sell_btc"]


def get(url: str):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.loads(r.read())


def fetch(tf: str) -> dict[int, dict]:
    """Filas por hora de inicio de la vela, solo las que tienen los tres derivados y el precio."""
    close = {int(k[0]): float(k[4]) for k in get(SPOT.format(tf=tf))}
    oi = {int(r["timestamp"]): r for r in get(FUTURES.format(path="openInterestHist", tf=tf))}
    ls = {int(r["timestamp"]): r for r in get(FUTURES.format(path="globalLongShortAccountRatio", tf=tf))}
    tk = {int(r["timestamp"]): r for r in get(FUTURES.format(path="takerlongshortRatio", tf=tf))}
    rows = {}
    for t in sorted(set(oi) & set(ls) & set(tk) & set(close)):
        rows[t] = {
            "time": t, "close": close[t],
            "open_interest_btc": round(float(oi[t]["sumOpenInterest"]), 3),
            "long_short_ratio": float(ls[t]["longShortRatio"]),
            "long_account_pct": round(float(ls[t]["longAccount"]) * 100, 2),
            "taker_buy_sell_ratio": float(tk[t]["buySellRatio"]),
            "taker_buy_btc": round(float(tk[t]["buyVol"]), 3),
            "taker_sell_btc": round(float(tk[t]["sellVol"]), 3),
        }
    return rows


def collect(tf: str) -> None:
    path = STATE_DIR / f"derivatives_{tf}.csv"
    have: set[int] = set()
    if path.exists():
        with open(path, newline="", encoding="utf-8") as f:
            have = {int(r["time"]) for r in csv.DictReader(f)}
    # La última vela puede estar a medias: se guarda solo hasta la penúltima
    new = sorted((r for t, r in fetch(tf).items() if t not in have), key=lambda r: r["time"])[:-1]
    if have and new and new[0]["time"] < max(have):
        log.warning("%s: hay velas nuevas anteriores a la última guardada; el CSV queda desordenado", tf)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with open(path, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if not have:
            w.writeheader()
        w.writerows(new)
    log.info("%s: %d velas nuevas (%d en total)", tf, len(new), len(have) + len(new))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    for tf in TIMEFRAMES:
        try:
            collect(tf)
        except Exception as e:  # una temporalidad que falle no impide guardar la otra
            log.warning("%s: no se pudo descargar: %s", tf, e)


if __name__ == "__main__":
    main()
