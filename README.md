# Is BTC Cheap?

https://isbtccheap.com

Índice de 1 a 100 que estima si Bitcoin está **barato (1)** o **caro (100)** combinando cinco categorías:
valoración on-chain, ciclo, liquidez, sentimiento y análisis técnico. Se puede consultar en cinco temporalidades:
1 h, 4 h, 1 día, 1 semana y 1 mes.

Coste de funcionamiento: solo el dominio (~10 $/año); el hosting y el certificado HTTPS son gratis.

## Cómo funciona

```
┌──────────────── Diario (GitHub Actions, gratis) ────────────────┐
│ pipeline/build.py                                                │
│  Coin Metrics · Alternative.me · FRED · DefiLlama · Bitview ·    │
│  TFTC (flujos de ETF)                                            │
│  → métricas → percentiles → web/public/data/latest.json          │
│                             web/public/data/history.json         │
└──────────────────────────────────────────────────────────────────┘
                 │ commit → despliegue automático
┌──────────────── En el navegador (en vivo) ──────────────────────┐
│ Velas de Binance de la temporalidad elegida → categoría técnica  │
│ Funding rate de los perpetuos → se suma al sentimiento           │
│ En 1 h y 4 h: open interest y ratios long/short y compra/venta   │
│   → sustituyen al Fear & Greed y al SOPR (diarios) en el sentim. │
│ Pesos por temporalidad → score final 1-100                       │
└──────────────────────────────────────────────────────────────────┘
```

- Las métricas lentas (on-chain, ciclo y liquidez) solo cambian una vez al día. Las calcula el pipeline y la web
  las lee de un JSON estático, así que las visitas nunca consumen las cuotas de las APIs.
- Las métricas rápidas (RSI, Bollinger %B, precio / MA200, funding y, en 1 h y 4 h, open interest y ratios
  long/short y compra/venta de los futuros) las calcula el navegador con la API pública de Binance, que no
  necesita clave.
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

## Noticias y agenda económica (droplet)

Las tarjetas de noticias y agenda leen `/news/news.json` y `/news/calendar.json`, y la página de análisis,
`/news/analysis.json`. Los generan tres scripts de `news/`
(solo librería estándar de Python 3.10+). nginx los sirve desde `news/out`, montado como volumen en `docker-compose.yml`.
Sin esos ficheros las tarjetas no se muestran.

Los tres llaman a los modelos a través de `news/llm.py`, con una lista por orden de preferencia: si uno falla, se satura,
agota el tiempo o su respuesta no supera la comprobación del script, se prueba el siguiente (los que no tienen clave se
saltan). El principal es GLM-5.3 Flash, de la inferencia serverless de DigitalOcean (los de Anthropic y OpenAI exigen su
nivel 3):

| Script | Orden (variable para cambiarlo) |
|---|---|
| Noticias y agenda | GLM-5.3 Flash → gpt-oss-120b → qwen3.8-27b → gpt-oss-20b (los tres en Groq) → Gemini 3.5 Flash → Gemini Flash Latest (`NEWS_MODELS`) |
| Duplicados de noticias | Gemini 3.5 Flash → GLM-5.3 Flash → gpt-oss-120b (Groq) → Gemini Flash Latest (`DEDUPE_MODELS`); GLM se pasaba razonando hasta el límite de tokens |
| Análisis | GLM-5.3 Flash → Gemini 3.5 Flash → Gemini Flash Latest (`ANALYSIS_MODELS`); si fallan todos, se mantiene el anterior |

Los modelos de Groq no están en el análisis: sus datos superan los 8.000 tokens por minuto de su nivel gratuito. Qwen 3.5
salió de la cadena al dejar de estar disponible en DigitalOcean, y gpt-oss-120b, por leer mal la estructura del mercado.

- `build_news.py`: titulares de 7 feeds RSS (cripto, macro, bolsa, geopolítica y la Fed) → clasificación e impacto, duplicados (solo cuando entra un titular que puede publicarse) y traducción de los 10 publicados.
- `build_calendar.py`: calendario semanal de Forex Factory → eventos de impacto alto y medio de EE. UU., el ADP, el IPC
  preliminar de la zona euro y decisiones de tipos.
