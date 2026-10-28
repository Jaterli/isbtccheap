"""Descarga de datos de fuentes gratuitas. Cada función devuelve un DataFrame/Series diario
indexado por fecha (UTC, sin hora). Si una fuente falla se lanza la excepción y build.py
la trata como métrica ausente."""

import os

import pandas as pd
import requests

TIMEOUT = 60
HEADERS = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}


def _get(url: str, params: dict | None = None) -> requests.Response:
    r = requests.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    return r


def coinmetrics(metrics: list[str]) -> pd.DataFrame:
    """Coin Metrics Community API (gratis, sin clave, licencia CC BY-NC 4.0)."""
    url = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics"
    params = {
        "assets": "btc",
        "metrics": ",".join(metrics),
        "frequency": "1d",
        "page_size": 10000,
        "start_time": "2010-07-18",
    }
    rows: list[dict] = []
    while url:
        data = _get(url, params).json()
        rows.extend(data["data"])
        url = data.get("next_page_url")
        params = None  # next_page_url ya lleva los parámetros
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["time"]).dt.tz_localize(None).dt.normalize()
    df = df.set_index("date").drop(columns=["asset", "time"])
    return df.apply(pd.to_numeric, errors="coerce").sort_index()


def fear_greed() -> pd.Series:
    """Alternative.me Fear & Greed Index (requiere atribución)."""
    data = _get("https://api.alternative.me/fng/", {"limit": 0, "format": "json"}).json()["data"]
    s = pd.Series(
        [float(d["value"]) for d in data],
        index=pd.to_datetime([int(d["timestamp"]) for d in data], unit="s").normalize(),
        name="fear_greed",
    )
    return s.sort_index()


def fred(series_id: str) -> pd.Series:
    """FRED (St. Louis Fed). Con FRED_API_KEY usa la API oficial; sin ella, el CSV público."""
    api_key = os.environ.get("FRED_API_KEY")
    if api_key:
        obs = _get(
            "https://api.stlouisfed.org/fred/series/observations",
            {"series_id": series_id, "api_key": api_key, "file_type": "json"},
        ).json()["observations"]
        s = pd.Series(
            pd.to_numeric([o["value"] for o in obs], errors="coerce"),
            index=pd.to_datetime([o["date"] for o in obs]),
        )
    else:
        from io import StringIO

        csv = _get("https://fred.stlouisfed.org/graph/fredgraph.csv", {"id": series_id}).text
        df = pd.read_csv(StringIO(csv))
        s = pd.Series(pd.to_numeric(df.iloc[:, 1], errors="coerce").values, index=pd.to_datetime(df.iloc[:, 0]))
    return s.dropna().rename(series_id).sort_index()


def stablecoin_supply() -> pd.Series:
    """DefiLlama: capitalización total de stablecoins en USD."""
    data = _get("https://stablecoins.llama.fi/stablecoincharts/all").json()
    s = pd.Series(
        [d["totalCirculatingUSD"].get("peggedUSD", 0) for d in data],
        index=pd.to_datetime([int(d["date"]) for d in data], unit="s").normalize(),
        name="stablecoins",
    )
    return s.sort_index()


def bitview(series: str) -> pd.Series:
    """Serie diaria de Bitview (bitview.space), la instancia pública y gratuita de Bitcoin Research Kit: métricas
    on-chain calculadas desde un nodo de Bitcoin, sin clave. El índice diario empieza el 2009-01-01; el último día
    está aún en curso."""
    d = _get(f"https://bitview.space/api/series/{series}/day1", {"start": 0}).json()
    start = pd.Timestamp("2009-01-01") + pd.Timedelta(days=d["start"])
    s = pd.Series(d["data"], index=pd.date_range(start, periods=len(d["data"]), freq="D"), name=series, dtype=float)
    # Sin dato (o 0, que Bitview devuelve cuando la cohorte está vacía): ausente
    return s.where(s > 0).sort_index()


def etf_flows() -> pd.DataFrame:
    """Flujos de los ETF de bitcoin al contado de EE. UU., una fila por sesión desde el lanzamiento (2024-01-11): flujo
    neto en USD (flow_usd), precio de referencia del día (price), activos totales (aum, a veces vacío) y el desglose
    por fondo (per_fund, dict ticker → USD). The Commoner Bitcoin ETF Tracker de TFTC, CC BY 4.0: exige citar la fuente
    y la fecha de los datos (ver etf_attribution en build.py)."""
    days = _get("https://www.tftc.io/bitcoin-etf-flows/data.json").json()["days"]
    df = pd.DataFrame(
        {
            "flow_usd": [d["netFlowUsd"] for d in days],
            "price": [d["btcCloseUsd"] for d in days],
            "aum": [d.get("totalNetAssetsUsd") for d in days],
            "per_fund": [d.get("perEtfUsd") or {} for d in days],
        },
        index=pd.to_datetime([d["date"] for d in days]),
    )
    return df.dropna(subset=["flow_usd", "price"]).sort_index()
