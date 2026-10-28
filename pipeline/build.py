"""Punto de entrada del pipeline diario.

Uso:  python pipeline/build.py
Genera web/public/data/latest.json, history.json, categories.json y bands.json.
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
FRED_SERIES = ["WALCL", "WTREGEN", "RRPONTSYD", "M2SL", "DTWEXBGS"]

ATTRIBUTION = [
    {"name": "Coin Metrics Community", "url": "https://coinmetrics.io/community-network-data/", "license": "CC BY-NC 4.0"},
    {"name": "Alternative.me Fear & Greed", "url": "https://alternative.me/crypto/fear-and-greed-index/"},
    {"name": "FRED, Federal Reserve Bank of St. Louis", "url": "https://fred.stlouisfed.org/"},
    {"name": "DefiLlama", "url": "https://defillama.com/stablecoins"},
    {"name": "Bitview (Bitcoin Research Kit)", "url": "https://bitview.space"},
    {"name": "Binance (precio y funding en vivo)", "url": "https://www.binance.com/"},
]

log = logging.getLogger("isbtccheap")


def etf_attribution(extra: dict) -> list[dict]:
    """Cita que exige la licencia CC BY 4.0 de los flujos de ETF, con la fecha de los últimos datos."""
    if "etf_flows" not in extra:
        return []
    through = extra["etf_flows"].index[-1].strftime("%Y-%m-%d")
    return [{
        "name": f"The Commoner Bitcoin ETF Tracker by TFTC (tftc.io/bitcoin-etf-flows), data through {through}",
        "url": "https://www.tftc.io/bitcoin-etf-flows",
        "license": "CC BY 4.0",
    }]


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
    }

    hist = score_1d.dropna()
    history = {
        "dates": [d.strftime("%Y-%m-%d") for d in hist.index],
        "price": [_clean(m.at[d, "price"]) for d in hist.index],
        "score": [round(float(v), 1) for v in hist.values],
    }

    # Puntuación de cada categoría con las mismas fechas que history.json (página de categorías, web/categorias)
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
    # Para la página de bandas de valoración (web/valoracion)
    bands = metrics_mod.valuation_bands(cm, extra.get("sth_realized_price"))
    (OUT_DIR / "bands.json").write_text(json.dumps(bands, separators=(",", ":")), encoding="utf-8")
    log.info("Score 1d (%s): %.1f  |  fuentes caídas: %s", latest["as_of"], score_1d.iloc[-1], missing or "ninguna")


if __name__ == "__main__":
    main()