- `build_analysis.py`: análisis de BTC hecho por IA (de 1 a 3 soportes y resistencias, sesgo, lo más probable en las
  próximas horas y en 1-2 días, y un escenario alternativo), sin niveles ni conclusiones nuestras. El modelo recibe datos
  de mercado en bruto (velas semanales, diarias, de 4 h y de 1 h, derivados, Fear & Greed y flujos de los ETF),
  indicadores calculados con las velas de cada temporalidad (RSI, Bollinger, distancia a las medias de 50 y 200, máximos
  y mínimos y ATR: le cuesta hacer esa aritmética de cabeza y ajusta los objetivos a la volatilidad), el máximo y el
  mínimo de los últimos 12 meses, la estructura de mercado en semanal y diario (pivotes con su RSI, máximos y mínimos
  crecientes o decrecientes, última ruptura, divergencias del RSI y Fibonacci en escala logarítmica, retrocesos y
  extensiones, de dos tramos: el principal, desde el último mínimo que ningún cierre ha perdido hasta el máximo posterior
  o al revés en bajada, el mayor de los dos, y su corrección, provisional mientras no se confirme su extremo y, entonces, sin extensiones) y los
  imbalances (fair value gaps) sin rellenar en semanal, diario y 4 h, la liquidez pendiente en diario y 4 h (máximos y
  mínimos que el precio no ha vuelto a superar, agrupando los iguales; se guarda también en `analysis.json` para dibujarla
  en su gráfico, con un selector 4h / 1D), las zonas de reacción en diario y 4 h (todos los pivotes cercanos agrupados,
  con cuántas veces ha girado ahí el precio y cuántas la han atravesado los cierres sin girar, en total y desde la
  última reacción, que le restan fuerza: los soportes y resistencias del modelo tienen que apoyarse en ellas, afinando
  cada zona diaria con la de 4 h que caiga dentro, más estrecha, y no en Fibonacci ni imbalances, que quedan para los
  objetivos, como hasta dónde llega el precio al cruzar un hueco; la validación anota en el log, con `anchored: false`,
  la zona que no solape una zona de reacción ni contenga un pivote confirmado o una liquidez (el extremo en curso
  no basta), y guarda en `fibonacci` los niveles de
  los que sale algún objetivo o invalidación, que el gráfico dibuja como líneas naranjas), la pérdida no realizada y la realizada de los holders de corto plazo frente a su media de 90 días, con su
  percentil de 4 años, y su SOPR diario (bitview.space: el estrés y si se convierte en ventas con pérdidas, una capitulación) y el contexto de ciclo (máximo histórico, techos y
  suelos de los ciclos anteriores con el mismo criterio que la web, y el mínimo del ciclo actual). Todo calculado, como
  referencias, no como conclusiones; el modelo resume la tendencia de fondo en el campo `trend`. Además, la hora y si
  la bolsa de EE. UU. está
  abierta y, como contexto, los titulares de impacto medio y alto (5 o más) de las últimas 48 h del `news.json` y la agenda
  económica de la semana del `calendar.json`, y las probabilidades de cada
  resultado de las dos próximas reuniones de la Fed según Kalshi (API pública sin clave), ahora, hace 24 h y hace 7 días.
  Kalshi está bloqueado desde España: en local, el análisis sale sin ese dato. Una respuesta que no se sostiene (precio que no cuadra, zonas al lado
  equivocado, escenarios incoherentes) cuenta como fallo y pasa al siguiente modelo. Los textos dicen qué nivel es cada
  precio que citan y por qué importa, y cada objetivo e invalidación lleva su base (`target_basis`: zona de reacción,
  liquidez, imbalance, pivote, Fibonacci o ATR, y temporalidad); el script comprueba que haya un nivel así a menos de
  0,3 ATR diarios y, si no, lo avisa en el log con el nivel más cercano (solo lo registra, no descarta). Cada análisis se guarda también en
  `news/state/analysis_log.jsonl`, para medir después cuánto acierta.
- `eval_analysis.py`: mide el acierto de los análisis del registro con las velas de 1 h de Binance (objetivo antes que
  invalidación en su plazo), frente al que tendría un precio que se moviera al azar con esos objetivos e invalidaciones,
  por modelo, por semana y por la base del objetivo, si los objetivos guardan proporción con lo que se mueve el precio
  y cuántas veces cambia de dirección sin motivo. No llama a ningún modelo: `news/run.sh eval_analysis.py` en el droplet,
  o en local tras copiar el registro (`--since AAAA-MM-DD` para evaluar desde un cambio).

En el droplet, una vez:

```bash
cd ~/isbtccheap && git pull && docker compose up -d --build
cp news/.env.example news/.env && chmod 600 news/.env   # y pon las claves: DO_MODEL_ACCESS_KEY, GROQ_API_KEY, GEMINI_API_KEY
news/run.sh build_news.py && news/run.sh build_calendar.py && news/run.sh build_analysis.py   # primera ejecución
crontab -e
```

