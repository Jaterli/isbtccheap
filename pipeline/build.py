"""Punto de entrada del pipeline diario.

Uso:  python pipeline/build.py
Genera web/public/data/latest.json, history.json, categories.json, bands.json, etf.json, liquidity.json y phase.json.
"""

import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

import metrics as metrics_mod
import scoring
import sources
from config import CATEGORIES, LABELS, METRICS, SCORE_STRETCH, TIMEFRAME_WEIGHTS

OUT_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "data"
# Las cuatro últimas, para la liquidez global: balances del BCE y del Banco de Japón y los tipos de cambio
FRED_SERIES = ["WALCL", "WTREGEN", "RRPONTSYD", "M2SL", "DTWEXBGS", "ECBASSETSW", "JPNASSETS", "DEXUSEU", "DEXJPUS"]

ATTRIBUTION = [
    {"name": "Coin Metrics Community", "url": "https://coinmetrics.io/community-network-data/", "license": "CC BY-NC 4.0"},
    {"name": "Alternative.me Fear & Greed", "url": "https://alternative.me/crypto/fear-and-greed-index/"},
    {"name": "FRED, Federal Reserve Bank of St. Louis", "url": "https://fred.stlouisfed.org/"},
    {"name": "DefiLlama", "url": "https://defillama.com/stablecoins"},
    {"name": "Bitview (Bitcoin Research Kit)", "url": "https://bitview.space"},
    {"name": "Binance (precio y funding en vivo)", "url": "https://www.binance.com/"},
]

log = logging.getLogger("isbtccheap")


def etf_credit(etf) -> str:
    """Cita que exige la licencia CC BY 4.0 de los flujos de ETF."""
    return f"The Commoner Bitcoin ETF Tracker by TFTC (tftc.io/bitcoin-etf-flows), data through {etf.index[-1]:%Y-%m-%d}"


def etf_attribution(extra: dict) -> list[dict]:
    if "etf_flows" not in extra:
        return []
    return [{"name": etf_credit(extra["etf_flows"]), "url": "https://www.tftc.io/bitcoin-etf-flows", "license": "CC BY 4.0"}]


def etf_json(etf) -> dict:
    """etf.json: flujo y precio por sesión, y por fondo la última sesión, las últimas 20 y el acumulado (USD)."""
    per = pd.DataFrame(list(etf["per_fund"]), index=etf.index).fillna(0)
    funds = [
        {"ticker": t, "last": round(per[t].iloc[-1]), "d20": round(per[t].iloc[-20:].sum()), "total": round(per[t].sum())}
        for t in per.sum().sort_values(ascending=False).index
    ]
    return {
        "credit": etf_credit(etf),
        "dates": [d.strftime("%Y-%m-%d") for d in etf.index],
        "flow": [round(float(v)) for v in etf["flow_usd"]],
        "price": [round(float(v)) for v in etf["price"]],
        "funds": funds,
    }


def _clean(x):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return round(float(x), 4)


