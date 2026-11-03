"""Llamadas a los modelos de lenguaje, con respuesta JSON según un esquema y modelos de respaldo.

Cada script pasa su lista de modelos por orden de preferencia; si uno falla (error, saturación, respuesta incompleta o
que no supera la comprobación del script), se prueba el siguiente. Un modelo cuyo proveedor no tiene clave se salta.

Prefijos de los modelos (sin prefijo: DigitalOcean, como "glm-5.3-flash"):
  groq:   API de Groq, compatible con OpenAI (GROQ_API_KEY). Su nivel gratuito admite 8.000 tokens por minuto: sirve
          para las noticias y la agenda, pero no para el análisis, cuyos datos ocupan más
  gemini: API de Gemini (GEMINI_API_KEY), nivel gratuito
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
RETRY_CODES = (429, 500, 502, 503, 504)  # saturación o fallo del servidor: se reintenta antes de pasar al siguiente
RETRIES = 2


def _split(spec: str) -> tuple[str, str]:
    provider, _, model = spec.partition(":")
    return (provider, model) if model else ("do", spec)


def _key(provider: str) -> str:
    return "GEMINI_API_KEY" if provider == "gemini" else OPENAI_COMPATIBLE[provider][1]


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


def _openai(provider: str, model: str, system: str, user: str, schema: dict, name: str) -> dict:
    url, key = OPENAI_COMPATIBLE[provider]
    data = _post(url, {
        "model": model,
        "max_tokens": 16000,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": schema}},
    }, {"Authorization": f"Bearer {os.environ[key]}"}, timeout=180)
    choice = data["choices"][0]
    if choice.get("finish_reason") != "stop":
        raise RuntimeError(f"respuesta incompleta: finish_reason={choice.get('finish_reason')}")
    usage = data.get("usage", {})
    log.info("%s (%s): %s tokens de entrada, %s de salida", name, model, usage.get("prompt_tokens"), usage.get("completion_tokens"))
    return json.loads(choice["message"]["content"])


def _gemini(model: str, system: str, user: str, schema: dict, name: str) -> dict:
    data = _post(GEMINI_URL.format(model=model), {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": schema, "temperature": 0.4},
    }, {"X-goog-api-key": os.environ["GEMINI_API_KEY"]}, timeout=240)
    cand = data["candidates"][0]
    if cand.get("finishReason") != "STOP":
        raise RuntimeError(f"respuesta incompleta: finishReason={cand.get('finishReason')}")
    usage = data.get("usageMetadata", {})
    log.info("%s (%s): %s tokens de entrada, %s de salida, %s de razonamiento", name, data.get("modelVersion", model),
             usage.get("promptTokenCount"), usage.get("candidatesTokenCount"), usage.get("thoughtsTokenCount"))
    text = "".join(p.get("text", "") for p in cand["content"]["parts"] if not p.get("thought"))
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("la respuesta no contiene JSON")
    return json.loads(m.group(0))


def label(spec: str) -> str:
    """Nombre del modelo para mostrar: sin el proveedor ("groq:openai/gpt-oss-120b" → "gpt-oss-120b")."""
    return _split(spec)[1].rsplit("/", 1)[-1]


def complete(system: str, user: str, schema: dict, name: str, models: list[str],
             check: Callable[[dict], Any] | None = None) -> tuple[Any, str]:
    """Respuesta JSON del primer modelo de `models` que responda y, si se indica, supere `check` (que la devuelve
    transformada o lanza una excepción). Devuelve (respuesta, modelo usado)."""
    for spec in models:
        provider, model = _split(spec)
        if provider not in OPENAI_COMPATIBLE and provider != "gemini":
            log.warning("%s: proveedor desconocido en %s", name, spec)
            continue
        if not os.environ.get(_key(provider)):
            log.info("%s: %s sin %s, se salta", name, spec, _key(provider))
            continue
        try:
            data = _gemini(model, system, user, schema, name) if provider == "gemini" \
                else _openai(provider, model, system, user, schema, name)
            return (check(data) if check else data), spec
        except Exception as e:  # el modelo siguiente puede servir
            log.warning("%s: %s falló: %s", name, spec, e)
    raise RuntimeError(f"{name}: ningún modelo dio una respuesta válida")


def models_from_env(var: str, default: str) -> list[str]:
    return [m.strip() for m in os.environ.get(var, default).split(",") if m.strip()]
