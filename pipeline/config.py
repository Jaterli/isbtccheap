"""Configuración del score de Is BTC Cheap?: métricas, categorías y pesos por temporalidad.

Convención: 0 = muy barato, 100 = muy caro. El score final se reescala a 1-100.
`invert=True` significa que un valor alto de la métrica es "barato" (p. ej. liquidez creciente).
"""

CATEGORIES = {
    "valoracion": "Valoración on-chain",
    "ciclo": "Ciclo",
    "liquidez": "Liquidez",
    "sentimiento": "Sentimiento",
    "tecnico": "Técnico",
}

# method: "percentile" -> percentil en ventana móvil de PERCENTILE_WINDOW_DAYS ("window" la cambia), sin mirar al futuro
#         "raw"        -> ya viene en escala 0-100
#         "band"       -> lineal de "lo" (0) a "hi" (100), recortada
METRICS = [
    {"id": "mvrv", "name": "MVRV", "category": "valoracion", "method": "percentile"},
    {"id": "puell", "name": "Puell Multiple", "category": "valoracion", "method": "percentile"},
    {"id": "mayer", "name": "Mayer Multiple (precio / MA200d)", "category": "valoracion", "method": "percentile"},
    {"id": "halving_phase", "name": "Fase del ciclo de halving", "category": "ciclo", "method": "raw"},
    {"id": "power_law", "name": "Desviación de la power law", "category": "ciclo", "method": "percentile"},
    {"id": "wma200_ratio", "name": "Precio / MA200 semanas", "category": "ciclo", "method": "percentile"},
    {"id": "net_liquidity_roc", "name": "Liquidez neta Fed (var. 13 sem.)", "category": "liquidez", "method": "percentile", "invert": True},
    {"id": "m2_yoy", "name": "M2 EE. UU. (var. interanual)", "category": "liquidez", "method": "percentile", "invert": True},
    {"id": "dxy_roc", "name": "Dólar DXY amplio (var. 13 sem.)", "category": "liquidez", "method": "percentile"},
    {"id": "stablecoin_roc", "name": "Oferta de stablecoins (var. 90 d)", "category": "liquidez", "method": "percentile", "invert": True},
    # El funding y, en 1 h y 4 h, los derivados se añaden en vivo en el frontend
    {"id": "fear_greed", "name": "Fear & Greed Index", "category": "sentimiento", "method": "raw"},
    # El precio realizado de corto plazo se probó en valoración y empeoraba la anticipación a un año (es momentum): solo
    # se muestra en la página de valoración
    {"id": "sth_sopr", "name": "SOPR de corto plazo (7 d)", "category": "sentimiento", "method": "percentile"},
    # 20 sesiones: con 5 o 10 se comporta como momentum. Datos desde 2024, así que puntúa desde 2025
    {"id": "etf_flows", "name": "Flujos de ETF al contado (20 sesiones)", "category": "sentimiento", "method": "percentile"},
    # El frontend recalcula el técnico con las velas de cada temporalidad
    {"id": "rsi_14", "name": "RSI 14", "category": "tecnico", "method": "band", "lo": 30, "hi": 70},
    {"id": "bollinger", "name": "Bollinger %B (20, 2)", "category": "tecnico", "method": "raw"},
    {"id": "ma200_ratio", "name": "Precio / MA200 (percentil)", "category": "tecnico", "method": "percentile", "window": 800},
]

# Pesos por temporalidad: en las cortas pesa más lo que cambia rápido. Correlaciones con la rentabilidad a un año:
# ciclo −0,51, liquidez −0,16 y técnico +0,27 (momentum), así que la liquidez sube y el técnico baja con el plazo.
# La liquidez difumina los extremos (alta en los suelos, baja en los techos): pesa poco en plazos cortos.
# En 1 h el ciclo es casi constante y cede peso al sentimiento (derivados en vivo); sin datos para un backtest.
TIMEFRAME_WEIGHTS = {
    "1h": {"tecnico": 40, "sentimiento": 27, "valoracion": 20, "ciclo": 10, "liquidez": 3},
    "4h": {"tecnico": 30, "sentimiento": 20, "valoracion": 27, "ciclo": 19, "liquidez": 4},
    "1d": {"tecnico": 12, "sentimiento": 15, "valoracion": 38, "ciclo": 30, "liquidez": 5},
    "1w": {"tecnico": 6, "sentimiento": 12, "valoracion": 41, "ciclo": 33, "liquidez": 8},
    "1M": {"tecnico": 4, "sentimiento": 5, "valoracion": 39, "ciclo": 38, "liquidez": 14},
}

# Un ciclo de halving: con ventana expansiva los techos recientes no llegaban arriba frente a las burbujas de 2013 y 2017
PERCENTILE_WINDOW_DAYS = 1461

# Al promediar señales poco correlacionadas el score se comprime hacia 50. Se estira con
# 50 + 50·tanh(k·(x−50)/50)/tanh(k), que conserva 0, 50 y 100. 0 lo desactiva.
SCORE_STRETCH = 1.0

# El último es una estimación
HALVINGS = ["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20", "2028-04-15"]

# Fase del ciclo (0 = halving, 1 = el siguiente) -> score: techos hacia el 33 % del ciclo y suelos hacia el 60 %
HALVING_PHASE_CURVE = [(0.0, 55), (0.33, 95), (0.60, 5), (1.0, 55)]

MIN_HISTORY_DAYS = 365

LABELS = [
    (20, "Muy barato"),
    (40, "Barato"),
    (60, "Neutral"),
    (80, "Caro"),
    (100, "Muy caro"),
]
