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
    # SOPR de los holders de corto plazo: si los compradores recientes venden con beneficio (euforia) o con pérdida
    # (capitulación). Da al sentimiento historia desde 2011 (el Fear & Greed empieza en 2018) y marca bien los suelos.
    # El precio realizado de corto plazo se probó en valoración y empeoraba la anticipación a un año (es momentum):
    # solo se muestra en la página de valoración (bands.json)
    {"id": "sth_sopr", "name": "SOPR de corto plazo (7 d)", "category": "sentimiento", "method": "percentile"},
    # Flujos netos de los ETF al contado en BTC, suma de 20 sesiones: entradas fuertes en los techos, salidas en los
    # mínimos. Con 20 sesiones es la única ventana que anticipa algo al revés (a 3 meses); con 5 o 10 es momentum.
    # Solo hay datos desde enero de 2024: puntúa a partir de un año de historia y es una métrica más del sentimiento
    {"id": "etf_flows", "name": "Flujos de ETF al contado (20 sesiones)", "category": "sentimiento", "method": "percentile"},
    # Técnico diario (el frontend lo recalcula igual para cada temporalidad)
    {"id": "rsi_14", "name": "RSI 14", "category": "tecnico", "method": "band", "lo": 30, "hi": 70},
    {"id": "bollinger", "name": "Bollinger %B (20, 2)", "category": "tecnico", "method": "raw"},
    {"id": "ma200_ratio", "name": "Precio / MA200 (percentil)", "category": "tecnico", "method": "percentile", "window": 800},
]

# Pesos por temporalidad. En temporalidades cortas pesa más lo que cambia rápido.
# La liquidez pesa poco en plazos cortos: en los suelos de 2015, 2018 y 2022 puntuaba 83-89 (endurecimiento previo) y
# en los techos de 2021 y 2025, 20-25, así que difumina los extremos. Pero es la segunda categoría que mejor anticipa la
# rentabilidad del año siguiente (correlación −0,16, tras el ciclo), así que sube en 1 semana y 1 mes.
# El técnico baja en esos plazos: a un año vista funciona al revés (momentum: correlación +0,27).
# En 1 mes la valoración (lo estirado que está el precio ahora) cede algo de peso al ciclo, que se mueve en meses y
# años y es lo que mejor anticipa el año siguiente (−0,51). Sin pasarse: el ciclo tiene más riesgo de sobreajuste.
# En 1 hora el ciclo es casi constante (sus métricas cambian en meses): solo desplaza el score. Pesa menos que en 4 horas
# y cede ese peso al sentimiento, que en 1 h y 4 h usa derivados en vivo y sí cambia hora a hora. Sin backtest posible:
# Binance da ~41 días de velas de 1 h y ~30 de derivados.
TIMEFRAME_WEIGHTS = {
    "1h": {"tecnico": 40, "sentimiento": 27, "valoracion": 20, "ciclo": 10, "liquidez": 3},
    "4h": {"tecnico": 30, "sentimiento": 20, "valoracion": 27, "ciclo": 19, "liquidez": 4},
    "1d": {"tecnico": 12, "sentimiento": 15, "valoracion": 38, "ciclo": 30, "liquidez": 5},
    "1w": {"tecnico": 6, "sentimiento": 12, "valoracion": 41, "ciclo": 33, "liquidez": 8},
    # A un mes vista el Fear & Greed (diario) y el funding (cada 8 h) apenas dicen nada; la liquidez, más.
    # El técnico sigue bajando con la temporalidad, como en el resto
    "1M": {"tecnico": 4, "sentimiento": 5, "valoracion": 39, "ciclo": 38, "liquidez": 14},
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
