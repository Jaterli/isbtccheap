"""Genera news/out/snapshot/: el dato del día en HTML para los buscadores, que nginx inserta con SSI en el HTML de la
portada y de la página de análisis (ver web/vite.config.ts y web/nginx.conf). Sin JavaScript, Google solo veía el texto
fijo de cada página: los títulos dicen «hoy», pero el score, el precio y el análisis llegaban después por JavaScript.

Por página e idioma (home-es, home-en, analysis-es, analysis-en):
  - <página>.html: un bloque con la fecha, el score del último cierre diario, el precio y las categorías (portada) o el
    titular, el resumen, el sesgo y las zonas del análisis de IA (análisis)
  - <página>.desc: la meta description con el dato del día delante del texto fijo

Si falta un dato o un fichero, nginx usa el texto fijo de la página (el stub de SSI). Solo librería estándar.
Uso: python build_snapshot.py   (cron del droplet, cada hora: ver el README)
"""

import html
import json
import logging
import os
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

DIR = Path(__file__).resolve().parent
OUT_DIR = DIR / "out"
SNAP_DIR = OUT_DIR / "snapshot"
LATEST_URL = os.environ.get("ANALYSIS_LATEST_URL", "https://raw.githubusercontent.com/Jaterli/isbtccheap/main/web/public/data/latest.json")
UA = {"User-Agent": "isbtccheap/0.1 (+https://isbtccheap.com)"}
# Un análisis más antiguo ya no es «el de hoy»: se deja el texto fijo
ANALYSIS_MAX_DAYS = 3
# Las descripciones largas las recorta Google: el dato va delante y el texto fijo detrás
DESC_MAX = 160

log = logging.getLogger("snapshot")

