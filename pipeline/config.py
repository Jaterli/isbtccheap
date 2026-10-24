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

# method: "percentile" -> percentil histórico (ventana móvil de PERCENTILE_WINDOW_DAYS, sin mirar al futuro;
#                         "window" lo cambia para una métrica concreta)
#         "raw"        -> la métrica ya viene en escala 0-100
#         "band"       -> escala lineal de "lo" (0) a "hi" (100), recortada
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
    # Técnico diario (el frontend lo recalcula igual para cada temporalidad)
    {"id": "rsi_14", "name": "RSI 14", "category": "tecnico", "method": "band", "lo": 30, "hi": 70},
    {"id": "bollinger", "name": "Bollinger %B (20, 2)", "category": "tecnico", "method": "raw"},
    {"id": "ma200_ratio", "name": "Precio / MA200 (percentil)", "category": "tecnico", "method": "percentile", "window": 800},
]

# Pesos por temporalidad. En temporalidades cortas pesa más lo que cambia rápido.
# La liquidez pesa poco: en los suelos históricos puntuaba ~75 (endurecimiento previo) y restaba fiabilidad.
TIMEFRAME_WEIGHTS = {
    "1h": {"tecnico": 40, "sentimiento": 23, "valoracion": 20, "ciclo": 14, "liquidez": 3},
    "4h": {"tecnico": 30, "sentimiento": 20, "valoracion": 27, "ciclo": 19, "liquidez": 4},
    "1d": {"tecnico": 12, "sentimiento": 15, "valoracion": 38, "ciclo": 30, "liquidez": 5},
    "1w": {"tecnico": 8, "sentimiento": 12, "valoracion": 42, "ciclo": 33, "liquidez": 5},
    # A un mes vista el Fear & Greed (diario) y el funding (cada 8 h) apenas dicen nada; la liquidez, más
    "1M": {"tecnico": 10, "sentimiento": 5, "valoracion": 40, "ciclo": 35, "liquidez": 10},
}

# Ventana del percentil: un ciclo de halving. Con ventana expansiva los techos recientes nunca llegaban
# arriba porque se comparaban con las burbujas de 2013 y 2017 (rendimientos decrecientes).
PERCENTILE_WINDOW_DAYS = 1461

# Al promediar señales poco correlacionadas el score se comprime hacia 50. Se estira con
# 50 + 50·tanh(k·(x−50)/50)/tanh(k), que conserva 0, 50 y 100. Con k=1 los suelos históricos
# quedan en ~8 y los techos en ~80-97. 0 lo desactiva.
SCORE_STRETCH = 1.0

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
