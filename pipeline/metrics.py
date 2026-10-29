"""Cálculo de las métricas brutas a partir de los datos descargados.
Todas las series se alinean al índice diario del precio."""

import numpy as np
import pandas as pd

from config import HALVING_PHASE_CURVE, HALVINGS

GENESIS = pd.Timestamp("2009-01-03")
# Coin Metrics publica MVRV y emisión un día después que el precio: sin rellenar, el último día se quedaría sin ellas
CM_LAG_FILL_DAYS = 3


def rsi(price: pd.Series, period: int = 14) -> pd.Series:
    delta = price.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False).mean()
    return 100 - 100 / (1 + gain / loss)


def power_law_fit(price: pd.Series) -> tuple[float, float]:
    """Regresión log10(precio) ~ log10(días desde el génesis). Usa todo el histórico: hay algo de lookahead."""
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


# Corredor de la power law: el 95 % central del residuo desde 2013 (los primeros años, muy ilíquidos, lo ensancharían)
PL_BAND_SINCE = "2013-01-01"
PL_BAND_PCT = (2.5, 97.5)


def valuation_bands(cm: pd.DataFrame, sth_realized: pd.Series | None = None) -> dict:
    """bands.json: precio, precios realizados, media de 200 semanas y los parámetros de la power law (la web dibuja la
    recta y su corredor)."""
    price = cm["PriceUSD"].dropna()
    idx = pd.date_range(price.index[0], price.index[-1], freq="D")
    price = price.reindex(idx)
    # Precio realizado = precio / MVRV
    realized = (price / cm["CapMVRVCur"].reindex(idx)).ffill(limit=CM_LAG_FILL_DAYS) if "CapMVRVCur" in cm else None
    sth = sth_realized.reindex(idx).ffill(limit=CM_LAG_FILL_DAYS) if sth_realized is not None else None
    wma200 = price.rolling(1400).mean()
    slope, intercept = power_law_fit(price.dropna())
    resid = power_law_deviation(price.dropna())[PL_BAND_SINCE:]
    lo, hi = np.percentile(resid, PL_BAND_PCT)

    def arr(s):
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
            "low": round(float(10**lo), 4),
            "high": round(float(10**hi), 4),
            "since": PL_BAND_SINCE,
        },
    }


def net_liquidity(extra: dict, index: pd.DatetimeIndex) -> pd.Series:
    """Balance de la Fed − cuenta del Tesoro − repos inversos, en millones de USD (RRPONTSYD viene en miles de millones)."""
    return _daily(extra["WALCL"], index) - _daily(extra["WTREGEN"], index) - _daily(extra["RRPONTSYD"], index).fillna(0) * 1000


GLOBAL_SERIES = ("ECBASSETSW", "JPNASSETS", "DEXUSEU", "DEXJPUS")


# Días que tardan en publicarse: el balance del BCE (viernes) sale el martes siguiente y el del Banco de Japón (mensual),
# unas 5 semanas después del mes. Sin este retraso, el histórico usaría datos que aún no se conocían
PUBLICATION_LAG = {"ECBASSETSW": 4, "JPNASSETS": 35}


def global_liquidity(extra: dict, index: pd.DatetimeIndex) -> pd.Series:
    """Liquidez neta de la Fed + balances del BCE y del Banco de Japón en dólares, en millones de USD. Anticipa la
    rentabilidad de BTC mejor que la de la Fed sola (correlación por rangos desde 2015: 0,44 frente a 0,23 a 13 semanas;
    0,23 frente a 0,11 a un año). ECBASSETSW: millones de EUR; JPNASSETS: cientos de millones de JPY, mensual."""
    pub = {k: extra[k].set_axis(extra[k].index + pd.Timedelta(days=d)) for k, d in PUBLICATION_LAG.items()}
    ecb = _daily(pub["ECBASSETSW"], index) * _daily(extra["DEXUSEU"], index)
    boj = _daily(pub["JPNASSETS"], index) * 100 / _daily(extra["DEXJPUS"], index)
    return net_liquidity(extra, index) + ecb + boj


