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


def power_law_fit(price: pd.Series) -> tuple[float, float]:
    """Pendiente y ordenada de la regresión log10(precio) ~ log10(días desde el bloque génesis).
    Nota: el ajuste usa todo el histórico, así que en el backtest hay algo de lookahead."""
    p = price[price > 0]
    days = (p.index - GENESIS).days.values.astype(float)
    slope, intercept = np.polyfit(np.log10(days), np.log10(p.values), 1)
    return float(slope), float(intercept)


def power_law_deviation(price: pd.Series) -> pd.Series:
    """Residuo log10(precio) frente a la tendencia de la power law."""
    slope, intercept = power_law_fit(price)
    all_days = (price.index - GENESIS).days.values.astype(float)
    fit = intercept + slope * np.log10(all_days)
    return pd.Series(np.log10(price.values) - fit, index=price.index)


# Corredor de la power law: percentiles del residuo desde 2013 (los primeros años, con muy poca liquidez, lo
# ensancharían). Entre ellos ha estado el 95 % de los días
PL_BAND_SINCE = "2013-01-01"
PL_BAND_PCT = (2.5, 97.5)


def valuation_bands(cm: pd.DataFrame, sth_realized: pd.Series | None = None) -> dict:
    """Niveles de referencia del precio para la página de bandas de valoración (bands.json): precio realizado (total y
    de los holders de corto plazo, de Bitview), media de 200 semanas y la tendencia de la power law con su corredor
    (como parámetros: la web dibuja la recta)."""
    price = cm["PriceUSD"].dropna()
    idx = pd.date_range(price.index[0], price.index[-1], freq="D")
    price = price.reindex(idx)
    # Precio realizado = capitalización realizada / oferta = precio / MVRV. Se rellena el retraso de Coin Metrics
    realized = (price / cm["CapMVRVCur"].reindex(idx)).ffill(limit=CM_LAG_FILL_DAYS) if "CapMVRVCur" in cm else None
    sth = sth_realized.reindex(idx).ffill(limit=CM_LAG_FILL_DAYS) if sth_realized is not None else None
    wma200 = price.rolling(1400).mean()
    slope, intercept = power_law_fit(price.dropna())
    resid = power_law_deviation(price.dropna())[PL_BAND_SINCE:]
    lo, hi = np.percentile(resid, PL_BAND_PCT)

    def arr(s):
        # 5 cifras significativas: de sobra para la gráfica y el JSON pesa la mitad
        return [None if s is None or pd.isna(v) else float(f"{v:.5g}") for v in (s if s is not None else [])]

    return {
        "start": idx[0].strftime("%Y-%m-%d"),
        "price": arr(price),
        "realized": arr(realized),
        "sth_realized": arr(sth),
        "wma200": arr(wma200),
        "power_law": {
            "genesis": GENESIS.strftime("%Y-%m-%d"),
            "slope": round(slope, 6),
            "intercept": round(intercept, 6),
            # Múltiplos de la tendencia que delimitan el corredor
            "low": round(float(10**lo), 4),
            "high": round(float(10**hi), 4),
            "since": PL_BAND_SINCE,
        },
    }


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
    """cm: DataFrame de Coin Metrics. extra: series opcionales (fear_greed, FRED, stablecoins, Bitview)."""
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
    if "etf_flows" in extra:
        # Suma de 20 sesiones llevada a diario: fines de semana y festivos repiten la última sesión
        roll = extra["etf_flows"].rolling(20).sum().dropna()
        m["etf_flows"] = roll.reindex(roll.index.union(idx)).ffill(limit=5).reindex(idx)
    if "sth_sopr" in extra:
        m["sth_sopr"] = extra["sth_sopr"].reindex(idx).ffill(limit=CM_LAG_FILL_DAYS)
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
