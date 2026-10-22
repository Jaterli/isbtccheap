# Is BTC Cheap?

https://isbtccheap.com

Índice de 1 a 100 que estima si Bitcoin está **barato (1)** o **caro (100)** combinando cinco categorías:
valoración on-chain, ciclo, liquidez, sentimiento y análisis técnico. Se puede consultar en cinco temporalidades:
15 min, 1 h, 4 h, 1 día y 1 semana.

Coste de funcionamiento: solo el dominio (~10 $/año); el hosting y el certificado HTTPS son gratis.

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

Cada métrica se convierte a 0-100 con su **percentil histórico en una ventana móvil de 4 años** (un ciclo de
halving): cada día se compara solo con su pasado, para que el backtest no mire al futuro. Con una ventana
expansiva los techos de 2021 y 2025 no pasaban de ~70 porque se comparaban con las burbujas de 2013 y 2017.
Las métricas en las que un valor alto es favorable, como la liquidez creciente, se invierten (`invert: True`).
Si falta una métrica o una categoría, sus pesos se reparten entre las demás.

La media ponderada de señales poco correlacionadas tiende a 50, así que el resultado se estira con
`50 + 50·tanh(k·(x−50)/50)/tanh(k)` (`SCORE_STRETCH` en `pipeline/config.py`). Con la configuración actual los
suelos de 2015, 2018, 2020 y 2022 quedan en ~8 y los techos de 2013-2025 entre ~78 y ~97.

## Puesta en marcha local

### En WSL con el proyecto en un disco de Windows (configuración actual)

Leer muchos ficheros a través de `/mnt/...` es muy lento. Por eso `web/node_modules` y `.venv` son enlaces
simbólicos a `~/isbtccheap_deps`, en el disco de Linux. El script los crea y los rellena:

```bash
bash scripts/setup-wsl.sh          # solo la primera vez o si se borran las dependencias
.venv/bin/python pipeline/build.py # datos
cd web && npm run dev              # http://localhost:5173
```

Para **instalar o quitar paquetes** usa `bash scripts/npm.sh install <paquete>` (o `uninstall`) en lugar de
`npm install`: npm no admite que `node_modules` sea un enlace y lo reinstalaría en `/mnt`, que es lento.
`npm run …` funciona con normalidad.

Abre el proyecto en VS Code **desde WSL** (`code .` en la terminal de Linux). VS Code en modo Windows no
puede seguir los enlaces simbólicos y marcaría errores falsos de dependencias.

### En Windows (PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r pipeline\requirements.txt
.\.venv\Scripts\python pipeline\build.py
cd web; npm install; npm run dev
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
5. En Cloudflare Pages → **Custom domains**, añade `isbtccheap.com` y `www.isbtccheap.com` (redirige `www` al
   dominio raíz). Si el dominio está en Cloudflare Registrar, el DNS y el certificado HTTPS se configuran solos.

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
