"""Cálculo de las métricas brutas a partir de los datos descargados.
Todas las series se alinean al índice diario del precio."""

import numpy as np
import pandas as pd

from config import HALVING_PHASE_CURVE, HALVINGS

GENESIS = pd.Timestamp("2009-01-03")
# Coin Metrics publica algunas series (MVRV, emisión) un día más tarde que el precio. Sin rellenar, el último día
# se quedaría sin ellas y la valoración se calcularía solo con el Mayer Multiple
CM_LAG_FILL_DAYS = 3


def rsi(price: pd.Series, period: int = 14) -> pd.Series:
    delta = price.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False).mean()
    return 100 - 100 / (1 + gain / loss)


def power_law_deviation(price: pd.Series) -> pd.Series:
    """Residuo log10(precio) frente a la regresión log-log sobre días desde el bloque génesis.
    Nota: el ajuste usa todo el histórico, así que en el backtest hay algo de lookahead."""
    p = price[price > 0]
    days = (p.index - GENESIS).days.values.astype(float)
    x, y = np.log10(days), np.log10(p.values)
    slope, intercept = np.polyfit(x, y, 1)
    all_days = (price.index - GENESIS).days.values.astype(float)
    fit = intercept + slope * np.log10(all_days)
    return pd.Series(np.log10(price.values) - fit, index=price.index)


def halving_phase_score(index: pd.DatetimeIndex) -> pd.Series:
    bounds = [GENESIS] + [pd.Timestamp(h) for h in HALVINGS]
    xs, ys = zip(*HALVING_PHASE_CURVE)
    out = np.full(len(index), np.nan)
    for i, d in enumerate(index):
        for prev, nxt in zip(bounds[:-1], bounds[1:]):
            if prev <= d < nxt:
                out[i] = np.interp((d - prev).days / (nxt - prev).days, xs, ys)
                break
    return pd.Series(out, index=index)


def _daily(s: pd.Series, index: pd.DatetimeIndex) -> pd.Series:
    """Lleva una serie semanal/mensual a diario repitiendo el último dato publicado."""
    full = s.reindex(s.index.union(index)).ffill()
    return full.reindex(index)


def compute(cm: pd.DataFrame, extra: dict[str, pd.Series]) -> pd.DataFrame:
    """cm: DataFrame de Coin Metrics. extra: series opcionales (fear_greed, FRED, stablecoins)."""
    price = cm["PriceUSD"].dropna()
    idx = price.index
    m = pd.DataFrame(index=idx)
    m["price"] = price

    # Valoración
    if "CapMVRVCur" in cm:
        m["mvrv"] = cm["CapMVRVCur"].reindex(idx).ffill(limit=CM_LAG_FILL_DAYS)
    if "IssTotUSD" in cm:
        iss = cm["IssTotUSD"].reindex(idx).ffill(limit=CM_LAG_FILL_DAYS)
        m["puell"] = iss / iss.rolling(365).mean()
    m["mayer"] = price / price.rolling(200).mean()

    # Ciclo
    m["halving_phase"] = halving_phase_score(idx)
    m["power_law"] = power_law_deviation(price)
    m["wma200_ratio"] = price / price.rolling(1400).mean()

    # Liquidez
    if all(k in extra for k in ("WALCL", "WTREGEN", "RRPONTSYD")):
        # WALCL y WTREGEN en millones de USD, RRPONTSYD en miles de millones
        net = _daily(extra["WALCL"], idx) - _daily(extra["WTREGEN"], idx) - _daily(extra["RRPONTSYD"], idx).fillna(0) * 1000
        m["net_liquidity_roc"] = net.pct_change(91, fill_method=None)
    if "M2SL" in extra:
        m["m2_yoy"] = _daily(extra["M2SL"], idx).pct_change(365, fill_method=None)
    if "DTWEXBGS" in extra:
        m["dxy_roc"] = _daily(extra["DTWEXBGS"], idx).pct_change(91, fill_method=None)
    if "stablecoins" in extra:
        m["stablecoin_roc"] = _daily(extra["stablecoins"], idx).pct_change(90, fill_method=None)

    # Sentimiento
    if "fear_greed" in extra:
        fg = extra["fear_greed"]
        m["fear_greed"] = fg.reindex(idx)
        # Coin Metrics va un día por detrás y Alternative.me publica el de hoy a las 00:00 UTC: el último día usa
        # el índice más reciente, que es el que se ve en su web. Al día siguiente esa fila recupera el suyo.
        if fg.index[-1] > idx[-1]:
            m.loc[idx[-1], "fear_greed"] = fg.iloc[-1]

    # Técnico (mismas métricas que calcula el frontend con las velas)
    m["rsi_14"] = rsi(price)
    ma20, sd20 = price.rolling(20).mean(), price.rolling(20).std(ddof=0)
    m["bollinger"] = (price - (ma20 - 2 * sd20)) / (4 * sd20) * 100
    m["ma200_ratio"] = m["mayer"]

    return m.replace([np.inf, -np.inf], np.nan)
