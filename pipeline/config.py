"""Configuración del Satoshi Score: métricas, categorías y pesos por temporalidad.

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

# method: "percentile" -> percentil histórico (ventana expansiva, sin mirar al futuro)
#         "raw"        -> la métrica ya viene en escala 0-100
METRICS = [
    # Valoración on-chain
    {"id": "mvrv", "name": "MVRV", "category": "valoracion", "method": "percentile"},
    {"id": "puell", "name": "Puell Multiple", "category": "valoracion", "method": "percentile"},
    {"id": "mayer", "name": "Mayer Multiple (precio / MA200d)", "category": "valoracion", "method": "percentile"},
    # Ciclo
    {"id": "halving_phase", "name": "Fase del ciclo de halving", "category": "ciclo", "method": "raw"},
    {"id": "power_law", "name": "Desviación de la power law", "category": "ciclo", "method": "percentile"},
    {"id": "wma200_ratio", "name": "Precio / MA200 semanas", "category": "ciclo", "method": "percentile"},
    # Liquidez
    {"id": "net_liquidity_roc", "name": "Liquidez neta Fed (var. 13 sem.)", "category": "liquidez", "method": "percentile", "invert": True},
    {"id": "m2_yoy", "name": "M2 EE. UU. (var. interanual)", "category": "liquidez", "method": "percentile", "invert": True},
    {"id": "dxy_roc", "name": "Dólar DXY amplio (var. 13 sem.)", "category": "liquidez", "method": "percentile"},
    {"id": "stablecoin_roc", "name": "Oferta de stablecoins (var. 90 d)", "category": "liquidez", "method": "percentile", "invert": True},
    # Sentimiento (el funding rate se añade en vivo en el frontend)
    {"id": "fear_greed", "name": "Fear & Greed Index", "category": "sentimiento", "method": "raw"},
    # Técnico diario (el frontend lo recalcula para cada temporalidad)
    {"id": "rsi_14", "name": "RSI 14", "category": "tecnico", "method": "raw"},
]

# Pesos por temporalidad. En temporalidades cortas pesa más lo que cambia rápido.
TIMEFRAME_WEIGHTS = {
    "15m": {"tecnico": 45, "sentimiento": 25, "valoracion": 15, "ciclo": 10, "liquidez": 5},
    "1h": {"tecnico": 40, "sentimiento": 25, "valoracion": 17, "ciclo": 12, "liquidez": 6},
    "4h": {"tecnico": 30, "sentimiento": 25, "valoracion": 22, "ciclo": 15, "liquidez": 8},
    "1d": {"tecnico": 15, "sentimiento": 20, "valoracion": 30, "ciclo": 20, "liquidez": 15},
    "1w": {"tecnico": 10, "sentimiento": 15, "valoracion": 35, "ciclo": 25, "liquidez": 15},
}

# Fecha de cada halving. El siguiente es una estimación.
HALVINGS = ["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20", "2028-04-15"]

# Curva fase del ciclo (0 = halving, 1 = siguiente halving) -> score.
# Calibrada a grandes rasgos: techos ~33% del ciclo, suelos ~60%.
HALVING_PHASE_CURVE = [(0.0, 55), (0.33, 95), (0.60, 5), (1.0, 55)]

# Días mínimos de histórico antes de dar un percentil fiable
MIN_HISTORY_DAYS = 365

LABELS = [
    (20, "Muy barato"),
    (40, "Barato"),
    (60, "Neutral"),
    (80, "Caro"),
    (100, "Muy caro"),
]
