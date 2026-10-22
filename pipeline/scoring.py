"""Normalización de métricas a 0-100 y agregación por categorías y temporalidad."""

import numpy as np
import pandas as pd

from config import CATEGORIES, METRICS, MIN_HISTORY_DAYS, PERCENTILE_WINDOW_DAYS, SCORE_STRETCH, TIMEFRAME_WEIGHTS


def normalize(metrics: pd.DataFrame) -> pd.DataFrame:
    """Convierte cada métrica a 0 (barato) - 100 (caro).
    El percentil usa una ventana móvil: cada día solo se compara con su pasado (backtest honesto)."""
    scores = pd.DataFrame(index=metrics.index)
    for spec in METRICS:
        col = spec["id"]
        if col not in metrics:
            continue
        s = metrics[col]
        if spec["method"] == "percentile":
            valid = s.dropna()
            window = spec.get("window", PERCENTILE_WINDOW_DAYS)
            pct = valid.rolling(window, min_periods=min(window, MIN_HISTORY_DAYS)).rank(pct=True) * 100
            score = pct.reindex(s.index)
        elif spec["method"] == "band":
            score = ((s - spec["lo"]) / (spec["hi"] - spec["lo"]) * 100).clip(0, 100)
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


def stretch(x):
    """Contrarresta la compresión hacia 50 de la media ponderada (ver SCORE_STRETCH)."""
    if not SCORE_STRETCH:
        return x
    return 50 + 50 * np.tanh(SCORE_STRETCH * (x - 50) / 50) / np.tanh(SCORE_STRETCH)


def composite(cats: pd.DataFrame, timeframe: str) -> pd.Series:
    """Media ponderada de categorías disponibles (los pesos se renormalizan si falta alguna),
    estirada y reescalada a 1-100."""
    weights = pd.Series(TIMEFRAME_WEIGHTS[timeframe]).reindex(cats.columns).fillna(0)
    present = cats.notna()
    w = present.mul(weights, axis=1)
    total = w.sum(axis=1)
    raw = (cats.fillna(0) * w).sum(axis=1) / total
    # Exigimos al menos valoración y ciclo para considerar el score válido
    raw[~(present.get("valoracion", False) & present.get("ciclo", False))] = float("nan")
    return 1 + stretch(raw) * 0.99