MONTHS = {"es": ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
          "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
# Las mismas que t.labels y t.categories de la web (src/i18n)
LABELS = {"es": ["Muy barato", "Barato", "Neutral", "Caro", "Muy caro"],
          "en": ["Very cheap", "Cheap", "Neutral", "Expensive", "Very expensive"]}
CATEGORIES = {"es": {"valoracion": "Valoración on-chain", "ciclo": "Ciclo", "liquidez": "Liquidez", "sentimiento": "Sentimiento", "tecnico": "Técnico"},
              "en": {"valoracion": "On-chain valuation", "ciclo": "Cycle", "liquidez": "Liquidity", "sentimiento": "Sentiment", "tecnico": "Technical"}}
ORDER = ["tecnico", "sentimiento", "valoracion", "ciclo", "liquidez"]
BIAS = {"es": {"alcista": "alcista", "bajista": "bajista", "neutral": "neutral"},
        "en": {"alcista": "bullish", "bajista": "bearish", "neutral": "neutral"}}
ANALYSIS_PATH = {"es": "/analisis/", "en": "/en/analysis/"}

TX = {
    "es": {
        "today": "Hoy, {date}",
        "score": "Score diario del índice: {score}/100 ({label}), con el cierre del {as_of}. Precio de BTC: {price}.",
        "cats": "Puntuación por categoría (0 barato, 100 caro):",
        "analysis_link": "Último análisis ({date}): {headline}",
        "analysis_title": "Análisis del {date}",
        "bias": "Sesgo {bias}.",
        "supports": "Soportes: {zones}.",
        "resistances": "Resistencias: {zones}.",
        "current": "El precio está en la zona de {zone}.",
        "home_desc": "Hoy ({date}): Bitcoin puntúa {score}/100 en el índice, {label}, a {price}.",
        "analysis_desc": "Análisis de Bitcoin del {date}: {headline}.",
    },
    "en": {
        "today": "Today, {date}",
        "score": "Daily index score: {score}/100 ({label}), as of the {as_of} close. BTC price: {price}.",
        "cats": "Score by category (0 cheap, 100 expensive):",
        "analysis_link": "Latest analysis ({date}): {headline}",
        "analysis_title": "Analysis for {date}",
        "bias": "{bias} bias.",
        "supports": "Support: {zones}.",
        "resistances": "Resistance: {zones}.",
        "current": "Price is inside the {zone} zone.",
        "home_desc": "Today ({date}): Bitcoin scores {score}/100 on the index, {label}, at {price}.",
        "analysis_desc": "Bitcoin analysis for {date}: {headline}.",
    },
}


def get(url: str) -> dict:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.load(r)


def fmt_date(d: date, lang: str) -> str:
    m = MONTHS[lang][d.month - 1]
    return f"{d.day} {m} {d.year}" if lang == "es" else f"{m} {d.day}, {d.year}"


def usd(v: float, lang: str) -> str:
    n = f"{round(v):,}"
    return f"{n.replace(',', '.')} $" if lang == "es" else f"${n}"


def label_of(score: float, labels: list[dict], lang: str) -> str:
    """La etiqueta por su posición en la escala del pipeline (los límites de latest.json)."""
    i = next((k for k, l in enumerate(labels) if score <= l["max"]), len(labels) - 1)
    return LABELS[lang][i].lower()


def desc(lead: str, fixed: str) -> str:
    """El dato del día y, si cabe, el texto fijo de la página detrás."""
    full = f"{lead} {fixed}"
    return full if len(full) <= DESC_MAX else lead


def write(name: str, text: str) -> None:
    """Escritura atómica: nginx nunca lee un fichero a medias."""
    tmp = SNAP_DIR / f".{name}.tmp"
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(SNAP_DIR / name)


def remove(name: str) -> None:
    (SNAP_DIR / name).unlink(missing_ok=True)


# Texto fijo de la meta description de cada página (el de src/i18n/meta.ts), detrás del dato del día
FIXED_DESC = {
    "home": {"es": "Combina valoración on-chain, ciclos, liquidez, sentimiento y análisis técnico.",
             "en": "It combines on-chain valuation, cycles, liquidity, sentiment and technical analysis."},
    "analysis": {"es": "Soportes, resistencias y escenarios, con IA.", "en": "Support, resistance and scenarios, with AI."},
}


def home(latest: dict, analysis: dict | None, today: date) -> None:
    score = latest.get("score_1d")
    if score is None:
        log.warning("latest.json sin score_1d: la portada queda con el texto fijo")
        for lang in ("es", "en"):
            remove(f"home-{lang}.html")
            remove(f"home-{lang}.desc")
        return
    as_of = date.fromisoformat(latest["as_of"])
    for lang in ("es", "en"):
        tx, e = TX[lang], html.escape
        label = label_of(score, latest["labels"], lang)
        price = usd(latest["price"], lang)
        cats = latest.get("categories", {})
        items = "".join(f"<li>{e(CATEGORIES[lang][k])}: {round(cats[k]['score'])}</li>"
                        for k in ORDER if k in cats and cats[k].get("score") is not None)
        parts = [f"<h2>{e(tx['today'].format(date=fmt_date(today, lang)))}</h2>",
                 f"<p>{e(tx['score'].format(score=round(score), label=label, as_of=fmt_date(as_of, lang), price=price))}</p>"]
        if items:
            parts.append(f"<p>{e(tx['cats'])}</p><ul>{items}</ul>")
        if analysis:
            day = datetime.fromisoformat(analysis["generated_at"]).date()
            link = tx["analysis_link"].format(date=fmt_date(day, lang), headline=analysis[lang]["headline"])
            parts.append(f'<p><a href="{ANALYSIS_PATH[lang]}">{e(link)}</a></p>')
        write(f"home-{lang}.html", f'<section class="seo-today">{"".join(parts)}</section>')
        lead = tx["home_desc"].format(date=fmt_date(today, lang), score=round(score), label=label, price=price)
        write(f"home-{lang}.desc", html.escape(desc(lead, FIXED_DESC["home"][lang])))


def analysis_page(analysis: dict | None) -> None:
    if not analysis:
        for lang in ("es", "en"):
            remove(f"analysis-{lang}.html")
            remove(f"analysis-{lang}.desc")
        return
    day = datetime.fromisoformat(analysis["generated_at"]).date()
    levels = analysis.get("levels", [])
    for lang in ("es", "en"):
        tx, e, text = TX[lang], html.escape, analysis[lang]
        zones = lambda kind: ", ".join(f"{l['id']} {usd(l['low'], lang)}–{usd(l['high'], lang)}"
                                       for l in sorted((l for l in levels if l["kind"] == kind), key=lambda l: l["id"]))
        bias = BIAS[lang].get(analysis.get("bias"), analysis.get("bias", ""))
        parts = [f"<h2>{e(tx['analysis_title'].format(date=fmt_date(day, lang)))}</h2>",
                 f"<h3>{e(text['headline'])}</h3>",
                 f"<p>{e(text['summary'])}</p>",
                 f"<p>{e(tx['bias'].format(bias=bias.capitalize() if lang == 'en' else bias))}"]
        if (sup := zones("support")):
            parts.append(f" {e(tx['supports'].format(zones=sup))}")
        if (res := zones("resistance")):
            parts.append(f" {e(tx['resistances'].format(zones=res))}")
        if (cz := analysis.get("current_zone")):
            parts.append(f" {e(tx['current'].format(zone=f'{usd(cz['low'], lang)}–{usd(cz['high'], lang)}'))}")
        parts.append("</p>")
        if text.get("outlook"):
            parts.append(f"<p>{e(text['outlook'])}</p>")
        write(f"analysis-{lang}.html", f'<section class="seo-today">{"".join(parts)}</section>')
        lead = tx["analysis_desc"].format(date=fmt_date(day, lang), headline=text["headline"].rstrip("."))
        write(f"analysis-{lang}.desc", html.escape(desc(lead, FIXED_DESC["analysis"][lang])))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    SNAP_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).date()
    analysis = None
    try:
        a = json.loads((OUT_DIR / "analysis.json").read_text(encoding="utf-8"))
        age = (today - datetime.fromisoformat(a["generated_at"]).date()).days
        analysis = a if age <= ANALYSIS_MAX_DAYS else None
        if analysis is None:
            log.warning("analysis.json de hace %d días: la página de análisis queda con el texto fijo", age)
    except (FileNotFoundError, KeyError, ValueError) as e:
        log.warning("analysis.json no disponible: %s", e)
    analysis_page(analysis)
    try:
        home(get(LATEST_URL), analysis, today)
    except Exception as e:  # sin latest.json se dejan los fragmentos de la última ejecución
        log.warning("latest.json no disponible: %s", e)
    log.info("snapshot: %s", ", ".join(sorted(p.name for p in SNAP_DIR.iterdir() if not p.name.startswith("."))))


if __name__ == "__main__":
    main()
