"""Llamadas a los modelos de lenguaje, con respuesta JSON según un esquema y modelos de respaldo.

Cada script pasa su lista de modelos por orden de preferencia; si uno falla (error, saturación, respuesta incompleta o
que no supera la comprobación del script), se prueba el siguiente. Si agota max_tokens sin terminar, antes se reintenta
una vez con el mismo modelo (LENGTH_RETRIES). Un modelo cuyo proveedor no tiene clave se salta.

Prefijos de los modelos (sin prefijo: DigitalOcean, como "glm-5.3-flash"):
  groq:   API de Groq, compatible con OpenAI (GROQ_API_KEY). Su nivel gratuito admite 8.000 tokens por minuto: sirve
          para las noticias y la agenda, pero no para el análisis, cuyos datos ocupan más
  gemini: API de Gemini (GEMINI_API_KEY), nivel gratuito
  anthropic: API de Anthropic con su SDK oficial (ANTHROPIC_API_KEY; pip install anthropic, que solo hace falta si se
          usa). Admite el esfuerzo de razonamiento tras una @: "anthropic:claude-haiku-5-5@low" (por defecto, medium)

El esfuerzo de razonamiento tras una @ vale también para DigitalOcean y Groq ("glm-5.3-flash@medium", que se envía como
reasoning_effort); sin @, el que tenga por defecto el modelo.
"""

import json
import logging
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any, Callable

log = logging.getLogger("llm")

# Groq (detrás de Cloudflare) rechaza el User-Agent por defecto de Python (error 1010)
UA = "isbtccheap/0.1 (+https://isbtccheap.com)"
OPENAI_COMPATIBLE = {
    "do": ("https://inference.do-ai.run/v1/chat/completions", "DO_MODEL_ACCESS_KEY"),
    "groq": ("https://api.groq.com/openai/v1/chat/completions", "GROQ_API_KEY"),
}
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# Un modelo que agota max_tokens razonando suele entrar en un bucle aleatorio: con la misma petición, el siguiente
# intento a menudo termina (11 nov 2026: GLM, 17.000 tokens en un intento y 32.000 sin terminar en el siguiente)
LENGTH_RETRIES = 1


class Incomplete(RuntimeError):
    """El modelo agotó max_tokens sin terminar la respuesta."""


RETRY_CODES = (429, 500, 502, 503, 504)  # saturación o fallo del servidor: se reintenta antes de pasar al siguiente
RETRIES = 2


def _split(spec: str) -> tuple[str, str]:
    provider, _, model = spec.partition(":")
    return (provider, model) if model else ("do", spec)


ANTHROPIC_EFFORT = "medium"


def _key(provider: str) -> str:
    return {"gemini": "GEMINI_API_KEY", "anthropic": "ANTHROPIC_API_KEY"}.get(provider) or OPENAI_COMPATIBLE[provider][1]


