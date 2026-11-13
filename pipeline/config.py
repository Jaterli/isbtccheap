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
    # Fed + BCE + Banco de Japón en dólares: anticipa el año siguiente el doble que la liquidez de la Fed sola
    {"id": "global_liquidity_roc", "name": "Liquidez global (var. 13 sem.)", "category": "liquidez", "method": "percentile", "invert": True},
    {"id": "dxy_roc", "name": "Dólar DXY amplio (var. 13 sem.)", "category": "liquidez", "method": "percentile"},
    # Informativas (info): se puntúan para la página de liquidez, pero no cuentan en la categoría ni salen en su tarjeta.
    # Backtest de noviembre de 2026: M2 anticipa a un año con signo inestable (bien hasta 2020, al revés después) y las
    # stablecoins con el signo cambiado; sin ellas mejora la anticipación del score (1M a 3 meses −0,19 → −0,21) y los
    # techos y suelos quedan igual o algo mejor
    {"id": "m2_yoy", "name": "M2 EE. UU. (var. interanual)", "category": "liquidez", "method": "percentile", "invert": True, "info": True},
    {"id": "stablecoin_roc", "name": "Oferta de stablecoins (var. 90 d)", "category": "liquidez", "method": "percentile", "invert": True, "info": True},
    {"id": "fear_greed", "name": "Fear & Greed Index", "category": "sentimiento", "method": "raw"},
    # El precio realizado de corto plazo se probó en valoración y empeoraba la anticipación a un año (es momentum): solo
    # se muestra en la página de valoración
    {"id": "sth_sopr", "name": "SOPR de corto plazo (7 d)", "category": "sentimiento", "method": "percentile"},
    # Informativa: el MVRV de corto plazo frente a su media de 90 días, con bandas de ±1σ y ±2σ de su último año (como
    # blackalmanak.com). Backtest de noviembre de 2026: sigue al precio (correlación positiva con la rentabilidad
    # posterior), en el índice no cambiaba nada y por debajo de −1,5σ solo daba un rebote de 1-2 semanas que a 30 días se
    # deshacía la mayoría de las veces
    # Informativa: la pérdida realizada de todos los holders frente a su media de 90 días (como coinglass.com). Mucha
    # pérdida = miedo = barato (invertida). Backtest de noviembre de 2026: en general no anticipaba; tras picos de 5 veces
    # su media, el mes siguiente fue algo mejor que la media (+7 % frente a +4 % desde 2018). En el índice mejoraba algo la
    # anticipación pero empeoraba el techo de 2017 y algún suelo
    {"id": "realized_loss_ratio", "name": "Pérdida realizada (frente a su media de 90 d)", "category": "sentimiento", "method": "percentile", "invert": True, "info": True},
    {"id": "sth_mvrv_adj", "name": "MVRV de corto plazo ajustado (90 d)", "category": "sentimiento", "method": "zscore", "window": 365, "info": True},
    # 20 sesiones: con 5 o 10 se comporta como momentum. Datos desde 2024, así que puntúa desde 2025
    {"id": "etf_flows", "name": "Flujos de ETF al contado (20 sesiones)", "category": "sentimiento", "method": "percentile"},
    # El frontend recalcula el técnico con las velas de cada temporalidad
    {"id": "rsi_14", "name": "RSI 14", "category": "tecnico", "method": "band", "lo": 30, "hi": 70},
    {"id": "bollinger", "name": "Bollinger %B (20, 2)", "category": "tecnico", "method": "raw"},
    {"id": "ma200_ratio", "name": "Precio / MA200 (percentil)", "category": "tecnico", "method": "percentile", "window": 800},
]

# Pesos por temporalidad: en las cortas pesa más lo que cambia rápido. Correlaciones con la rentabilidad a un año:
# ciclo −0,51, liquidez −0,16 y técnico +0,27 (momentum), así que la liquidez sube y el técnico baja con el plazo.
# La liquidez difumina los extremos (alta en los suelos, baja en los techos): pesa poco en plazos cortos. Quitarla del
# todo marca más techos y suelos pero empeora la anticipación; en 1 mes, donde más aporta, pesa un punto más a costa
# del técnico (backtest desde 2018, 1 M: rentabilidad a un año −0,567 → −0,577; 1 d con un punto menos para el ciclo:
# −0,401 → −0,404 y suelos más bajos). En 1 M la valoración no baja de la de 1 semana: 2 puntos del sentimiento (sus
# métricas son de días u horas) mejoran la anticipación con el técnico mensual (1 año desde 2018: −0,594 → −0,599).
# En 1 h y 4 h el sentimiento es el diario, el mismo de 1 d (desde el 11 nov 2026; antes, los derivados de Binance en
# vivo, sin histórico para comprobarlos, con 28 y 21): no cambia dentro del día, así que pesa poco más que en 1 d, bajando
# de forma escalonada (19, 17, 15), y el resto va al técnico, que es lo que se mueve a ese ritmo. Sin datos para un
# backtest de 1 h y 4 h. La valoración y el ciclo suben de 1 h a 1 d en pasos iguales (24, 31, 38 y 13, 22, 31: antes 20,
# 27, 38 y 10, 19, 31, con el salto mayor de 4 h a 1 d), a costa del técnico; 1 d, 1 semana y 1 mes salen del backtest y
# no se tocan. Aproximación desde 2018 (las categorías diarias con estos pesos y el técnico diario en lugar del de 1 h o
# 4 h) al suavizar el ciclo: la anticipación mejora en todos los plazos (1 año, 1 h: −0,054 → −0,084; 4 h: −0,193 →
# −0,227) y los techos y suelos quedan igual.
TIMEFRAME_WEIGHTS = {
    "1h": {"tecnico": 43, "sentimiento": 19, "valoracion": 24, "ciclo": 13, "liquidez": 1},
    "4h": {"tecnico": 28, "sentimiento": 17, "valoracion": 31, "ciclo": 22, "liquidez": 2},
    "1d": {"tecnico": 12, "sentimiento": 15, "valoracion": 38, "ciclo": 31, "liquidez": 4},
    "1w": {"tecnico": 6, "sentimiento": 12, "valoracion": 41, "ciclo": 33, "liquidez": 8},
    "1M": {"tecnico": 3, "sentimiento": 3, "valoracion": 41, "ciclo": 38, "liquidez": 15},
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