def liquidity_json(extra: dict, price: pd.Series) -> dict:
    """liquidity.json, diario: liquidez global en miles de millones y su variación en 13 semanas hasta el último día con
    dato de las series diarias (repos inversos y tipos de cambio; los balances semanales y mensuales repiten su último
    valor), y el precio de BTC hasta hoy."""
    through = min(extra[k].dropna().index[-1] for k in ("RRPONTSYD", "DEXUSEU", "DEXJPUS"))
    days = pd.date_range("2011-01-01", through, freq="D")
    glob = global_liquidity(extra, pd.date_range("2010-01-01", through, freq="D"))
    prices = price["2011-01-01":]
    # 5 cifras significativas: los precios de 2011 son de céntimos
    sig = lambda v: None if pd.isna(v) else float(f"{v:.5g}")
    return {
        "through": through.strftime("%Y-%m-%d"),
        "start": days[0].strftime("%Y-%m-%d"),
        "net": [sig(v) for v in (glob / 1000).reindex(days)],
        "roc": [None if pd.isna(v) else round(float(v), 4) for v in glob.pct_change(91, fill_method=None).reindex(days)],
        "daily_start": prices.index[0].strftime("%Y-%m-%d"),
        "daily_price": [sig(v) for v in prices.reindex(pd.date_range(prices.index[0], prices.index[-1], freq="D"))],
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
    """cm: Coin Metrics. extra: el resto de fuentes; las que fallaron no están."""
    price = cm["PriceUSD"].dropna()
    idx = price.index
    m = pd.DataFrame(index=idx)
    m["price"] = price

    if "CapMVRVCur" in cm:
        m["mvrv"] = cm["CapMVRVCur"].reindex(idx).ffill(limit=CM_LAG_FILL_DAYS)
    if "IssTotUSD" in cm:
        iss = cm["IssTotUSD"].reindex(idx).ffill(limit=CM_LAG_FILL_DAYS)
        m["puell"] = iss / iss.rolling(365).mean()
    m["mayer"] = price / price.rolling(200).mean()

    m["halving_phase"] = halving_phase_score(idx)
    m["power_law"] = power_law_deviation(price)
    m["wma200_ratio"] = price / price.rolling(1400).mean()

    if all(k in extra for k in ("WALCL", "WTREGEN", "RRPONTSYD", *GLOBAL_SERIES)):
        m["global_liquidity_roc"] = global_liquidity(extra, idx).pct_change(91, fill_method=None)
    if "M2SL" in extra:
        m["m2_yoy"] = _daily(extra["M2SL"], idx).pct_change(365, fill_method=None)
    if "DTWEXBGS" in extra:
        m["dxy_roc"] = _daily(extra["DTWEXBGS"], idx).pct_change(91, fill_method=None)
    if "stablecoins" in extra:
        m["stablecoin_roc"] = _daily(extra["stablecoins"], idx).pct_change(90, fill_method=None)

    if "etf_flows" in extra:
        # En BTC, para que la subida del precio no infle los flujos recientes; fines de semana y festivos repiten
        etf = extra["etf_flows"]
        roll = (etf["flow_usd"] / etf["price"]).rolling(20).sum().dropna()
        m["etf_flows"] = roll.reindex(roll.index.union(idx)).ffill(limit=5).reindex(idx)
    if "sth_sopr" in extra:
        m["sth_sopr"] = extra["sth_sopr"].reindex(idx).ffill(limit=CM_LAG_FILL_DAYS)
    if "fear_greed" in extra:
        fg = extra["fear_greed"]
        m["fear_greed"] = fg.reindex(idx)
        # El último día usa el índice más reciente (Alternative.me publica el de hoy; Coin Metrics va un día por detrás)
        if fg.index[-1] > idx[-1]:
            m.loc[idx[-1], "fear_greed"] = fg.iloc[-1]

    # Mismo técnico que calcula el frontend con las velas
    m["rsi_14"] = rsi(price)
    ma20, sd20 = price.rolling(20).mean(), price.rolling(20).std(ddof=0)
    m["bollinger"] = (price - (ma20 - 2 * sd20)) / (4 * sd20) * 100
    m["ma200_ratio"] = m["mayer"]

    return m.replace([np.inf, -np.inf], np.nan)