def fetch_all() -> tuple:
    cm = sources.coinmetrics(["PriceUSD", "CapMVRVCur", "IssTotUSD"])
    extra, missing = {}, []
    tasks = {
        "fear_greed": sources.fear_greed,
        "stablecoins": sources.stablecoin_supply,
        "sth_sopr": lambda: sources.bitview("sth_sopr_1w"),
        "sth_realized_price": lambda: sources.bitview("sth_realized_price"),
        "etf_flows": sources.etf_flows,
    }
    tasks.update({sid: (lambda sid=sid: sources.fred(sid)) for sid in FRED_SERIES})
    for name, fn in tasks.items():
        if name in FRED_SERIES and any(s in missing for s in FRED_SERIES):
            missing.append(name)  # si FRED no responde, no esperamos al timeout de cada serie
            continue
        try:
            extra[name] = fn()
            log.info("OK   %s (%d filas)", name, len(extra[name]))
        except Exception as e:  # una fuente caída no debe tumbar el pipeline
            log.warning("FALLO %s: %s", name, e)
            missing.append(name)
    return cm, extra, missing


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    cm, extra, missing = fetch_all()

    m = metrics_mod.compute(cm, extra)
    scores = scoring.normalize(m)
    cats = scoring.categories(scores)
    score_1d = scoring.composite(cats, "1d")

    last = m.index[-1]
    phase = metrics_mod.market_phase(cm, extra)
    latest = {
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "as_of": last.strftime("%Y-%m-%d"),
        "price": _clean(m.at[last, "price"]),
        "score_1d": _clean(score_1d.iloc[-1]),
        "categories": {
            cat: {
                "name": name,
                "score": _clean(cats[cat].iloc[-1]) if cat in cats else None,
                "metrics": [
                    {
                        "id": spec["id"],
                        "name": spec["name"],
                        # último valor disponible (FRED y otros pueden ir con retraso)
                        "value": _clean(m[spec["id"]].dropna().iloc[-1]) if spec["id"] in m and m[spec["id"]].notna().any() else None,
                        "score": _clean(scores[spec["id"]].iloc[-1]) if spec["id"] in scores else None,
                    }
                    for spec in METRICS
                    if spec["category"] == cat
                ],
            }
            for cat, name in CATEGORIES.items()
        },
        "weights": TIMEFRAME_WEIGHTS,
        "stretch": SCORE_STRETCH,
        "labels": [{"max": mx, "label": lb} for mx, lb in LABELS],
        "missing_sources": missing,
        "attribution": ATTRIBUTION + etf_attribution(extra),
        # Fase actual y desde cuándo, para la portada (el detalle, en phase.json)
        "phase": phase and {
            "trend": phase["trend"][-1],
            "liquidity": phase["liquidity"] and phase["liquidity"][-1],
        },
    }

    hist = score_1d.dropna()
    history = {
        "dates": [d.strftime("%Y-%m-%d") for d in hist.index],
        "price": [_clean(m.at[d, "price"]) for d in hist.index],
        "score": [round(float(v), 1) for v in hist.values],
    }

    # Mismas fechas que history.json
    categories_hist = {
        "start": history["dates"][0] if history["dates"] else None,
        "categories": {
            cat: [None if pd.isna(v) else round(float(v)) for v in cats[cat].reindex(hist.index)] for cat in cats.columns
        },
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "latest.json").write_text(json.dumps(latest, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_DIR / "history.json").write_text(json.dumps(history, separators=(",", ":")), encoding="utf-8")
    (OUT_DIR / "categories.json").write_text(json.dumps(categories_hist, separators=(",", ":")), encoding="utf-8")
    if phase:
        (OUT_DIR / "phase.json").write_text(json.dumps(phase, separators=(",", ":")), encoding="utf-8")
    bands = metrics_mod.valuation_bands(cm, extra.get("sth_realized_price"))
    (OUT_DIR / "bands.json").write_text(json.dumps(bands, separators=(",", ":")), encoding="utf-8")
    # Si la fuente falló, se queda el de la última ejecución
    if all(k in extra for k in ("WALCL", "WTREGEN", "RRPONTSYD", *metrics_mod.GLOBAL_SERIES)):
        liquidity = metrics_mod.liquidity_json(extra, cm["PriceUSD"].dropna())
        (OUT_DIR / "liquidity.json").write_text(json.dumps(liquidity, separators=(",", ":")), encoding="utf-8")
    if "etf_flows" in extra:
        (OUT_DIR / "etf.json").write_text(json.dumps(etf_json(extra["etf_flows"]), separators=(",", ":")), encoding="utf-8")
    log.info("Score 1d (%s): %.1f  |  fuentes caídas: %s", latest["as_of"], score_1d.iloc[-1], missing or "ninguna")


if __name__ == "__main__":
    main()