```cron
# Horas en UTC (la zona del droplet: compruébalo con `date`); en invierno, todo lo de Europa y EE. UU. va una hora más
# tarde que en verano. Noticias cada 15 min (minutos 5, 20, 35 y 50) de lunes a viernes de 06:00 a 21:59 UTC, que cubre
# en las dos estaciones (verano/invierno): datos de Alemania (06:00/07:00), bolsas europeas (07:00-15:30/08:00-16:30),
# BCE (12:15-13:30/13:15-14:30), datos de EE. UU. (12:30-14:00/13:30-15:00), Wall Street (13:30-20:00/14:30-21:00),
# Fed (18:00-19:30/19:00-20:30) y los resultados empresariales tras el cierre. El resto del tiempo y los fines de semana,
# cada hora
5,20,35,50 6-21 * * 1-5 /root/isbtccheap/news/run.sh build_news.py >> /var/log/isbtccheap-news.log 2>&1
5 0-5,22,23 * * 1-5     /root/isbtccheap/news/run.sh build_news.py >> /var/log/isbtccheap-news.log 2>&1
5 * * * 0,6             /root/isbtccheap/news/run.sh build_news.py >> /var/log/isbtccheap-news.log 2>&1
# Agenda: cada 30 min (minutos 2 y 32) cuando salen los datos de EE. UU. (12:00-15:59 UTC: 8:30 y 10:00 en Nueva York
# con horario de verano o de invierno) y la Fed (18:00-20:59 UTC); cada hora en el resto del horario europeo, de lunes a
# viernes. Fines de semana no hay datos: solo el domingo a las 08:02 UTC, cuando Forex Factory ya publica la nueva semana
2 6-11,16,17 * * 1-5    /root/isbtccheap/news/run.sh build_calendar.py >> /var/log/isbtccheap-news.log 2>&1
2,32 12-15,18-20 * * 1-5 /root/isbtccheap/news/run.sh build_calendar.py >> /var/log/isbtccheap-news.log 2>&1
2 8 * * 0               /root/isbtccheap/news/run.sh build_calendar.py >> /var/log/isbtccheap-news.log 2>&1
# Análisis (hora de Madrid): de lunes a viernes a las 10:00 y a las 17:00, los sábados a las 12:00 y los domingos a las 18:00.
# Se lanza a las dos horas UTC posibles (invierno y verano) y solo sigue si en Madrid es la hora buscada: así no hay que
# tocarlo con el cambio de hora. En crontab, % se escribe \%
0 8,9,15,16 * * 1-5     h=$(TZ=Europe/Madrid date +\%H); [ "$h" = 10 ] || [ "$h" = 17 ] && /root/isbtccheap/news/run.sh build_analysis.py >> /var/log/isbtccheap-news.log 2>&1
0 10,11 * * 6           [ "$(TZ=Europe/Madrid date +\%H)" = 12 ] && /root/isbtccheap/news/run.sh build_analysis.py >> /var/log/isbtccheap-news.log 2>&1
0 16,17 * * 0           [ "$(TZ=Europe/Madrid date +\%H)" = 18 ] && /root/isbtccheap/news/run.sh build_analysis.py >> /var/log/isbtccheap-news.log 2>&1
```

Coste orientativo: menos de 1 $/mes en noticias y agenda (los duplicados, la tarea que más tokens gasta, van con el nivel gratuito de Gemini), más el análisis (unas 52 consultas al mes: unos 0,50 $ con GLM-5.3 Flash). En local: `python3 news/build_news.py` (o `--dry-run`, sin modelo) y `npm run dev`, que
sirve `news/out` en `/news/`.

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
  atribución; ya aparece en el pie de la web. Bitview (SOPR y precio realizado de corto plazo) es gratuito y sin
  clave; su código es MIT, pero no publica condiciones explícitas sobre el uso de los datos: se cita en el pie.
  Los flujos de ETF (The Commoner Bitcoin ETF Tracker, TFTC) son CC BY 4.0: hay que citar la fuente y la fecha de
  los datos, y el pipeline la añade a la atribución del pie.
- **Binance** bloquea algunas regiones, como EE. UU. Si falla, la web usa el técnico diario del pipeline.
- La regresión power law se ajusta con todo el histórico, así que tiene algo de lookahead en el backtest.
- Bitcoin solo tiene unos 4 ciclos completos. Evita sobreajustar los pesos.
- No es asesoramiento financiero.