def _post(url: str, body: dict, headers: dict, timeout: int) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "User-Agent": UA, **headers})
    for attempt in range(RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return json.loads(res.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:200]
            if e.code not in RETRY_CODES or attempt == RETRIES:
                raise RuntimeError(f"HTTP {e.code}: {msg}") from None
        # Un modelo que agota el tiempo suele volver a agotarlo: se pasa al siguiente sin reintentar
        time.sleep(5 * 2**attempt)
    raise AssertionError("inalcanzable")


def _openai(provider: str, model: str, system: str, user: str, schema: dict, name: str, max_tokens: int) -> dict:
    url, key = OPENAI_COMPATIBLE[provider]
    model, _, effort = model.partition("@")
    data = _post(url, {
        "model": model,
        "max_tokens": max_tokens,
        # Con "low" o "none", GLM (DigitalOcean) no razona nada y falla cuentas sencillas: solo medium o high
        **({"reasoning_effort": effort} if effort else {}),
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": schema}},
    # Hasta ~50 tokens por segundo: GLM en DigitalOcean va a menudo por debajo de 100 y, con 32.000 de límite, el análisis
    # agotaba los 320 s de espera razonando
    }, {"Authorization": f"Bearer {os.environ[key]}"}, timeout=max(180, max_tokens // 50))
    choice = data["choices"][0]
    usage = data.get("usage", {})
    if choice.get("finish_reason") != "stop":
        # Con los tokens gastados se distingue si agotó el límite (razonamiento en bucle) o se cortó por otra causa
        err = Incomplete if choice.get("finish_reason") == "length" else RuntimeError
        raise err(f"respuesta incompleta: finish_reason={choice.get('finish_reason')}, "
                           f"{usage.get('prompt_tokens')} tokens de entrada, {usage.get('completion_tokens')} de salida "
                           f"(límite {max_tokens})")
    log.info("%s (%s%s): %s tokens de entrada, %s de salida", name, model, f", esfuerzo {effort}" if effort else "",
             usage.get("prompt_tokens"), usage.get("completion_tokens"))
    return json.loads(choice["message"]["content"])


def _gemini(model: str, system: str, user: str, schema: dict, name: str) -> dict:
    data = _post(GEMINI_URL.format(model=model), {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": schema, "temperature": 0.4},
    }, {"X-goog-api-key": os.environ["GEMINI_API_KEY"]}, timeout=240)
    cand = data["candidates"][0]
    if cand.get("finishReason") != "STOP":
        err = Incomplete if cand.get("finishReason") == "MAX_TOKENS" else RuntimeError
        raise err(f"respuesta incompleta: finishReason={cand.get('finishReason')}")
    usage = data.get("usageMetadata", {})
    log.info("%s (%s): %s tokens de entrada, %s de salida, %s de razonamiento", name, data.get("modelVersion", model),
             usage.get("promptTokenCount"), usage.get("candidatesTokenCount"), usage.get("thoughtsTokenCount"))
    text = "".join(p.get("text", "") for p in cand["content"]["parts"] if not p.get("thought"))
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("la respuesta no contiene JSON")
    return json.loads(m.group(0))


def _anthropic(model: str, system: str, user: str, schema: dict, name: str, max_tokens: int) -> dict:
    import anthropic  # solo si se usa: el resto de proveedores no lo necesitan

    model, _, effort = model.partition("@")
    # En streaming: con un max_tokens tan alto, el SDK no admite la petición sin él (podría superar su tiempo de espera)
    with anthropic.Anthropic().messages.stream(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort or ANTHROPIC_EFFORT, "format": {"type": "json_schema", "schema": schema}},
    ) as stream:
        msg = stream.get_final_message()
    usage = msg.usage
    if msg.stop_reason == "refusal":
        raise RuntimeError(f"rechazada: {msg.stop_details.category if msg.stop_details else None}")
    if msg.stop_reason != "end_turn":
        err = Incomplete if msg.stop_reason == "max_tokens" else RuntimeError
        raise err(f"respuesta incompleta: stop_reason={msg.stop_reason}, {usage.input_tokens} tokens de entrada, "
                           f"{usage.output_tokens} de salida (límite {max_tokens})")
    log.info("%s (%s, esfuerzo %s): %s tokens de entrada, %s de salida", name, model, effort or ANTHROPIC_EFFORT,
             usage.input_tokens, usage.output_tokens)
    # Con output_config.format, el texto es un JSON que cumple el esquema
    return json.loads(next(b.text for b in msg.content if b.type == "text"))


def label(spec: str) -> str:
    """Nombre del modelo para mostrar: sin el proveedor ni el esfuerzo ("groq:openai/gpt-oss-120b" → "gpt-oss-120b")."""
    return _split(spec)[1].rsplit("/", 1)[-1].partition("@")[0]


def complete(system: str, user: str, schema: dict, name: str, models: list[str],
             check: Callable[[dict], Any] | None = None, max_tokens: int = 16000) -> tuple[Any, str]:
    """Respuesta JSON del primer modelo de `models` que responda y, si se indica, supere `check` (que la devuelve
    transformada o lanza una excepción). Devuelve (respuesta, modelo usado). `max_tokens` (salida, razonamiento
    incluido) se aplica a los modelos compatibles con OpenAI y a los de Anthropic; en los primeros, el tiempo de espera
    crece con él."""
    for spec in models:
        provider, model = _split(spec)
        if provider not in OPENAI_COMPATIBLE and provider not in ("gemini", "anthropic"):
            log.warning("%s: proveedor desconocido en %s", name, spec)
            continue
        if not os.environ.get(_key(provider)):
            log.info("%s: %s sin %s, se salta", name, spec, _key(provider))
            continue
        for attempt in range(LENGTH_RETRIES + 1):
            try:
                if provider == "gemini":
                    data = _gemini(model, system, user, schema, name)
                elif provider == "anthropic":
                    data = _anthropic(model, system, user, schema, name, max_tokens)
                else:
                    data = _openai(provider, model, system, user, schema, name, max_tokens)
                return (check(data) if check else data), spec
            except Incomplete as e:  # se vuelve a intentar con el mismo modelo antes de pasar al siguiente
                again = attempt < LENGTH_RETRIES
                log.warning("%s: %s falló: %s%s", name, spec, e, "; se reintenta" if again else "")
            except Exception as e:  # el modelo siguiente puede servir
                log.warning("%s: %s falló: %s", name, spec, e)
                break
    raise RuntimeError(f"{name}: ningún modelo dio una respuesta válida")


def models_from_env(var: str, default: str) -> list[str]:
    return [m.strip() for m in os.environ.get(var, default).split(",") if m.strip()]
