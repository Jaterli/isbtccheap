"""Liquidaciones de los futuros perpetuos de BTC para la gráfica informativa de la página de sentimiento.

Coinalyze (api.coinalyze.net, clave gratuita COINALYZE_API_KEY en news/.env) da el histórico de liquidaciones de largos
y de cortos en dólares por mercado: en velas diarias desde finales de 2022 y en 4 h, unos 8 meses. Se suman los
principales perpetuos de BTC (Binance, Bybit, OKX, Huobi, Bitfinex) y se guarda out/liquidations.json con el cierre del
perpetuo de Binance para dibujarlas frente al precio. La última vela va en curso.

Backtest de noviembre de 2026 (2022-2026): un pico de liquidaciones de largos (3, 5 u 8 veces su media de 90 días) no
anticipó el precio (a 30 y 90 días, como cualquier día) y le siguieron caídas de un 6-7 % de media en los 30 días
siguientes: es contexto, no una señal, y el índice no lo usa.

No llama a ningún modelo. Uso: python build_liquidations.py (el cron lo lanza cada hora, ver README).
"""

import json
import logging
import os
import time
import urllib.parse
import urllib.request

from build_news import OUT_DIR, write_json

log = logging.getLogger("liquidations")

API = "https://api.coinalyze.net/v1"
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}
# Perpetuos de BTC con histórico en Coinalyze (código de exchange tras el punto: A Binance, 6 Bybit, 3 OKX, 4 Huobi,
# F Bitfinex). Fuera Deribit (su histórico acaba en 2023) e Hyperliquid (sin datos de liquidaciones)
SYMBOLS = ["BTCUSDT_PERP.A", "BTCUSD_PERP.A", "BTCUSDC_PERP.A", "BTCUSDT.6", "BTCUSD.6", "BTCUSDT_PERP.3",
           "BTCUSD_PERP.3", "BTCUSDT_PERP.4", "BTCUSDT_PERP.F"]
PRICE_SYMBOL = "BTCUSDT_PERP.A"
INTERVALS = {"1d": ("daily", 86_400), "4h": ("4hour", 14_400)}
# La serie empieza cuando ya hay datos de casi todos los mercados: antes, la suma saldría baja solo por faltar mercados
MIN_COVERAGE = 0.8


def get(path: str, **params) -> list:
    params["api_key"] = os.environ["COINALYZE_API_KEY"]
    url = f"{API}/{path}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.loads(r.read())


def series(tf: str) -> dict:
    interval, step = INTERVALS[tf]
    now = int(time.time())
    liq = get("liquidation-history", symbols=",".join(SYMBOLS), interval=interval, **{"from": 0, "to": now}, convert_to_usd="true")
    ohlcv = get("ohlcv-history", symbols=PRICE_SYMBOL, interval=interval, **{"from": 0, "to": now})
    close = {h["t"]: h["c"] for h in ohlcv[0]["history"]} if ohlcv else {}
    longs: dict[int, float] = {}
    shorts: dict[int, float] = {}
    first: list[int] = []
    for s in liq:
        if not s["history"]:
            continue
        first.append(s["history"][0]["t"])
        for h in s["history"]:
            longs[h["t"]] = longs.get(h["t"], 0) + h["l"]
            shorts[h["t"]] = shorts.get(h["t"], 0) + h["s"]
    if not first or not close:
        raise RuntimeError(f"{tf}: Coinalyze no devolvió datos")
    first.sort()
    start = max(first[min(len(first) - 1, int(len(first) * MIN_COVERAGE) - 1)], min(close))
    end = max(close)
    # Una vela por intervalo, sin huecos: sin liquidaciones, 0; sin precio, null
    times = range(start - start % step, end + 1, step)
    m = lambda v: round(v / 1e6, 2)
    return {
        "start": times[0] * 1000,
        "step": step * 1000,
        "long": [m(longs.get(t, 0)) for t in times],
        "short": [m(shorts.get(t, 0)) for t in times],
        "close": [close.get(t) for t in times],
        "markets": len(first),
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    out = {"updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "unit": "musd", "source": "Coinalyze"}
    for tf in INTERVALS:
        out[tf] = series(tf)
        log.info("%s: %d velas desde %s (%d mercados)", tf, len(out[tf]["long"]),
                 time.strftime("%Y-%m-%d", time.gmtime(out[tf]["start"] / 1000)), out[tf]["markets"])
    write_json(OUT_DIR / "liquidations.json", out)


if __name__ == "__main__":
    main()
