"""Normalización de métricas a 0-100 y agregación por categorías y temporalidad."""

import pandas as pd

from config import CATEGORIES, METRICS, MIN_HISTORY_DAYS, TIMEFRAME_WEIGHTS


def normalize(metrics: pd.DataFrame) -> pd.DataFrame:
    """Convierte cada métrica a 0 (barato) - 100 (caro).
    El percentil es expansivo: cada día solo se compara con su pasado (backtest honesto)."""
    scores = pd.DataFrame(index=metrics.index)
    for spec in METRICS:
        col = spec["id"]
        if col not in metrics:
            continue
        s = metrics[col]
        if spec["method"] == "percentile":
            valid = s.dropna()
            pct = valid.expanding(min_periods=MIN_HISTORY_DAYS).rank(pct=True) * 100
            score = pct.reindex(s.index)
        else:
            score = s.clip(0, 100)
        if spec.get("invert"):
            score = 100 - score
        scores[col] = score
    return scores


def categories(scores: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=scores.index)
    for cat in CATEGORIES:
        cols = [m["id"] for m in METRICS if m["category"] == cat and m["id"] in scores]
        if cols:
            out[cat] = scores[cols].mean(axis=1, skipna=True)
    return out


def composite(cats: pd.DataFrame, timeframe: str) -> pd.Series:
    """Media ponderada de categorías disponibles (los pesos se renormalizan si falta alguna),
    reescalada a 1-100."""
    weights = pd.Series(TIMEFRAME_WEIGHTS[timeframe]).reindex(cats.columns).fillna(0)
    present = cats.notna()
    w = present.mul(weights, axis=1)
    total = w.sum(axis=1)
    raw = (cats.fillna(0) * w).sum(axis=1) / total
    # Exigimos al menos valoración y ciclo para considerar el score válido
    raw[~(present.get("valoracion", False) & present.get("ciclo", False))] = float("nan")
    return 1 + raw * 0.99
