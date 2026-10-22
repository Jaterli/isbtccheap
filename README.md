# Satoshi Score

Índice de 1 a 100 que estima si Bitcoin está **barato (1)** o **caro (100)** combinando cinco categorías:
valoración on-chain, ciclo, liquidez, sentimiento y análisis técnico. Se puede consultar en cinco temporalidades:
15 min, 1 h, 4 h, 1 día y 1 semana.

Coste de funcionamiento: 0 € (solo el dominio, si quieres uno propio).

## Cómo funciona

```
┌──────────────── Diario (GitHub Actions, gratis) ────────────────┐
│ pipeline/build.py                                                │
│  Coin Metrics · Alternative.me · FRED · DefiLlama                │
│  → métricas → percentiles → web/public/data/latest.json          │
│                             web/public/data/history.json         │
└──────────────────────────────────────────────────────────────────┘
                 │ commit → despliegue automático
┌──────────────── En el navegador (en vivo) ──────────────────────┐
│ Velas de Binance de la temporalidad elegida → categoría técnica  │
│ Funding rate de los perpetuos → se suma al sentimiento           │
│ Pesos por temporalidad → score final 1-100                       │
└──────────────────────────────────────────────────────────────────┘
```

- Las métricas lentas (on-chain, ciclo y liquidez) solo cambian una vez al día. Las calcula el pipeline y la web
  las lee de un JSON estático, así que las visitas nunca consumen las cuotas de las APIs.
- Las métricas rápidas (RSI, Bollinger %B, precio / MA200 y funding) las calcula el navegador con la API pública de
  Binance, que no necesita clave.
- En temporalidades cortas pesa más el técnico y el sentimiento; en las largas, la valoración y el ciclo.
  Los pesos están en `pipeline/config.py` → `TIMEFRAME_WEIGHTS`.

### Normalización

Cada métrica se convierte a 0-100 con su **percentil histórico expansivo**: cada día se compara solo con su
pasado, para que el backtest no mire al futuro. Las métricas en las que un valor alto es favorable, como la
liquidez creciente, se invierten (`invert: True`). Si falta una métrica o una categoría, sus pesos se reparten
entre las demás.

## Puesta en marcha local

```powershell
# 1. Datos
python -m venv .venv
.\.venv\Scripts\pip install -r pipeline\requirements.txt
.\.venv\Scripts\python pipeline\build.py

# 2. Web
cd web
npm install
npm run dev        # http://localhost:5173
```

## Despliegue gratuito

1. Sube el proyecto a un repositorio de GitHub. Si es público, los minutos de Actions son ilimitados.
2. **Settings → Actions → General → Workflow permissions**: activa "Read and write" para que el workflow pueda
   hacer commit de los datos.
3. (Opcional) Crea una clave gratuita en https://fred.stlouisfed.org/docs/api/api_key.html y guárdala como
   secret `FRED_API_KEY`. Sin ella se usa el CSV público, que a veces es menos fiable.
4. Conecta el repositorio a **Cloudflare Pages** (o Vercel o Netlify):
   - Directorio raíz: `web`
   - Comando de build: `npm run build`
   - Directorio de salida: `dist`
   Cada commit diario del workflow redespliega la web automáticamente.
5. Apunta tu dominio a Cloudflare Pages.

## Estructura

```
pipeline/
  config.py     métricas, categorías, pesos por temporalidad, etiquetas
  sources.py    descargas de las APIs gratuitas
  metrics.py    cálculo de métricas brutas
  scoring.py    percentiles, categorías y score compuesto
  build.py      punto de entrada: genera los JSON
web/
  public/data/  JSON generados por el pipeline
  src/lib/      Binance, indicadores técnicos y cálculo del score en vivo
  src/components/  medidor, selector de temporalidad, desglose, gráfico histórico
.github/workflows/update-data.yml   cron diario
```

## Avisos

- **Licencias**: Coin Metrics Community es CC BY-NC 4.0, es decir, sin uso comercial. Si vas a monetizar la web
  (anuncios, suscripciones), sustituye esa fuente o pide una licencia. Alternative.me y CoinGecko piden
  atribución; ya aparece en el pie de la web.
- **Binance** bloquea algunas regiones, como EE. UU. Si falla, la web usa el técnico diario del pipeline.
- La regresión power law se ajusta con todo el histórico, así que tiene algo de lookahead en el backtest.
- Bitcoin solo tiene unos 4 ciclos completos. Evita sobreajustar los pesos.
- No es asesoramiento financiero.
